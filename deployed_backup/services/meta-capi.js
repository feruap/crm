"use strict";
/**
 * Meta Conversions API (CAPI) Service
 *
 * Sends server-side conversion events to Meta for:
 * - Purchase (when an order with FB attribution is completed)
 * - Lead (when a conversation from FB ad is created)
 *
 * Deduplication with browser pixel uses event_id.
 * Retry logic for failed sends.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMetaPurchaseEvent = sendMetaPurchaseEvent;
exports.sendMetaLeadEvent = sendMetaLeadEvent;
exports.retryFailedMetaEvents = retryFailedMetaEvents;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../db");
// ─────────────────────────────────────────────
// Hash Utilities (Meta requires SHA-256)
// ─────────────────────────────────────────────
function hashSHA256(value) {
    return crypto_1.default.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}
// ─────────────────────────────────────────────
// Send Event to Meta CAPI
// ─────────────────────────────────────────────
async function sendToMetaCAPI(events) {
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
    if (!pixelId || !accessToken) {
        throw new Error('META_PIXEL_ID and META_CAPI_ACCESS_TOKEN are required');
    }
    const url = `https://graph.facebook.com/v19.0/${pixelId}/events`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            data: events,
            access_token: accessToken,
            // test_event_code: process.env.META_TEST_EVENT_CODE, // Uncomment for testing
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Meta CAPI error ${response.status}: ${errorBody}`);
    }
    return response.json();
}
// ─────────────────────────────────────────────
// Public: Send Purchase Event
// ─────────────────────────────────────────────
/**
 * Send a Purchase conversion event to Meta CAPI.
 * Called when an order with FB attribution is marked as completed.
 */
async function sendMetaPurchaseEvent(orderId, attributionId) {
    // Generate a unique event_id for dedup
    const eventId = `purchase_${orderId}_${Date.now()}`;
    try {
        // Get order + attribution + customer data
        const orderData = await db_1.db.query(`SELECT o.*, a.customer_id,
                    c.display_name AS customer_name
             FROM orders o
             JOIN attributions a ON a.order_id = o.id AND a.id = $1
             JOIN customers c ON c.id = a.customer_id
             WHERE o.id = $2`, [attributionId, orderId]);
        if (orderData.rows.length === 0) {
            return { ok: false, eventId, error: 'Order or attribution not found' };
        }
        const order = orderData.rows[0];
        // Get customer email/phone for matching
        const customerAttrs = await db_1.db.query(`SELECT key, value FROM customer_attributes
             WHERE customer_id = $1 AND key IN ('email', 'phone')`, [order.customer_id]);
        const email = customerAttrs.rows.find((a) => a.key === 'email')?.value;
        const phone = customerAttrs.rows.find((a) => a.key === 'phone')?.value;
        // Get touchpoint data (fbc, fbp)
        const touchpoint = await db_1.db.query(`SELECT fbc, fbp, event_source_url
             FROM attribution_touchpoints
             WHERE customer_id = $1 AND platform = 'facebook'
             ORDER BY created_at DESC LIMIT 1`, [order.customer_id]);
        const tp = touchpoint.rows[0] || {};
        // Build event
        const userData = {
            external_id: [hashSHA256(order.customer_id)],
        };
        if (email)
            userData.em = [hashSHA256(email)];
        if (phone)
            userData.ph = [hashSHA256(phone.replace(/\D/g, ''))];
        if (tp.fbc)
            userData.fbc = tp.fbc;
        if (tp.fbp)
            userData.fbp = tp.fbp;
        // Parse order items for content_ids
        const items = order.items || [];
        const contentIds = items.map((i) => String(i.product_id || i.name || 'unknown'));
        const event = {
            event_name: 'Purchase',
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            event_source_url: tp.event_source_url || process.env.WC_URL || '',
            action_source: 'website',
            user_data: userData,
            custom_data: {
                currency: order.currency || 'MXN',
                value: parseFloat(order.total_amount || '0'),
                order_id: order.external_order_id,
                content_ids: contentIds,
                content_type: 'product',
            },
        };
        // Record in conversion_events before sending
        await db_1.db.query(`INSERT INTO conversion_events
                (platform, event_name, event_id, order_id, customer_id, attribution_id,
                 event_value, currency, event_source_url, fbc, fbp, pixel_id, status)
             VALUES ('meta', 'Purchase', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')`, [
            eventId, orderId, order.customer_id, attributionId,
            parseFloat(order.total_amount || '0'), order.currency || 'MXN',
            tp.event_source_url || null, tp.fbc || null, tp.fbp || null,
            process.env.META_PIXEL_ID || null,
        ]);
        // Send to Meta
        const result = await sendToMetaCAPI([event]);
        // Update status
        await db_1.db.query(`UPDATE conversion_events
             SET status = 'sent', platform_response = $1, sent_at = NOW(), last_attempt_at = NOW()
             WHERE event_id = $2`, [JSON.stringify(result), eventId]);
        console.log(`[Meta CAPI] Purchase event sent for order #${order.external_order_id} ($${order.total_amount} ${order.currency})`);
        return { ok: true, eventId };
    }
    catch (err) {
        // Update status to failed
        await db_1.db.query(`UPDATE conversion_events
             SET status = 'failed', last_attempt_at = NOW(), retry_count = retry_count + 1,
                 platform_response = $1
             WHERE event_id = $2`, [JSON.stringify({ error: String(err) }), eventId]).catch(() => { }); // Don't fail if the update fails
        console.error(`[Meta CAPI] Failed to send Purchase event:`, err);
        return { ok: false, eventId, error: String(err) };
    }
}
// ─────────────────────────────────────────────
// Public: Send Lead Event
// ─────────────────────────────────────────────
/**
 * Send a Lead event when a new conversation is created from a FB/IG ad.
 */
