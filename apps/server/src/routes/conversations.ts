import { Router, Request, Response } from 'express';
import { db } from '../db';
import { learnFromConversation } from '../ai.service';
import { deliverMessage } from '../services/message-sender';

const router = Router();

// GET /api/conversations?status=open&channel_id=...&scoped_agent_id=...
router.get('/', async (req: Request, res: Response) => {
    const { status, channel_id, agent_id, scoped_agent_id, search } = req.query;

    let query = `
        SELECT c.*, cu.display_name AS customer_name,
               a.name AS agent_name,
               ch.name AS channel_name, ch.provider AS channel_provider,
               (SELECT content FROM messages m WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC LIMIT 1) AS last_message,
               (SELECT created_at FROM messages m WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
               (SELECT COUNT(*) FROM messages m
                WHERE m.conversation_id = c.id AND m.is_read = FALSE
                AND m.direction = 'inbound') AS unread_count
        FROM conversations c
        JOIN customers cu ON cu.id = c.customer_id
        LEFT JOIN agents a ON a.id = c.assigned_agent_id
        LEFT JOIN channels ch ON ch.id = c.channel_id
        WHERE 1=1
    `;
    const params: unknown[] = [];

    if (status) {
        params.push(status);
        query += ` AND c.status = $${params.length}`;
    }
    if (channel_id) {
        params.push(channel_id);
        query += ` AND c.channel_id = $${params.length}`;
    }
    if (agent_id) {
        params.push(agent_id);
        query += ` AND c.assigned_agent_id = $${params.length}`;
    }

    // RBAC: operadores only see their own conversations
    if (scoped_agent_id) {
        params.push(scoped_agent_id);
        query += ` AND c.assigned_agent_id = $${params.length}`;
    }

    // Search by customer name
    if (search) {
        params.push(`%${search}%`);
        query += ` AND cu.display_name ILIKE $${params.length}`;
    }

    query += ` ORDER BY last_message_at DESC NULLS LAST LIMIT 100`;

    const result = await db.query(query, params);
    res.json(result.rows);
});

// GET /api/conversations/:id — Single conversation with full context
router.get('/:id', async (req: Request, res: Response) => {
    const result = await db.query(
        `SELECT c.*,
                cu.display_name AS customer_name, cu.avatar_url,
                a.name AS agent_name, a.email AS agent_email,
                ch.name AS channel_name, ch.provider AS channel_provider,
                c.handoff_summary, c.escalation_reason,
                c.referral_data, c.utm_data
         FROM conversations c
         JOIN customers cu ON cu.id = c.customer_id
         LEFT JOIN agents a ON a.id = c.assigned_agent_id
         LEFT JOIN channels ch ON ch.id = c.channel_id
         WHERE c.id = $1`,
        [req.params.id]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }

    res.json(result.rows[0]);
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req: Request, res: Response) => {
    const { after } = req.query; // For polling: only messages after this timestamp

    let query = `SELECT * FROM messages WHERE conversation_id = $1`;
    const params: unknown[] = [req.params.id];

    if (after) {
        params.push(after);
        query += ` AND created_at > $${params.length}`;
    }

    query += ` ORDER BY created_at ASC`;

    const result = await db.query(query, params);
    res.json(result.rows);
});

