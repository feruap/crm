import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { getSalesKingGroups, listSalesKingAgents } from '../services/crm-bridge';

const router = Router();
router.use(requireAuth);

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
    const { name, description, color, salesking_group_id } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'name required' }); return; }

    const result = await db.query(
        `INSERT INTO teams (name, description, color, salesking_group_id) VALUES ($1, $2, $3, $4) RETURNING *`,
        [name.trim(), description ?? null, color ?? '#6366f1', salesking_group_id ?? null]
    );
    res.status(201).json(result.rows[0]);
});

// POST /api/teams/sync-salesking — import SalesKing groups as CRM teams and assign members
router.post('/sync-salesking', requireRole('admin', 'superadmin'), async (_req: Request, res: Response) => {
    try {
        // 1. Fetch SalesKing groups
        const groupsResp = await getSalesKingGroups();
        const skGroups = groupsResp.groups || [];
        if (skGroups.length === 0) {
            res.json({ message: 'No SalesKing groups found', created: 0, updated: 0 });
            return;
        }

        // 2. Fetch existing CRM teams
        const teamsResult = await db.query('SELECT id, name, salesking_group_id FROM teams');
        const existingTeams = teamsResult.rows;
        const teamBySkGroup = new Map(existingTeams.filter((t: any) => t.salesking_group_id).map((t: any) => [t.salesking_group_id, t]));

        // 3. Fetch all SalesKing agents to know their group assignments
        const wpAgents = await listSalesKingAgents();
        // Map WP agent group to their CRM agent IDs
        const agentsByGroup = new Map<number, string[]>();
        for (const wpa of wpAgents.agents || []) {
            if (!wpa.group) continue;
            const groupId = parseInt(String(wpa.group), 10);
            if (isNaN(groupId)) continue;
            // Find CRM agent by wc_agent_id
            const crmAgent = await db.query('SELECT id FROM agents WHERE wc_agent_id = $1', [String(wpa.wp_user_id)]);
            if (crmAgent.rows.length > 0) {
                const existing = agentsByGroup.get(groupId) || [];
                existing.push(crmAgent.rows[0].id);
                agentsByGroup.set(groupId, existing);
            }
        }

        let created = 0, updated = 0;

        for (const group of skGroups) {
            const existing = teamBySkGroup.get(group.id);
            let teamId: string;

            if (existing) {
                // Update name if changed
                if (existing.name !== group.name) {
                    await db.query('UPDATE teams SET name = $1 WHERE id = $2', [group.name, existing.id]);
                }
                teamId = existing.id;
                updated++;
            } else {
                // Check if team with same name exists (link it)
                const byName = existingTeams.find((t: any) => t.name.toLowerCase() === group.name.toLowerCase() && !t.salesking_group_id);
                if (byName) {
                    await db.query('UPDATE teams SET salesking_group_id = $1 WHERE id = $2', [group.id, byName.id]);
                    teamId = byName.id;
                    updated++;
                } else {
                    const r = await db.query(
                        `INSERT INTO teams (name, salesking_group_id) VALUES ($1, $2) RETURNING id`,
                        [group.name, group.id]
                    );
                    teamId = r.rows[0].id;
                    created++;
                }
            }

            // Assign members based on their SalesKing group
            const memberIds = agentsByGroup.get(group.id) || [];
            if (memberIds.length > 0) {
                // Replace members for this team
                await db.query('DELETE FROM team_members WHERE team_id = $1', [teamId]);
                const values = memberIds.map((_, i) => `($1, $${i + 2})`).join(',');
                await db.query(
                    `INSERT INTO team_members (team_id, agent_id) VALUES ${values} ON CONFLICT DO NOTHING`,
                    [teamId, ...memberIds]
                );
            }
        }

        res.json({
            total_groups: skGroups.length,
            created,
            updated,
            groups: skGroups.map(g => ({ id: g.id, name: g.name, members: agentsByGroup.get(g.id)?.length || 0 }))
        });
    } catch (err: any) {
        console.error('[teams] sync-salesking error:', err);
        res.status(500).json({ error: err.message || 'Sync failed' });
    }
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
