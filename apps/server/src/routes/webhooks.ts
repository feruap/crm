import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { getMedicalBotResponse } from '../ai.service';
import {
    findCampaignMapping,
    sendCampaignAutoReply,
    recordTouchpoint,
    recordUTMTouchpoint,
    MetaReferral,
} from '../services/campaign-responder';
import { receiveStatusFromWC } from '../services/woocommerce';
import { evaluateEscalation, executeHandoff } from '../services/escalation-engine';
import { analyzeCustomerHistory } from '../services/purchase-history-engine';
import { handleIncomingMessage } from '../services/smart-bot-engine';

const router = Router();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function validateMetaSignature(req: Request, secret: string): boolean {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) return false;
    const expected = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function resolveOrCreateCustomer(
    provider: string,
    providerId: string,
    displayName: string
): Promise<string> {
    const existing = await db.query(
        `SELECT customer_id FROM external_identities WHERE provider = $1 AND provider_id = $2`,
        [provider, providerId]
    );
    if (existing.rows.length > 0) return existing.rows[0].customer_id;

    const customer = await db.query(
        `INSERT INTO customers (display_name) VALUES ($1) RETURNING id`,
        [displayName || 'Unknown']
    );
    const customerId = customer.rows[0].id;

    await db.query(
        `INSERT INTO external_identities (customer_id, provider, provider_id) VALUES ($1, $2, $3)`,
        [customerId, provider, providerId]
    );

    return customerId;
}

async function resolveOrCreateConversation(
    customerId: string,
    channelId: string,
    referralData?: MetaReferral | null,
    utmData?: Record<string, string> | null
): Promise<{ conversationId: string; isNew: boolean }> {
    const existing = await db.query(
        `SELECT id FROM conversations
         WHERE customer_id = $1 AND channel_id = $2 AND status IN ('open', 'pending')
         ORDER BY created_at DESC LIMIT 1`,
        [customerId, channelId]
    );

    if (existing.rows.length > 0) {
        return { conversationId: existing.rows[0].id, isNew: false };
    }

    const conv = await db.query(
        `INSERT INTO conversations (customer_id, channel_id, referral_data, utm_data)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
            customerId,
            channelId,
            referralData ? JSON.stringify(referralData) : null,
            utmData ? JSON.stringify(utmData) : null,
        ]
    );

    return { conversationId: conv.rows[0].id, isNew: true };
}

async function handleBotResponse(
    conversationId: string,
    channelId: string,
    customerId: string,
    messageText: string,
    referralData?: any
): Promise<void> {
    const settings = await db.query(
        `SELECT provider, api_key_encrypted, system_prompt
         FROM ai_settings WHERE is_default = TRUE LIMIT 1`
    );
    if (settings.rows.length === 0) return;

    const { provider, api_key_encrypted, system_prompt } = settings.rows[0];

    try {
        // Count existing messages to detect first message
        const msgCount = await db.query(
            `SELECT COUNT(*) AS cnt FROM messages
             WHERE conversation_id = $1`,
            [conversationId]
        );
        const isFirstMessage = parseInt(msgCount.rows[0].cnt, 10) === 1;  // 1 because we just inserted the inbound

        // ── SMART BOT ENGINE: Unified message handling ──
        const botReply = await handleIncomingMessage({
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
                };

                const handoff = await executeHandoff(
                    conversationId, customerId, escalation, provider, api_key_encrypted
                );

                const agentNote = handoff.agent_id
                    ? 'Un asesor se comunicará con usted en breve.'
                    : 'Estamos buscando un asesor disponible, por favor espere un momento.';

                const handoffMessage = `${botReply.message} ${agentNote}`;

                await db.query(
                    `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by, bot_confidence, bot_action)
                     VALUES ($1, $2, $3, 'outbound', $4, 'bot', $5, 'escalation')`,
                    [conversationId, channelId, customerId, handoffMessage, botReply.confidence]
                );

                console.log(`[Smart Bot Escalation] Conv ${conversationId}: ${botReply.routing_decision.reason}`);
            } catch (err) {
                console.error('[Escalation execution error]:', err);
                // Escalation failed — send just the bot message without agent note
                await db.query(
                    `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by, bot_confidence, bot_action)
                     VALUES ($1, $2, $3, 'outbound', $4, 'bot', $5, 'escalation')`,
                    [conversationId, channelId, customerId, botReply.message, botReply.confidence]
                );
            }
            return; // Always return after escalation — never fall through to normal reply
        }

        // Send normal bot reply
        await db.query(
            `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by, bot_confidence, bot_action)
             VALUES ($1, $2, $3, 'outbound', $4, 'bot', $5, $6)`,
            [conversationId, channelId, customerId, botReply.message, botReply.confidence, botReply.intent_type.toLowerCase()]
        );

        console.log(`[Smart Bot] Conv ${conversationId}: ${botReply.intent_type} (confidence: ${botReply.confidence})`);
    } catch (err) {
        console.error('[Bot Response Error]:', err);
        // Fallback to simple error message
        await db.query(
            `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by)
             VALUES ($1, $2, $3, 'outbound', $4, 'bot')`,
            [conversationId, channelId, customerId, 'Disculpe, hubo un error. Un asesor lo contactará en breve.']
        );
    }
}

/**
 * Handle campaign auto-reply for new conversations from ads
 * Returns true if an auto-reply was sent
 */
async function handleCampaignAutoReply(
    conversationId: string,
    channelId: string,
    customerId: string,
    referral: MetaReferral,
    channel: string
): Promise<boolean> {
    try {
        // Record the touchpoint regardless
        await recordTouchpoint(customerId, null, referral, channel);

        // Find campaign mapping for auto-reply
        const mapping = await findCampaignMapping(referral);
        if (!mapping) return false;

        // Create attribution link
        await db.query(
            `INSERT INTO attributions (customer_id, campaign_id, conversation_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [customerId, mapping.campaign_id, conversationId]
        );

        // Send the auto-reply
        await sendCampaignAutoReply(conversationId, channelId, customerId, mapping);

        console.log(`[Campaign Auto-Reply] Sent for campaign "${mapping.campaign_name}" to conversation ${conversationId}`);
        return true;
    } catch (err) {
        console.error('[Campaign Auto-Reply] Error:', err);
        return false;
    }
}

