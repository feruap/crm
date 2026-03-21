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

import crypto from 'crypto';
import { db } from '../db';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface MetaEventData {
    event_name: string;
    event_time: number; // Unix timestamp
    event_id: string;   // For dedup with browser pixel
    event_source_url?: string;
    action_source: 'website' | 'app' | 'chat' | 'other';
    user_data: {
        em?: string[];   // Hashed emails
        ph?: string[];   // Hashed phones
        fbc?: string;    // Click ID
        fbp?: string;    // Browser ID
        client_ip_address?: string;
        client_user_agent?: string;
        external_id?: string[];
    };
    custom_data?: {
        currency?: string;
        value?: number;
        order_id?: string;
        content_ids?: string[];
        content_type?: string;
        contents?: Array<{ id: string; quantity: number; item_price: number }>;
    };
}

interface CAPIResponse {
    events_received: number;
    fbtrace_id: string;
    messages?: string[];
}

// ─────────────────────────────────────────────
// Hash Utilities (Meta requires SHA-256)
// ─────────────────────────────────────────────

function hashSHA256(value: string): string {
    return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

// ─────────────────────────────────────────────
// Send Event to Meta CAPI
// ─────────────────────────────────────────────

async function sendToMetaCAPI(events: MetaEventData[]): Promise<CAPIResponse> {
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

    return response.json() as Promise<CAPIResponse>;
}

// ─────────────────────────────────────────────
// Public: Send Purchase Event
// ─────────────────────────────────────────────

/**
 * Send a Purchase conversion event to Meta CAPI.
 * Called when an order with FB attribution is marked as completed.
 */
export async function sendMetaPurchaseEvent(
    orderId: number,
    attributionId: string
): Promise<{ ok: boolean; eventId: string; error?: string }> {
    // Generate a unique event_id for dedup
    const eventId = `purchase_${orderId}_${Date.now()}`;

    try {
        // Get order + attribution + customer data
        const orderData = await db.query(
            `SELECT o.*, a.customer_id,
                    c.display_name AS customer_name
             FROM orders o
             JOIN attributions a ON a.order_id = o.id AND a.id = $1
             JOIN customers c ON c.id = a.customer_id
             WHERE o.id = $2`,
            [attributionId, orderId]
        );

        if (orderData.rows.length === 0) {
            return { ok: false, eventId, error: 'Order or attribution not found' };
        }

        const order = orderData.rows[0];

        // Get customer email/phone for matching
        const customerAttrs = await db.query(
            `SELECT key, value FROM customer_attributes
             WHERE customer_id = $1 AND key IN ('email', 'phone')`,
            [order.customer_id]
        );

        const email = customerAttrs.rows.find((a: { key: string }) => a.key === 'email')?.value;
        const phone = customerAttrs.rows.find((a: { key: string }) => a.key === 'phone')?.value;

        // Get touchpoint data (fbc, fbp)
        const touchpoint = await db.query(
            `SELECT fbc, fbp, event_source_url
             FROM attribution_touchpoints
             WHERE customer_id = $1 AND platform = 'facebook'
             ORDER BY created_at DESC LIMIT 1`,
            [order.customer_id]
        );

        const tp = touchpoint.rows[0] || {};

        // Build event
        const userData: MetaEventData['user_data'] = {
            external_id: [hashSHA256(order.customer_id)],
        };
        if (email) userData.em = [hashSHA256(email)];
        if (phone) userData.ph = [hashSHA256(phone.replace(/\D/g, ''))];
        if (tp.fbc) userData.fbc = tp.fbc;
        if (tp.fbp) userData.fbp = tp.fbp;

        // Parse order items for content_ids
        const items = order.items || [];
        const contentIds = items.map((i: { product_id?: number; name?: string }) =>
            String(i.product_id || i.name || 'unknown')
        );

        const event: MetaEventData = {
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
        await db.query(
            `INSERT INTO conversion_events
                (platform, event_name, event_id, order_id, customer_id, attribution_id,
                 event_value, currency, event_source_url, fbc, fbp, pixel_id, status)
             VALUES ('meta', 'Purchase', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')`,
            [
                eventId, orderId, order.customer_id, attributionId,
                parseFloat(order.total_amount || '0'), order.currency || 'MXN',
                tp.event_source_url || null, tp.fbc || null, tp.fbp || null,
                process.env.META_PIXEL_ID || null,
            ]
        );

        // Send to Meta
        const result = await sendToMetaCAPI([event]);

        // Update status
        await db.query(
            `UPDATE conversion_events
             SET status = 'sent', platform_response = $1, sent_at = NOW(), last_attempt_at = NOW()
             WHERE event_id = $2`,
            [JSON.stringify(result), eventId]
        );

        console.log(`[Meta CAPI] Purchase event sent for order #${order.external_order_id} ($${order.total_amount} ${order.currency})`);

        return { ok: true, eventId };
    } catch (err) {
        // Update status to failed
        await db.query(
            `UPDATE conversion_events
             SET status = 'failed', last_attempt_at = NOW(), retry_count = retry_count + 1,
                 platform_response = $1
             WHERE event_id = $2`,
            [JSON.stringify({ error: String(err) }), eventId]
        ).catch(() => {}); // Don't fail if the update fails

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
export async function sendMetaLeadEvent(
    customerId: string,
    conversationId: string,
    referralData?: { ad_id?: string; source?: string } | null
): Promise<{ ok: boolean; eventId: string; error?: string }> {
    const eventId = `lead_${conversationId}_${Date.now()}`;

    try {
        // Get touchpoint data
        const touchpoint = await db.query(
            `SELECT fbc, fbp, event_source_url
             FROM attribution_touchpoints
             WHERE customer_id = $1 AND platform = 'facebook'
             ORDER BY created_at DESC LIMIT 1`,
            [customerId]
        );
        const tp = touchpoint.rows[0] || {};

        const event: MetaEventData = {
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
        await db.query(
            `INSERT INTO conversion_events
                (platform, event_name, event_id, customer_id, fbc, fbp, status)
             VALUES ('meta', 'Lead', $1, $2, $3, $4, 'pending')`,
            [eventId, customerId, tp.fbc || null, tp.fbp || null]
        );

        // Send
        const result = await sendToMetaCAPI([event]);

        await db.query(
            `UPDATE conversion_events
             SET status = 'sent', platform_response = $1, sent_at = NOW(), last_attempt_at = NOW()
             WHERE event_id = $2`,
            [JSON.stringify(result), eventId]
        );

        console.log(`[Meta CAPI] Lead event sent for customer ${customerId}`);
        return { ok: true, eventId };
    } catch (err) {
        await db.query(
            `UPDATE conversion_events
             SET status = 'failed', last_attempt_at = NOW(), retry_count = retry_count + 1,
                 platform_response = $1
             WHERE event_id = $2`,
            [JSON.stringify({ error: String(err) }), eventId]
        ).catch(() => {});

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
export async function retryFailedMetaEvents(): Promise<{ retried: number; succeeded: number }> {
    const failed = await db.query(
        `SELECT * FROM conversion_events
         WHERE platform = 'meta' AND status = 'failed' AND retry_count < 3
         ORDER BY created_at ASC LIMIT 50`
    );

    let retried = 0;
    let succeeded = 0;

    for (const event of failed.rows) {
        retried++;

        if (event.event_name === 'Purchase' && event.order_id && event.attribution_id) {
            const result = await sendMetaPurchaseEvent(event.order_id, event.attribution_id);
            if (result.ok) succeeded++;
        } else if (event.event_name === 'Lead' && event.customer_id) {
            const result = await sendMetaLeadEvent(event.customer_id, '');
            if (result.ok) succeeded++;
        }
    }

    return { retried, succeeded };
}
