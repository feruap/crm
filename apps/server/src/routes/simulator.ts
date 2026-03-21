import { Router, Request, Response } from 'express';
import { db } from '../db';
import { emitNewMessage, emitConversationUpdated, getIO } from '../socket';
import { handleBotResponse } from './webhooks';

const router = Router();

// ── Helpers (mirrors webhooks.ts pattern) ─────────────────────────────────────

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
        [displayName || 'Cliente Simulador']
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

// ── POST /api/simulator/message ───────────────────────────────────────────────
// Inject a simulated inbound message as if a real customer sent it.
// Body: { channel_id, customer_name?, customer_phone?, content, media_url?, campaign_id? }
router.post('/message', async (req: Request, res: Response) => {
    const { channel_id, customer_name, customer_phone, content, media_url, campaign_id } = req.body;

    if (!channel_id || !content) {
        res.status(400).json({ error: 'channel_id and content are required' });
        return;
    }

    // Verify channel exists and is active
    const channelResult = await db.query(
        `SELECT id, provider FROM channels WHERE id = $1 AND is_active = TRUE`,
        [channel_id]
    );
    if (channelResult.rows.length === 0) {
        res.status(404).json({ error: 'Channel not found or inactive' });
        return;
    }
    const channelProvider: string = channelResult.rows[0].provider;

    // Normalise phone: use as the external identity provider_id
    const providerId = (customer_phone ?? '').trim() || `sim_${Date.now()}`;
    const displayName = (customer_name ?? '').trim() || 'Cliente Simulador';

    // Find or create customer via external_identities (same pattern as webhooks.ts)
    const customerId = await resolveOrCreateCustomer(channelProvider, providerId, displayName);

    // Always keep display_name in sync
    await db.query(`UPDATE customers SET display_name = $1 WHERE id = $2`, [displayName, customerId]);

    // Find or create open conversation
    let isNewConversation = false;
    let conversationId = '';
    const existing = await db.query(
        `SELECT id FROM conversations
         WHERE customer_id = $1 AND channel_id = $2 AND status IN ('open', 'pending')
         ORDER BY created_at DESC LIMIT 1`,
        [customerId, channel_id]
    );
    if (existing.rows.length > 0) {
        conversationId = existing.rows[0].id;
    } else {
        const conv = await db.query(
            `INSERT INTO conversations (customer_id, channel_id, is_simulated) VALUES ($1, $2, TRUE) RETURNING id`,
            [customerId, channel_id]
        );
        conversationId = conv.rows[0].id;
        isNewConversation = true;
    }

    // Add attribution if it's a new conversation and we have a campaign
    if (isNewConversation && campaign_id && campaign_id !== '') {
        await db.query(`INSERT INTO attributions (conversation_id, customer_id, campaign_id, source) VALUES ($1, $2, $3, 'simulator') ON CONFLICT DO NOTHING`, [conversationId, customerId, campaign_id]);
    }

    // Insert the inbound message
    const msgResult = await db.query(
        `INSERT INTO messages
             (conversation_id, channel_id, customer_id, direction, content, media_url, message_type)
         VALUES ($1, $2, $3, 'inbound', $4, $5, $6)
         RETURNING *`,
        [
            conversationId, channel_id, customerId, content,
            media_url ?? null,
            media_url ? 'image' : 'text',
        ]
    );
    const message = msgResult.rows[0];

    // Emit via Socket.io — inbox sees it instantly
    emitNewMessage(conversationId, message);
    emitConversationUpdated(conversationId, {
        last_message: content,
        last_message_at: message.created_at,
    });
    getIO().emit('conversation_list_updated', { conversation_id: conversationId });

    res.json({ conversation_id: conversationId, customer_id: customerId, message });

    // AI bot response handling
    handleBotResponse(conversationId, channel_id, customerId, content).catch(console.error);
});