// ─────────────────────────────────────────────
// Meta Webhook Verification (GET)
// ─────────────────────────────────────────────
router.get('/meta', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// ─────────────────────────────────────────────
// Meta Webhook (POST) — Facebook & Instagram messages
// Now with campaign detection and auto-reply
// ─────────────────────────────────────────────
router.post('/meta', async (req: Request, res: Response) => {
    res.sendStatus(200);

    try {
        const channel = await db.query(
            `SELECT id, webhook_secret, provider FROM channels
             WHERE provider IN ('facebook', 'instagram') AND is_active = TRUE LIMIT 1`
        );
        if (channel.rows.length === 0) return;

        const { id: channelId, webhook_secret, provider } = channel.rows[0];

        if (webhook_secret && !validateMetaSignature(req, webhook_secret)) {
            console.warn('Meta webhook signature mismatch — dropping');
            return;
        }

        const body = req.body;
        if (body.object !== 'page' && body.object !== 'instagram') return;

        for (const entry of body.entry ?? []) {
            for (const event of entry.messaging ?? []) {
                if (!event.message?.text) continue;

                const senderId: string = event.sender.id;
                const messageText: string = event.message.text;

                // Extract referral data if present (Click-to-DM from ads)
                const referral: MetaReferral | null = event.referral || event.message?.referral || null;

                const customerId = await resolveOrCreateCustomer(provider, senderId, senderId);
                const { conversationId, isNew } = await resolveOrCreateConversation(
                    customerId, channelId, referral
                );

                // Save inbound message
                await db.query(
                    `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, provider_message_id)
                     VALUES ($1, $2, $3, 'inbound', $4, $5)`,
                    [conversationId, channelId, customerId, messageText, event.message.mid]
                );

                // Record attribution touchpoint if this is an ad click
                if (referral && referral.ad_id && isNew) {
                    recordTouchpoint(customerId, null, referral, provider).catch(err =>
                        console.error('[Touchpoint Recording Error]:', err)
                    );
                }

                // Smart bot engine handles campaign auto-reply, qualification, and routing
                handleBotResponse(conversationId, channelId, customerId, messageText, referral).catch(console.error);
            }
        }
    } catch (err) {
        console.error('Meta webhook error:', err);
    }
});

// ─────────────────────────────────────────────
// WhatsApp Cloud API Webhook Verification (GET)
// ─────────────────────────────────────────────
router.get('/whatsapp', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        console.log('[WhatsApp Webhook] Verification successful');
        res.status(200).send(challenge);
    } else {
        console.warn('[WhatsApp Webhook] Verification failed');
        res.sendStatus(403);
    }
});

