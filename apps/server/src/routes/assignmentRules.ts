import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/assignment-rules
router.get('/', async (req: Request, res: Response) => {
    const result = await db.query('SELECT * FROM assignment_rules ORDER BY created_at DESC');
    res.json(result.rows);
});

// POST /api/assignment-rules
router.post('/', async (req: Request, res: Response) => {
    const { name, channel_id, team_id, strategy, agent_ids, is_active = true } = req.body;

    if (!name || (!team_id && !agent_ids)) {
        res.status(400).json({ error: 'Name and (team_id or agent_ids) are required' });
        return;
    }

    const result = await db.query(
        `INSERT INTO assignment_rules (name, channel_id, team_id, strategy, agent_ids, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, channel_id, team_id, strategy || 'round_robin', agent_ids || '{}', is_active]
    );

    res.status(201).json(result.rows[0]);
});

// PATCH /api/assignment-rules/:id
router.patch('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, is_active, strategy, agent_ids } = req.body;

    const result = await db.query(
        `UPDATE assignment_rules 
         SET name = COALESCE($1, name),
             is_active = COALESCE($2, is_active),
             strategy = COALESCE($3, strategy),
             agent_ids = COALESCE($4, agent_ids)
         WHERE id = $5
         RETURNING *`,
        [name, is_active, strategy, agent_ids, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
});

// DELETE /api/assignment-rules/:id
router.delete('/:id', async (req: Request, res: Response) => {
    await db.query('DELETE FROM assignment_rules WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
});

export default router;