// ── GET /api/simulator/messages/:conversationId ───────────────────────────────
// Return all messages (both directions) for a simulated conversation.
router.get('/messages/:conversationId', async (req: Request, res: Response) => {
    const result = await db.query(
        `SELECT id, direction, content, media_url, message_type, handled_by, created_at
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [req.params.conversationId]
    );
    res.json(result.rows);
});

// ── GET /api/simulator/conversation ──────────────────────────────────────────
// Find the current open conversation for a channel + phone combination.
router.get('/conversation', async (req: Request, res: Response) => {
    const { channel_id, customer_phone } = req.query as {
        channel_id?: string;
        customer_phone?: string;
    };

    if (!channel_id || !customer_phone) {
        res.status(400).json({ error: 'channel_id and customer_phone are required' });
        return;
    }

    // Look up via external_identities
    const result = await db.query(
        `SELECT c.id, c.status, cu.display_name AS customer_name, ei.provider_id AS phone
         FROM conversations c
         JOIN customers cu ON cu.id = c.customer_id
         JOIN external_identities ei ON ei.customer_id = c.customer_id
         WHERE c.channel_id = $1 AND ei.provider_id = $2
           AND c.status IN ('open', 'pending')
         ORDER BY c.created_at DESC LIMIT 1`,
        [channel_id, customer_phone]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ error: 'No active conversation found' });
        return;
    }
    res.json(result.rows[0]);
});

// ── GET /api/simulator/session ───────────────────────────────────────────────
// Return the active simulator session for the authenticated agent.
router.get('/session', async (req: Request, res: Response) => {
    const agentId = (req as any).agent?.agent_id;
    if (!agentId) { res.status(401).json({ error: 'Not authenticated' }); return; }

    const result = await db.query(
        `SELECT conversation_id, channel_id, customer_name, customer_phone, campaign_id, updated_at
         FROM simulator_sessions WHERE agent_id = $1`,
        [agentId]
    );

    if (result.rows.length === 0) {
        res.json(null);
        return;
    }

    // Verify conversation still exists
    const session = result.rows[0];
    if (session.conversation_id) {
        const conv = await db.query(
            `SELECT id FROM conversations WHERE id = $1`,
            [session.conversation_id]
        );
        if (conv.rows.length === 0) {
            session.conversation_id = null;
        }
    }

    res.json(session);
});

// ── POST /api/simulator/session ─────────────────────────────────────────────
// Save/update the active simulator session for the authenticated agent.
router.post('/session', async (req: Request, res: Response) => {
    const agentId = (req as any).agent?.agent_id;
    if (!agentId) { res.status(401).json({ error: 'Not authenticated' }); return; }

    const { conversation_id, channel_id, customer_name, customer_phone, campaign_id } = req.body;

    const result = await db.query(
        `INSERT INTO simulator_sessions (agent_id, conversation_id, channel_id, customer_name, customer_phone, campaign_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (agent_id) DO UPDATE SET
             conversation_id = COALESCE($2, simulator_sessions.conversation_id),
             channel_id = COALESCE($3, simulator_sessions.channel_id),
             customer_name = COALESCE($4, simulator_sessions.customer_name),
             customer_phone = COALESCE($5, simulator_sessions.customer_phone),
             campaign_id = $6,
             updated_at = NOW()
         RETURNING *`,
        [agentId, conversation_id ?? null, channel_id ?? null, customer_name ?? null, customer_phone ?? null, campaign_id ?? null]
    );
    res.json(result.rows[0]);
});

// ── DELETE /api/simulator/session ───────────────────────────────────────────
// Clear the active simulator session (for "New conversation").
router.delete('/session', async (req: Request, res: Response) => {
    const agentId = (req as any).agent?.agent_id;
    if (!agentId) { res.status(401).json({ error: 'Not authenticated' }); return; }

    await db.query(`DELETE FROM simulator_sessions WHERE agent_id = $1`, [agentId]);
    res.json({ ok: true });
});

export default router;
