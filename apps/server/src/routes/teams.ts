import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// GET /api/teams  — list all teams with member counts
router.get('/', async (_req: Request, res: Response) => {
    const result = await db.query(`
        SELECT t.*,
               COUNT(tm.agent_id)::int AS member_count,
               JSON_AGG(
                   JSON_BUILD_OBJECT('id', a.id, 'name', a.name, 'email', a.email, 'role', a.role, 'is_active', a.is_active)
                   ORDER BY a.name
               ) FILTER (WHERE a.id IS NOT NULL) AS members
        FROM teams t
        LEFT JOIN team_members tm ON tm.team_id = t.id
        LEFT JOIN agents a ON a.id = tm.agent_id
        GROUP BY t.id
        ORDER BY t.created_at ASC
    `);
    res.json(result.rows);
});

// POST /api/teams  — create team (admin/supervisor only)
router.post('/', async (req: Request, res: Response) => {
    const { name, description, color } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'name required' }); return; }

    const result = await db.query(
        `INSERT INTO teams (name, description, color) VALUES ($1, $2, $3) RETURNING *`,
        [name.trim(), description ?? null, color ?? '#6366f1']
    );
    res.status(201).json(result.rows[0]);
});

// PATCH /api/teams/:id
router.patch('/:id', async (req: Request, res: Response) => {
    const { name, description, color } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined)        { params.push(name.trim()); sets.push(`name = $${params.length}`); }
    if (description !== undefined) { params.push(description); sets.push(`description = $${params.length}`); }
    if (color !== undefined)       { params.push(color);       sets.push(`color = $${params.length}`); }

    if (sets.length === 0) { res.status(400).json({ error: 'nothing to update' }); return; }

    params.push(req.params.id);
    const result = await db.query(
        `UPDATE teams SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
    );
    res.json(result.rows[0]);
});

// DELETE /api/teams/:id
router.delete('/:id', async (req: Request, res: Response) => {
    await db.query(`DELETE FROM teams WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
});

// PUT /api/teams/:id/members  — replace full member list
router.put('/:id/members', async (req: Request, res: Response) => {
    const { agent_ids } = req.body as { agent_ids: string[] };
    const teamId = req.params.id;

    await db.query(`DELETE FROM team_members WHERE team_id = $1`, [teamId]);
    if (agent_ids?.length > 0) {
        const values = agent_ids.map((_, i) => `($1, $${i + 2})`).join(',');
        await db.query(
            `INSERT INTO team_members (team_id, agent_id) VALUES ${values} ON CONFLICT DO NOTHING`,
            [teamId, ...agent_ids]
        );
    }
    res.json({ ok: true, member_count: agent_ids?.length ?? 0 });
});

// POST /api/teams/:id/members/:agentId  — add single member
router.post('/:id/members/:agentId', async (req: Request, res: Response) => {
    await db.query(
        `INSERT INTO team_members (team_id, agent_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.params.id, req.params.agentId]
    );
    res.json({ ok: true });
});

// DELETE /api/teams/:id/members/:agentId
router.delete('/:id/members/:agentId', async (req: Request, res: Response) => {
    await db.query(
        `DELETE FROM team_members WHERE team_id = $1 AND agent_id = $2`,
        [req.params.id, req.params.agentId]
    );
    res.json({ ok: true });
});

export default router;