// ─────────────────────────────────────────────
// WhatsApp Cloud API Webhook (POST)
// Now with referral/campaign detection
// ─────────────────────────────────────────────
router.post('/whatsapp', async (req: Request, res: Response) => {
    res.sendStatus(200);

    try {
        const channel = await db.query(
            `SELECT id, webhook_secret FROM channels WHERE provider = 'whatsapp' AND is_active = TRUE LIMIT 1`
        );
        if (channel.rows.length === 0) return;

        const { id: channelId, webhook_secret } = channel.rows[0];

        if (webhook_secret && !validateMetaSignature(req, webhook_secret)) {
            console.warn('WhatsApp webhook signature mismatch — dropping');
            return;
        }

        const changes = req.body?.entry?.[0]?.changes?.[0]?.value;
        if (!changes?.messages) return;

        for (const msg of changes.messages) {
            if (msg.type !== 'text') continue;

            const phone: string = msg.from;
            const messageText: string = msg.text.body;
            const displayName: string = changes.contacts?.[0]?.profile?.name || phone;

            // WhatsApp Click-to-WhatsApp ads include referral
            const referral: MetaReferral | null = msg.referral || null;

            const customerId = await resolveOrCreateCustomer('whatsapp', phone, displayName);
            const { conversationId, isNew } = await resolveOrCreateConversation(
                customerId, channelId, referral
            );

            await db.query(
                `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, provider_message_id)
                 VALUES ($1, $2, $3, 'inbound', $4, $5)`,
                [conversationId, channelId, customerId, messageText, msg.id]
            );

            // Smart bot engine handles all message routing and responses
            handleBotResponse(conversationId, channelId, customerId, messageText, referral).catch(console.error);
        }
    } catch (err) {
        console.error('WhatsApp webhook error:', err);
    }
});

