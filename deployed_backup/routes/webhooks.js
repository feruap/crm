"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBotResponse = handleBotResponse;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../db");
const campaign_responder_1 = require("../services/campaign-responder");
const woocommerce_1 = require("../services/woocommerce");
const escalation_engine_1 = require("../services/escalation-engine");
const smart_bot_engine_1 = require("../services/smart-bot-engine");
const message_sender_1 = require("../services/message-sender");
const router = (0, express_1.Router)();
// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function validateMetaSignature(req, secret) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature)
        return false;
    const bodyForSig = req.rawBody || JSON.stringify(req.body);
    console.log('[SIG-DBG] rawBody?', !!req.rawBody, 'type:', typeof bodyForSig, 'len:', bodyForSig.length, 'secret-len:', secret ? secret.length : 0);
    const expected = 'sha256=' + crypto_1.default
        .createHmac('sha256', secret)
        .update(bodyForSig)
        .digest('hex');
    console.log('[SIG-DBG] got:', (req.headers['x-hub-signature-256']||'').slice(0,30), 'exp:', expected.slice(0,30));
    return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
async function resolveOrCreateCustomer(provider, providerId, displayName) {
    const existing = await db_1.db.query(`SELECT customer_id FROM external_identities WHERE provider = $1 AND provider_id = $2`, [provider, providerId]);
    if (existing.rows.length > 0)
        return existing.rows[0].customer_id;
    const customer = await db_1.db.query(`INSERT INTO customers (display_name) VALUES ($1) RETURNING id`, [displayName || 'Unknown']);
    const customerId = customer.rows[0].id;
    await db_1.db.query(`INSERT INTO external_identities (customer_id, provider, provider_id) VALUES ($1, $2, $3)`, [customerId, provider, providerId]);
    return customerId;
}
/**
 * Resolve Facebook user's real name from Graph API
 * Falls back to PSID if API call fails or name is not available
 */
