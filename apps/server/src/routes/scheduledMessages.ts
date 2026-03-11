import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// GET /api/scheduled-messages
router.get('/', async (req: Request, res: Response) => {
    const agentId = req.agent?.agentId;
    const result = await db.query(
        `SELECT sm.*, c.customer_id, cu.display_name as customer_name
         FROM scheduled_messages sm
         JOIN conversations c ON c.id = sm.conversation_id
         JOIN customers cu ON cu.id = c.customer_id
         WHERE sm.agent_id = $1 AND sm.status = 'pending'
         ORDER BY sm.scheduled_at ASC`,
        [agentId]
    );
    res.json(result.rows);
});

// POST /api/scheduled-messages
router.post('/', async (req: Request, res: Response) => {
    const { conversation_id, content, scheduled_at, media_url } = req.body;
    const agentId = req.agent?.agentId;

    if (!conversation_id || !content || !scheduled_at) {
        res.status(400).json({ error: 'conversation_id, content and scheduled_at are required' });
        return;
    }

    // Get channel_id from conversation
    const conv = await db.query('SELECT channel_id FROM conversations WHERE id = $1', [conversation_id]);
    if (conv.rows.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }
    const channelId = conv.rows[0].channel_id;

    const result = await db.query(
        `INSERT INTO scheduled_messages (conversation_id, agent_id, channel_id, content, media_url, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [conversation_id, agentId, channelId, content, media_url, scheduled_at]
    );

    res.status(201).json(result.rows[0]);
});

// DELETE /api/scheduled-messages/:id
router.delete('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const agentId = req.agent?.agentId;
    const isAdmin = req.agent?.role === 'admin';

    const existing = await db.query('SELECT agent_id FROM scheduled_messages WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Message not found' });
        return;
    }

    if (existing.rows[0].agent_id !== agentId && !isAdmin) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    await db.query(
        "UPDATE scheduled_messages SET status = 'cancelled' WHERE id = $1",
        [id]
    );
    res.json({ ok: true });
});

export default router;