// ─────────────────────────────────────────────
// WooCommerce Webhook — Order Status Changes
// Receives status updates from WC and syncs to CRM
// ─────────────────────────────────────────────
router.post('/woocommerce-status', async (req: Request, res: Response) => {
    // WooCommerce sends a webhook secret in the header
    const wcWebhookSecret = process.env.WC_WEBHOOK_SECRET;
    if (wcWebhookSecret) {
        const signature = req.headers['x-wc-webhook-signature'] as string;
        if (signature) {
            const expected = crypto
                .createHmac('sha256', wcWebhookSecret)
                .update(JSON.stringify(req.body))
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
        const result = await receiveStatusFromWC(externalOrderId, newStatus);

        if (result.ok) {
            console.log(`[WC→CRM Sync] Order #${externalOrderId} → ${newStatus}`);
        } else {
            console.error(`[WC→CRM Sync] Error for order #${externalOrderId}:`, result.error);
        }

        // Also sync order data if it doesn't exist in CRM
        const existingOrder = await db.query(
            `SELECT id FROM orders WHERE external_order_id = $1`,
            [externalOrderId]
        );

        if (existingOrder.rows.length === 0 && order.total) {
            // Create order in CRM
            const customerEmail = order.billing?.email;
            let customerId: string | null = null;

            if (customerEmail) {
                const customer = await db.query(
                    `SELECT c.id FROM customers c
                     JOIN customer_attributes ca ON ca.customer_id = c.id
                     WHERE ca.key = 'email' AND ca.value = $1
                     LIMIT 1`,
                    [customerEmail]
                );
                if (customer.rows.length > 0) {
                    customerId = customer.rows[0].id;
                }
            }

            await db.query(
                `INSERT INTO orders (external_order_id, customer_id, total_amount, currency, status, items, order_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (external_order_id) DO UPDATE
                     SET status = EXCLUDED.status, total_amount = EXCLUDED.total_amount`,
                [
                    externalOrderId,
                    customerId,
                    order.total,
                    order.currency?.toUpperCase() || 'MXN',
                    newStatus,
                    JSON.stringify(order.line_items || []),
                    order.date_created || new Date().toISOString(),
                ]
            );
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('WooCommerce webhook error:', err);
        res.sendStatus(500);
    }
});

// ─────────────────────────────────────────────
// Webchat — Receive messages from livechat widget
// ─────────────────────────────────────────────
router.post('/webchat', async (req: Request, res: Response) => {
    try {
        const { contact_id, name, message } = req.body;

        if (!contact_id || !message) {
            res.status(400).json({ error: 'contact_id and message are required' });
            return;
        }

        // Find or create webchat channel
        let channel = await db.query(
            `SELECT id FROM channels WHERE provider = 'webchat' AND is_active = TRUE LIMIT 1`
        );
        if (channel.rows.length === 0) {
            // Auto-create webchat channel
            channel = await db.query(
                `INSERT INTO channels (name, provider, is_active)
                 VALUES ('Chat Web', 'webchat', TRUE)
                 RETURNING id`
            );
        }
        const channelId = channel.rows[0].id;

        // Resolve or create customer from contact_id
        const customerId = await resolveOrCreateCustomer('webchat', contact_id, name || 'Usuario Web');

        // Resolve or create conversation
        const { conversationId, isNew } = await resolveOrCreateConversation(customerId, channelId);

        // Save inbound message
        const msgResult = await db.query(
            `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content)
             VALUES ($1, $2, $3, 'inbound', $4) RETURNING id`,
            [conversationId, channelId, customerId, message]
        );

        // Emit via Socket.io so CRM inbox updates in real-time
        try {
            const { emitNewMessage, emitAlert } = await import('../socket');
            emitNewMessage(conversationId, {
                conversation_id: conversationId,
                message: {
                    id: msgResult.rows[0].id,
                    content: message,
                    direction: 'inbound',
                    handled_by: null,
                }
            });
            // Also emit a general alert for the inbox
            emitAlert({
                type: 'new_conversation',
                conversation_id: conversationId,
                customer_name: name || 'Usuario Web',
                channel: 'webchat',
            });
        } catch (socketErr) {
            console.error('[Webchat] Socket emit error:', socketErr);
        }

        console.log(`[Webchat] Message from ${name || contact_id} in conv ${conversationId}`);

        // Send bot response asynchronously
        handleBotResponse(conversationId, channelId, customerId, message).catch(console.error);

        res.json({ ok: true, conversationId });
    } catch (err) {
        console.error('Webchat webhook error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────
// Webchat — Receive UTM data from chat widget
// Called when a webchat session starts with UTM params
// ─────────────────────────────────────────────
router.post('/webchat-utm', async (req: Request, res: Response) => {
    try {
        const { customer_id, conversation_id, utm_data } = req.body;

        if (!customer_id || !utm_data) {
            res.status(400).json({ error: 'customer_id and utm_data are required' });
            return;
        }

        // Save UTM data on the conversation
        if (conversation_id) {
            await db.query(
                `UPDATE conversations SET utm_data = $1 WHERE id = $2`,
                [JSON.stringify(utm_data), conversation_id]
            );
        }

        // Record touchpoint
        await recordUTMTouchpoint(customer_id, utm_data);

        res.json({ ok: true });
    } catch (err) {
        console.error('Webchat UTM error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
export { handleBotResponse };