async function resolveFacebookProfileName(psid, accessToken) {
    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${psid}?fields=first_name,last_name,profile_pic&access_token=${accessToken}`, { method: 'GET' });
        if (!response.ok) {
            console.warn(`[FB Graph API] Failed to resolve profile for ${psid}: ${response.status}`);
            return psid;
        }
        const data = await response.json();
        const firstName = data.first_name || '';
        const lastName = data.last_name || '';
        const displayName = `${firstName} ${lastName}`.trim();
        if (!displayName) {
            return psid;
        }
        console.log(`[FB Graph API] Resolved profile for ${psid}: ${displayName}`);
        return displayName;
    }
    catch (err) {
        console.error(`[FB Graph API] Error resolving profile for ${psid}:`, err);
        return psid;
    }
}
async function resolveOrCreateConversation(customerId, channelId, referralData, utmData) {
    const existing = await db_1.db.query(`SELECT id FROM conversations
         WHERE customer_id = $1 AND channel_id = $2 AND status IN ('open', 'pending')
         ORDER BY created_at DESC LIMIT 1`, [customerId, channelId]);
    if (existing.rows.length > 0) {
        return { conversationId: existing.rows[0].id, isNew: false };
    }
    const conv = await db_1.db.query(`INSERT INTO conversations (customer_id, channel_id, referral_data, utm_data)
         VALUES ($1, $2, $3, $4) RETURNING id`, [
        customerId,
        channelId,
        referralData ? JSON.stringify(referralData) : null,
        utmData ? JSON.stringify(utmData) : null,
    ]);
    return { conversationId: conv.rows[0].id, isNew: true };
}
async function handleBotResponse(conversationId, channelId, customerId, messageText, referralData) {
    const settings = await db_1.db.query(`SELECT provider, api_key_encrypted, system_prompt
         FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
    if (settings.rows.length === 0)
        return;
    const { provider, api_key_encrypted, system_prompt } = settings.rows[0];
    try {
        // Count existing messages to detect first message
        const msgCount = await db_1.db.query(`SELECT COUNT(*) AS cnt FROM messages
             WHERE conversation_id = $1`, [conversationId]);
        const isFirstMessage = parseInt(msgCount.rows[0].cnt, 10) === 1; // 1 because we just inserted the inbound
        // ── SMART BOT ENGINE: Unified message handling ──
        const botReply = await (0, smart_bot_engine_1.handleIncomingMessage)({
            conversationId,
            customerId,
            message: messageText,
            channelType: 'messenger',
            referralData,
            isFirstMessage,
            aiProvider: provider,
            apiKey: api_key_encrypted,
        });
        // Handle escalation if needed
        if (botReply.action_type === 'escalate' && botReply.routing_decision?.should_escalate) {
            try {
                const escalation = {
                    shouldEscalate: true,
                    reason: botReply.routing_decision.reason,
                    rule: {
                        id: 0,
                        name: `Smart Bot: ${botReply.intent_type}`,
                        condition_type: botReply.intent_type.toLowerCase(),
                        target_type: botReply.routing_decision.target_type === 'bot' ? 'any_available' : botReply.routing_decision.target_type,
                        target_id: null,
                        target_role: botReply.routing_decision.target_type === 'sales_agent' ? 'sales' : botReply.routing_decision.target_type === 'senior_agent' ? 'senior' : null,
                        generate_summary: true,
                        escalation_message: null,
                    },
                };
                const handoff = await (0, escalation_engine_1.executeHandoff)(conversationId, customerId, escalation, provider, api_key_encrypted);
                // Bot message already includes contextual info — only add agent availability note if no agent found
                const agentNote = handoff.agent_id
                    ? ''
                    : ' Estamos buscando un asesor disponible.';
                const handoffMessage = `${botReply.message}${agentNote}`;
                { const _escMsg = await db_1.db.query(`INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by, bot_confidence, bot_action)
                     VALUES ($1, $2, $3, 'outbound', $4, 'bot', $5, 'escalation') RETURNING id`, [conversationId, channelId, customerId, handoffMessage, botReply.confidence]);
                const _escDelivery = await (0, message_sender_1.deliverMessage)(_escMsg.rows[0].id, conversationId, customerId, channelId, handoffMessage);
                if (!_escDelivery.ok) console.error('[Smart Bot Escalation] Delivery failed:', _escDelivery.error);
                console.log(`[Smart Bot Escalation] Conv ${conversationId}: ${botReply.routing_decision.reason}`); }
                return;
            }
            catch (err) {
                console.error('[Escalation execution error]:', err);
            }
        }
        // Send normal bot reply
        { const _botMsg = await db_1.db.query(`INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by, bot_confidence, bot_action)
             VALUES ($1, $2, $3, 'outbound', $4, 'bot', $5, $6) RETURNING id`, [conversationId, channelId, customerId, botReply.message, botReply.confidence, botReply.intent_type.toLowerCase()]);
        const _botDelivery = await (0, message_sender_1.deliverMessage)(_botMsg.rows[0].id, conversationId, customerId, channelId, botReply.message);
        if (!_botDelivery.ok) console.error('[Smart Bot] Delivery failed:', _botDelivery.error);
        console.log(`[Smart Bot] Conv ${conversationId}: ${botReply.intent_type} (confidence: ${botReply.confidence})`); }
    }
    catch (err) {
        console.error('[Bot Response Error]:', err);
        // Fallback to simple error message
        { const _errMsg = await db_1.db.query(`INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by)
             VALUES ($1, $2, $3, 'outbound', $4, 'bot') RETURNING id`, [conversationId, channelId, customerId, 'Disculpe, hubo un error. Un asesor lo contactará en breve.']);
        const _errContent = 'Disculpe, hubo un error. Un asesor lo contactará en breve.';
        const _errDelivery = await (0, message_sender_1.deliverMessage)(_errMsg.rows[0].id, conversationId, customerId, channelId, _errContent);
        if (!_errDelivery.ok) console.error('[Bot Error Fallback] Delivery failed:', _errDelivery.error); }
    }
}
/**
 * Handle campaign auto-reply for new conversations from ads
 * Returns true if an auto-reply was sent
 */