async function sendMetaLeadEvent(customerId, conversationId, referralData) {
    const eventId = `lead_${conversationId}_${Date.now()}`;
    try {
        // Get touchpoint data
        const touchpoint = await db_1.db.query(`SELECT fbc, fbp, event_source_url
             FROM attribution_touchpoints
             WHERE customer_id = $1 AND platform = 'facebook'
             ORDER BY created_at DESC LIMIT 1`, [customerId]);
        const tp = touchpoint.rows[0] || {};
        const event = {
            event_name: 'Lead',
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            event_source_url: tp.event_source_url || process.env.WC_URL || '',
            action_source: 'chat',
            user_data: {
                external_id: [hashSHA256(customerId)],
                fbc: tp.fbc || undefined,
                fbp: tp.fbp || undefined,
            },
        };
        // Record
        await db_1.db.query(`INSERT INTO conversion_events
                (platform, event_name, event_id, customer_id, fbc, fbp, status)
             VALUES ('meta', 'Lead', $1, $2, $3, $4, 'pending')`, [eventId, customerId, tp.fbc || null, tp.fbp || null]);
        // Send
        const result = await sendToMetaCAPI([event]);
        await db_1.db.query(`UPDATE conversion_events
             SET status = 'sent', platform_response = $1, sent_at = NOW(), last_attempt_at = NOW()
             WHERE event_id = $2`, [JSON.stringify(result), eventId]);
        console.log(`[Meta CAPI] Lead event sent for customer ${customerId}`);
        return { ok: true, eventId };
    }
    catch (err) {
        await db_1.db.query(`UPDATE conversion_events
             SET status = 'failed', last_attempt_at = NOW(), retry_count = retry_count + 1,
                 platform_response = $1
             WHERE event_id = $2`, [JSON.stringify({ error: String(err) }), eventId]).catch(() => { });
        console.error(`[Meta CAPI] Failed to send Lead event:`, err);
        return { ok: false, eventId, error: String(err) };
    }
}
// ─────────────────────────────────────────────
// Retry Failed Events
// ─────────────────────────────────────────────
/**
 * Retry all failed Meta CAPI events (max 3 retries).
 * Should be called from a cron job.
 */
async function retryFailedMetaEvents() {
    const failed = await db_1.db.query(`SELECT * FROM conversion_events
         WHERE platform = 'meta' AND status = 'failed' AND retry_count < 3
         ORDER BY created_at ASC LIMIT 50`);
    let retried = 0;
    let succeeded = 0;
    for (const event of failed.rows) {
        retried++;
        if (event.event_name === 'Purchase' && event.order_id && event.attribution_id) {
            const result = await sendMetaPurchaseEvent(event.order_id, event.attribution_id);
            if (result.ok)
                succeeded++;
        }
        else if (event.event_name === 'Lead' && event.customer_id) {
            const result = await sendMetaLeadEvent(event.customer_id, '');
            if (result.ok)
                succeeded++;
        }
    }
    return { retried, succeeded };
}
