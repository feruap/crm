import { Router, Request, Response } from 'express';
import { db } from '../db';
import { learnFromConversation } from '../ai.service';

const router = Router();

// GET /api/conversations?status=open&channel_id=...
router.get('/', async (req: Request, res: Response) => {
    const { status, channel_id, agent_id } = req.query;

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

    query += ` ORDER BY last_message_at DESC NULLS LAST`;

    const result = await db.query(query, params);
    res.json(result.rows);
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req: Request, res: Response) => {
    const result = await db.query(
        `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
        [req.params.id]
    );
    res.json(result.rows);
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
            // Fire and forget — don't block the response
            learnFromConversation(req.params.id, provider, api_key_encrypted).catch(console.error);
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

// POST /api/conversations/:id/messages  (send outbound message)
router.post('/:id/messages', async (req: Request, res: Response) => {
    const { content, message_type = 'text' } = req.body;

    const conv = await db.query(
        `SELECT customer_id, channel_id FROM conversations WHERE id = $1`,
        [req.params.id]
    );
    if (conv.rows.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }

    const { customer_id, channel_id } = conv.rows[0];

    const msg = await db.query(
        `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, message_type, handled_by)
         VALUES ($1, $2, $3, 'outbound', $4, $5, 'human')
         RETURNING *`,
        [req.params.id, channel_id, customer_id, content, message_type]
    );

    res.status(201).json(msg.rows[0]);
});

export default router;