async function handleCampaignAutoReply(conversationId, channelId, customerId, referral, channel) {
    try {
        // Record the touchpoint regardless
        await (0, campaign_responder_1.recordTouchpoint)(customerId, null, referral, channel);
        // Find campaign mapping for auto-reply
        const mapping = await (0, campaign_responder_1.findCampaignMapping)(referral);
        if (!mapping)
            return false;
        // Create attribution link
        await db_1.db.query(`INSERT INTO attributions (customer_id, campaign_id, conversation_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`, [customerId, mapping.campaign_id, conversationId]);
        // Send the auto-reply
        await (0, campaign_responder_1.sendCampaignAutoReply)(conversationId, channelId, customerId, mapping);
        console.log(`[Campaign Auto-Reply] Sent for campaign "${mapping.campaign_name}" to conversation ${conversationId}`);
        return true;
    }
    catch (err) {
        console.error('[Campaign Auto-Reply] Error:', err);
        return false;
    }
}
// ─────────────────────────────────────────────
// Meta Webhook Verification (GET)
// ─────────────────────────────────────────────
router.get('/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    }
    else {
        res.sendStatus(403);
    }
});
// ─────────────────────────────────────────────
// Meta Webhook (POST) — Facebook & Instagram messages
// Now with campaign detection and auto-reply
// ─────────────────────────────────────────────
router.post('/meta', async (req, res) => {
    res.sendStatus(200);
    try {
        // Validate signature using any active Meta channel's webhook_secret
        const anyChannel = await db_1.db.query(`SELECT webhook_secret FROM channels
             WHERE provider IN ('facebook', 'instagram') AND is_active = TRUE AND webhook_secret IS NOT NULL LIMIT 1`);
        if (anyChannel.rows.length > 0 && anyChannel.rows[0].webhook_secret) {
            if (!validateMetaSignature(req, anyChannel.rows[0].webhook_secret)) {
                console.warn('Meta webhook signature mismatch — dropping');
                return;
            }
        }
        const body = req.body;
        if (body.object !== 'page' && body.object !== 'instagram')
            return;
        for (const entry of body.entry ?? []) {
            const pageId = entry.id; // The page ID from Meta webhook payload
            // Find the channel matching this page_id
            const channel = await db_1.db.query(`SELECT id, provider, subtype, provider_config FROM channels
                 WHERE provider IN ('facebook', 'instagram') AND is_active = TRUE
                   AND provider_config->>'page_id' = $1
                 ORDER BY CASE WHEN subtype = 'messenger' THEN 0 WHEN subtype = 'chat' THEN 0 ELSE 1 END
                 LIMIT 1`, [pageId]);
            if (channel.rows.length === 0) {
                console.warn(`[Meta Webhook] No channel found for page_id ${pageId} — skipping`);
                continue;
            }
            const { id: channelId, provider, provider_config } = channel.rows[0];
            const accessToken = provider_config?.access_token;
            for (const event of entry.messaging ?? []) {
                if (!event.message?.text)
                    continue;
                const senderId = event.sender.id;
                const messageText = event.message.text;
                // Extract referral data if present (Click-to-DM from ads)
                const referral = event.referral || event.message?.referral || null;
                // Resolve Facebook profile name if we have an access token
                let displayName = senderId;
                if (accessToken) {
                    displayName = await resolveFacebookProfileName(senderId, accessToken);
                }
                const customerId = await resolveOrCreateCustomer(provider, senderId, displayName);
                const { conversationId, isNew } = await resolveOrCreateConversation(customerId, channelId, referral);
                // Save inbound message
                await db_1.db.query(`INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, provider_message_id)
                     VALUES ($1, $2, $3, 'inbound', $4, $5)`, [conversationId, channelId, customerId, messageText, event.message.mid]);
                // Smart bot engine handles campaign auto-reply, qualification, and routing
                handleBotResponse(conversationId, channelId, customerId, messageText, referral).catch(console.error);
            }
        }
    }
    catch (err) {
        console.error('Meta webhook error:', err);
    }
});
// ─────────────────────────────────────────────
// WhatsApp Cloud API Webhook Verification (GET)
// ─────────────────────────────────────────────
router.get('/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        console.log('[WhatsApp Webhook] Verification successful');
        res.status(200).send(challenge);
    }
    else {
        console.warn('[WhatsApp Webhook] Verification failed');
        res.sendStatus(403);
    }
});
// ─────────────────────────────────────────────
// WhatsApp Cloud API Webhook (POST)
// Now with referral/campaign detection
// ─────────────────────────────────────────────
router.post('/whatsapp', async (req, res) => {
    res.sendStatus(200);
    try {
        const channel = await db_1.db.query(`SELECT id, webhook_secret FROM channels WHERE provider = 'whatsapp' AND is_active = TRUE LIMIT 1`);
        if (channel.rows.length === 0)
            return;
        const { id: channelId, webhook_secret } = channel.rows[0];
        if (webhook_secret && !validateMetaSignature(req, webhook_secret)) {
            console.warn('WhatsApp webhook signature mismatch — dropping');
            return;
        }
        const changes = req.body?.entry?.[0]?.changes?.[0]?.value;
        if (!changes?.messages)
            return;
        for (const msg of changes.messages) {
            if (msg.type !== 'text')
                continue;
            const phone = msg.from;
            const messageText = msg.text.body;
            const displayName = changes.contacts?.[0]?.profile?.name || phone;
            // WhatsApp Click-to-WhatsApp ads include referral
            const referral = msg.referral || null;
            const customerId = await resolveOrCreateCustomer('whatsapp', phone, displayName);
            const { conversationId, isNew } = await resolveOrCreateConversation(customerId, channelId, referral);
            await db_1.db.query(`INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, provider_message_id)
                 VALUES ($1, $2, $3, 'inbound', $4, $5)`, [conversationId, channelId, customerId, messageText, msg.id]);
            // Smart bot engine handles all message routing and responses
            handleBotResponse(conversationId, channelId, customerId, messageText, referral).catch(console.error);
        }
    }
    catch (err) {
        console.error('WhatsApp webhook error:', err);
    }
});
// ─────────────────────────────────────────────
// WooCommerce Webhook — Order Status Changes
// Receives status updates from WC and syncs to CRM
// ─────────────────────────────────────────────
router.post('/woocommerce-status', async (req, res) => {
    // WooCommerce sends a webhook secret in the header
    const wcWebhookSecret = process.env.WC_WEBHOOK_SECRET;
    if (wcWebhookSecret) {
        const signature = req.headers['x-wc-webhook-signature'];
        if (signature) {
            const expected = crypto_1.default
                .createHmac('sha256', wcWebhookSecret)
                .update(req.rawBody || JSON.stringify(req.body))
                .digest('base64');
            if (signature !== expected) {
                console.warn('WooCommerce webhook signature mismatch — dropping');
                res.sendStatus(401);
                return;
            }
        }
    }
    try {
        const order = req.body;
        // WooCommerce sends the full order object
        if (!order.id || !order.status) {
            res.sendStatus(200); // Acknowledge but ignore (might be a test ping)
            return;
        }
        const externalOrderId = String(order.id);
        const newStatus = order.status;
        // Receive and sync the status change
        const result = await (0, woocommerce_1.receiveStatusFromWC)(externalOrderId, newStatus);
        if (result.ok) {
            console.log(`[WC→CRM Sync] Order #${externalOrderId} → ${newStatus}`);
        }
        else {
            console.error(`[WC→CRM Sync] Error for order #${externalOrderId}:`, result.error);
        }
        // Also sync order data if it doesn't exist in CRM
        const existingOrder = await db_1.db.query(`SELECT id FROM orders WHERE external_order_id = $1`, [externalOrderId]);
        if (existingOrder.rows.length === 0 && order.total) {
            // Create order in CRM
            const customerEmail = order.billing?.email;
            let customerId = null;
            if (customerEmail) {
                const customer = await db_1.db.query(`SELECT c.id FROM customers c
                     JOIN customer_attributes ca ON ca.customer_id = c.id
                     WHERE ca.key = 'email' AND ca.value = $1
                     LIMIT 1`, [customerEmail]);
                if (customer.rows.length > 0) {
                    customerId = customer.rows[0].id;
                }
            }
            await db_1.db.query(`INSERT INTO orders (external_order_id, customer_id, total_amount, currency, status, items, order_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (external_order_id) DO UPDATE
                     SET status = EXCLUDED.status, total_amount = EXCLUDED.total_amount`, [
                externalOrderId,
                customerId,
                order.total,
                order.currency?.toUpperCase() || 'MXN',
                newStatus,
                JSON.stringify(order.line_items || []),
                order.date_created || new Date().toISOString(),
            ]);
        }
        res.sendStatus(200);
    }
    catch (err) {
        console.error('WooCommerce webhook error:', err);
        res.sendStatus(500);
    }
});
// ─────────────────────────────────────────────
// Webchat — Receive UTM data from chat widget
// Called when a webchat session starts with UTM params
// ─────────────────────────────────────────────
router.post('/webchat-utm', async (req, res) => {
    try {
        const { customer_id, conversation_id, utm_data } = req.body;
        if (!customer_id || !utm_data) {
            res.status(400).json({ error: 'customer_id and utm_data are required' });
            return;
        }
        // Save UTM data on the conversation
        if (conversation_id) {
            await db_1.db.query(`UPDATE conversations SET utm_data = $1 WHERE id = $2`, [JSON.stringify(utm_data), conversation_id]);
        }
        // Record touchpoint
        await (0, campaign_responder_1.recordUTMTouchpoint)(customer_id, utm_data);
        res.json({ ok: true });
    }
    catch (err) {
        console.error('Webchat UTM error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
