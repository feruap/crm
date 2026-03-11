import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// GET /api/quick-replies
// Devuelve las del agente actual (personal + team del agente + global), ordenadas por use_count DESC
router.get('/', async (req: Request, res: Response) => {
    const agentId = req.agent?.agentId;

    // Get agent's teams
    const teamsResult = await db.query(
        'SELECT team_id FROM team_members WHERE agent_id = $1',
        [agentId]
    );
    const teamIds = teamsResult.rows.map(r => r.team_id);

    let query = `
        SELECT * FROM quick_replies
        WHERE scope = 'global'
           OR (scope = 'personal' AND agent_id = $1)
    `;
    const params: any[] = [agentId];

    if (teamIds.length > 0) {
        params.push(teamIds);
        query += ` OR (scope = 'team' AND team_id = ANY($2))`;
    }

    query += ` ORDER BY use_count DESC, created_at DESC`;

    const result = await db.query(query, params);
    res.json(result.rows);
});

// POST /api/quick-replies
router.post('/', async (req: Request, res: Response) => {
    const { shortcut, title, content, scope = 'personal', team_id } = req.body;
    const agentId = req.agent?.agentId;

    if (!shortcut || !content) {
        res.status(400).json({ error: 'Shortcut and content are required' });
        return;
    }

    const result = await db.query(
        `INSERT INTO quick_replies (agent_id, team_id, scope, shortcut, title, content)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [agentId, team_id, scope, shortcut, title, content]
    );

    res.status(201).json(result.rows[0]);
});

// PUT /api/quick-replies/:id
router.put('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { shortcut, title, content, scope, team_id } = req.body;
    const agentId = req.agent?.agentId;
    const isAdmin = req.agent?.role === 'admin';

    // Check ownership
    const existing = await db.query('SELECT agent_id FROM quick_replies WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Quick reply not found' });
        return;
    }

    if (existing.rows[0].agent_id !== agentId && !isAdmin) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const result = await db.query(
        `UPDATE quick_replies 
         SET shortcut = COALESCE($1, shortcut),
             title = COALESCE($2, title),
             content = COALESCE($3, content),
             scope = COALESCE($4, scope),
             team_id = COALESCE($5, team_id),
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [shortcut, title, content, scope, team_id, id]
    );

    res.json(result.rows[0]);
});

// DELETE /api/quick-replies/:id
router.delete('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const agentId = req.agent?.agentId;
    const isAdmin = req.agent?.role === 'admin';

    const existing = await db.query('SELECT agent_id FROM quick_replies WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Quick reply not found' });
        return;
    }

    if (existing.rows[0].agent_id !== agentId && !isAdmin) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    await db.query('DELETE FROM quick_replies WHERE id = $1', [id]);
    res.json({ ok: true });
});

// POST /api/quick-replies/:id/use
router.post('/:id/use', async (req: Request, res: Response) => {
    const { id } = req.params;
    await db.query(
        'UPDATE quick_replies SET use_count = use_count + 1, updated_at = NOW() WHERE id = $1',
        [id]
    );
    res.json({ ok: true });
});

export default router;
