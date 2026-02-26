import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { findBestAnswer, generateEmbedding, getAIResponse, recordKnowledgeUse } from '../ai.service';

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
    // Find existing identity
    const existing = await db.query(
        `SELECT customer_id FROM external_identities WHERE provider = $1 AND provider_id = $2`,
        [provider, providerId]
    );
    if (existing.rows.length > 0) return existing.rows[0].customer_id;

    // Create new customer + identity
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
    channelId: string
): Promise<string> {
    const existing = await db.query(
        `SELECT id FROM conversations
         WHERE customer_id = $1 AND channel_id = $2 AND status IN ('open', 'pending')
         ORDER BY created_at DESC LIMIT 1`,
        [customerId, channelId]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;

    const conv = await db.query(
        `INSERT INTO conversations (customer_id, channel_id) VALUES ($1, $2) RETURNING id`,
        [customerId, channelId]
    );
    return conv.rows[0].id;
}

async function handleBotResponse(
    conversationId: string,
    channelId: string,
    customerId: string,
    messageText: string
): Promise<void> {
    const settings = await db.query(
        `SELECT provider, api_key_encrypted, system_prompt
         FROM ai_settings WHERE is_default = TRUE LIMIT 1`
    );
    if (settings.rows.length === 0) return;

    const { provider, api_key_encrypted, system_prompt } = settings.rows[0];

    // Try knowledge base first
    const embedding = await generateEmbedding(messageText, provider, api_key_encrypted);
    const knowledgeHit = await findBestAnswer(messageText, embedding);

    let botReply: string;
    let confidence: number;

    if (knowledgeHit) {
        botReply = knowledgeHit.answer;
        confidence = knowledgeHit.confidence;
        await recordKnowledgeUse(knowledgeHit.knowledgeId);
    } else {
        // Fall back to live AI generation
        botReply = await getAIResponse(provider, system_prompt || '', messageText, api_key_encrypted);
        confidence = 0.5;
    }

    await db.query(
        `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by, bot_confidence)
         VALUES ($1, $2, $3, 'outbound', $4, 'bot', $5)`,
        [conversationId, channelId, customerId, botReply, confidence]
    );
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
// ─────────────────────────────────────────────
router.post('/meta', async (req: Request, res: Response) => {
    // Always acknowledge immediately to avoid Meta retries
    res.sendStatus(200);

    try {
        const channel = await db.query(
            `SELECT id, webhook_secret FROM channels WHERE provider IN ('facebook', 'instagram') AND is_active = TRUE LIMIT 1`
        );
        if (channel.rows.length === 0) return;

        const { id: channelId, webhook_secret } = channel.rows[0];

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

                const customerId = await resolveOrCreateCustomer('facebook', senderId, senderId);
                const conversationId = await resolveOrCreateConversation(customerId, channelId);

                // Save inbound message
                await db.query(
                    `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, provider_message_id)
                     VALUES ($1, $2, $3, 'inbound', $4, $5)`,
                    [conversationId, channelId, customerId, messageText, event.message.mid]
                );

                // Bot response (async, non-blocking)
                handleBotResponse(conversationId, channelId, customerId, messageText).catch(console.error);
            }
        }
    } catch (err) {
        console.error('Meta webhook error:', err);
    }
});

// ─────────────────────────────────────────────
// WhatsApp Cloud API Webhook (POST)
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

            const customerId = await resolveOrCreateCustomer('whatsapp', phone, displayName);
            const conversationId = await resolveOrCreateConversation(customerId, channelId);

            await db.query(
                `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, provider_message_id)
                 VALUES ($1, $2, $3, 'inbound', $4, $5)`,
                [conversationId, channelId, customerId, messageText, msg.id]
            );

            handleBotResponse(conversationId, channelId, customerId, messageText).catch(console.error);
        }
    } catch (err) {
        console.error('WhatsApp webhook error:', err);
    }
});

export default router;