// GET /api/conversations/:id/context — Customer context for agent panel
router.get('/:id/context', async (req: Request, res: Response) => {
    // Get conversation info
    const conv = await db.query(
        `SELECT c.customer_id, c.channel_id, ch.provider AS channel_provider
         FROM conversations c
         LEFT JOIN channels ch ON ch.id = c.channel_id
         WHERE c.id = $1`,
        [req.params.id]
    );

    if (conv.rows.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }

    const { customer_id } = conv.rows[0];

    // Fetch all context in parallel
    const [customer, attributes, orders, profile, segments, pastConversations] = await Promise.all([
        db.query(`SELECT * FROM customers WHERE id = $1`, [customer_id]),
        db.query(`SELECT key, value FROM customer_attributes WHERE customer_id = $1`, [customer_id]),
        db.query(
            `SELECT id, external_order_id, total_amount, currency, status, items, order_date
             FROM orders WHERE customer_id = $1 ORDER BY order_date DESC LIMIT 10`,
            [customer_id]
        ),
        db.query(
            `SELECT * FROM customer_profiles WHERE customer_id = $1 LIMIT 1`,
            [customer_id]
        ).catch(() => ({ rows: [] })), // Table might not exist yet
        db.query(
            `SELECT segment_type, segment_value FROM customer_segments WHERE customer_id = $1`,
            [customer_id]
        ).catch(() => ({ rows: [] })),
        db.query(
            `SELECT id, status, created_at,
                    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
             FROM conversations c
             WHERE c.customer_id = $1 AND c.id != $2
             ORDER BY c.created_at DESC LIMIT 5`,
            [customer_id, req.params.id]
        ),
    ]);

    // Calculate lifetime value
    const lifetimeValue = orders.rows.reduce(
        (sum: number, o: { total_amount: string }) => sum + parseFloat(o.total_amount || '0'), 0
    );

    res.json({
        customer: customer.rows[0] || null,
        attributes: attributes.rows,
        orders: orders.rows,
        profile: profile.rows[0] || null,
        segments: segments.rows,
        past_conversations: pastConversations.rows,
        lifetime_value: lifetimeValue,
        total_orders: orders.rows.length,
    });
});

// POST /api/conversations/:id/messages  (send outbound message — ACTUALLY DELIVERS)
router.post('/:id/messages', async (req: Request, res: Response) => {
    const { content, message_type = 'text' } = req.body;

    if (!content?.trim()) {
        res.status(400).json({ error: 'Message content is required' });
        return;
    }

    const conv = await db.query(
        `SELECT customer_id, channel_id FROM conversations WHERE id = $1`,
        [req.params.id]
    );
    if (conv.rows.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }

    const { customer_id, channel_id } = conv.rows[0];

    // Save message to DB
    const msg = await db.query(
        `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, message_type, handled_by)
         VALUES ($1, $2, $3, 'outbound', $4, $5, 'human')
         RETURNING *`,
        [req.params.id, channel_id, customer_id, content, message_type]
    );

    const savedMsg = msg.rows[0];

    // Actually deliver the message via the channel (non-blocking)
    deliverMessage(savedMsg.id, req.params.id as string, customer_id, channel_id, content)
        .then(result => {
            if (!result.ok) {
                console.error(`[Delivery] Failed for msg ${savedMsg.id}:`, result.error);
            }
        })
        .catch(console.error);

    // Mark conversation as open if it was pending
    await db.query(
        `UPDATE conversations SET status = 'open', updated_at = NOW()
         WHERE id = $1 AND status = 'pending'`,
        [req.params.id]
    );

    res.status(201).json(savedMsg);
});

// POST /api/conversations/:id/read — Mark all messages as read
router.post('/:id/read', async (req: Request, res: Response) => {
    await db.query(
        `UPDATE messages SET is_read = TRUE
         WHERE conversation_id = $1 AND direction = 'inbound' AND is_read = FALSE`,
        [req.params.id]
    );
    res.json({ ok: true });
});

// PATCH /api/conversations/:id/status
router.patch('/:id/status', async (req: Request, res: Response) => {
    const { status } = req.body;
    const validStatuses = ['open', 'pending', 'resolved', 'snoozed'];

    if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
    }

    await db.query(
        `UPDATE conversations SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, req.params.id]
    );

    // When resolved, automatically extract knowledge from the conversation
    if (status === 'resolved') {
        const settings = await db.query(
            `SELECT provider, api_key_encrypted, system_prompt
             FROM ai_settings WHERE is_default = TRUE LIMIT 1`
        );
        if (settings.rows.length > 0) {
            const { provider, api_key_encrypted } = settings.rows[0];
            learnFromConversation(req.params.id as string, provider, api_key_encrypted).catch(console.error);
        }
    }

    res.json({ ok: true, status });
});

// PATCH /api/conversations/:id/assign
router.patch('/:id/assign', async (req: Request, res: Response) => {
    const { agent_id } = req.body;
    await db.query(
        `UPDATE conversations SET assigned_agent_id = $1, updated_at = NOW() WHERE id = $2`,
        [agent_id, req.params.id]
    );
    res.json({ ok: true });
});

export default router;
