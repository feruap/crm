import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// ── GET /api/agent-groups — list all groups with members ─────────────────────
router.get('/', async (_req: Request, res: Response) => {
    const groups = await db.query(
        `SELECT g.*,
                COALESCE(
                    json_agg(
                        json_build_object('id', a.id, 'name', a.name, 'email', a.email)
                    ) FILTER (WHERE a.id IS NOT NULL),
                    '[]'
                ) AS members,
                ch.name AS channel_name,
                ch.provider AS channel_provider
         FROM agent_groups g
         LEFT JOIN agent_group_members gm ON gm.group_id = g.id
         LEFT JOIN agents a ON a.id = gm.agent_id
         LEFT JOIN channels ch ON ch.id = g.channel_id
         GROUP BY g.id, ch.name, ch.provider
         ORDER BY g.created_at DESC`
    );
    res.json(groups.rows);
});

// ── GET /api/agent-groups/:id — single group with members ────────────────────
router.get('/:id', async (req: Request, res: Response) => {
    const group = await db.query(
        `SELECT g.*,
                COALESCE(
                    json_agg(
                        json_build_object('id', a.id, 'name', a.name, 'email', a.email)
                    ) FILTER (WHERE a.id IS NOT NULL),
                    '[]'
                ) AS members
         FROM agent_groups g
         LEFT JOIN agent_group_members gm ON gm.group_id = g.id
         LEFT JOIN agents a ON a.id = gm.agent_id
         WHERE g.id = $1
         GROUP BY g.id`,
        [req.params.id]
    );
    if (group.rows.length === 0) {
        res.status(404).json({ error: 'Group not found' });
        return;
    }
    res.json(group.rows[0]);
});

// ── POST /api/agent-groups — create group + members ──────────────────────────
router.post('/', async (req: Request, res: Response) => {
    const { name, channel_id, strategy, agent_ids } = req.body;

    if (!name?.trim()) {
        res.status(400).json({ error: 'name is required' });
        return;
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO agent_groups (name, channel_id, strategy)
             VALUES ($1, $2, $3) RETURNING *`,
            [name.trim(), channel_id || null, strategy || 'round_robin']
        );
        const group = result.rows[0];

        // Insert members
        if (agent_ids && Array.isArray(agent_ids) && agent_ids.length > 0) {
            for (const agentId of agent_ids) {
                await client.query(
                    `INSERT INTO agent_group_members (group_id, agent_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [group.id, agentId]
                );
            }
        }

        await client.query('COMMIT');

        // Re-fetch with members
        const full = await db.query(
            `SELECT g.*,
                    COALESCE(
                        json_agg(json_build_object('id', a.id, 'name', a.name)) FILTER (WHERE a.id IS NOT NULL),
                        '[]'
                    ) AS members
             FROM agent_groups g
             LEFT JOIN agent_group_members gm ON gm.group_id = g.id
             LEFT JOIN agents a ON a.id = gm.agent_id
             WHERE g.id = $1
             GROUP BY g.id`,
            [group.id]
        );
        res.status(201).json(full.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
});

// ── PATCH /api/agent-groups/:id — update group settings ──────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
    const { name, channel_id, strategy, is_active, agent_ids } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined) { params.push(name.trim()); sets.push(`name = $${params.length}`); }
    if (channel_id !== undefined) { params.push(channel_id || null); sets.push(`channel_id = $${params.length}`); }
    if (strategy !== undefined) { params.push(strategy); sets.push(`strategy = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); sets.push(`is_active = $${params.length}`); }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        if (sets.length > 0) {
            params.push(req.params.id);
            await client.query(
                `UPDATE agent_groups SET ${sets.join(', ')} WHERE id = $${params.length}`,
                params
            );
        }

        // Replace members if provided
        if (agent_ids !== undefined && Array.isArray(agent_ids)) {
            await client.query(`DELETE FROM agent_group_members WHERE group_id = $1`, [req.params.id]);
            for (const agentId of agent_ids) {
                await client.query(
                    `INSERT INTO agent_group_members (group_id, agent_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [req.params.id, agentId]
                );
            }
        }

        await client.query('COMMIT');

        // Re-fetch
        const full = await db.query(
            `SELECT g.*,
                    COALESCE(
                        json_agg(json_build_object('id', a.id, 'name', a.name)) FILTER (WHERE a.id IS NOT NULL),
                        '[]'
                    ) AS members
             FROM agent_groups g
             LEFT JOIN agent_group_members gm ON gm.group_id = g.id
             LEFT JOIN agents a ON a.id = gm.agent_id
             WHERE g.id = $1
             GROUP BY g.id`,
            [req.params.id]
        );
        res.json(full.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
});

// ── POST /api/agent-groups/:id/members — add a member ────────────────────────
router.post('/:id/members', async (req: Request, res: Response) => {
    const { agent_id } = req.body;
    if (!agent_id) { res.status(400).json({ error: 'agent_id required' }); return; }

    await db.query(
        `INSERT INTO agent_group_members (group_id, agent_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.params.id, agent_id]
    );
    res.json({ ok: true });
});

// ── DELETE /api/agent-groups/:id/members/:agentId — remove a member ──────────
router.delete('/:id/members/:agentId', async (req: Request, res: Response) => {
    await db.query(
        `DELETE FROM agent_group_members WHERE group_id = $1 AND agent_id = $2`,
        [req.params.id, req.params.agentId]
    );
    res.json({ ok: true });
});

// ── DELETE /api/agent-groups/:id — delete group ──────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
    await db.query(`DELETE FROM agent_groups WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
});

// ── Helper: assign conversation to agent from group (used by flow executor) ──
export async function assignFromGroup(
    groupId: string,
    conversationId: string
): Promise<string | null> {
    const group = await db.query(
        `SELECT * FROM agent_groups WHERE id = $1 AND is_active = TRUE`,
        [groupId]
    );
    if (group.rows.length === 0) return null;

    const members = await db.query(
        `SELECT agent_id FROM agent_group_members WHERE group_id = $1`,
        [groupId]
    );
    if (members.rows.length === 0) return null;

    const agentIds: string[] = members.rows.map((r: any) => r.agent_id);
    let agentId: string;

    const g = group.rows[0];

    if (g.strategy === 'round_robin') {
        const idx = g.current_index % agentIds.length;
        agentId = agentIds[idx];
        await db.query(
            `UPDATE agent_groups SET current_index = current_index + 1 WHERE id = $1`,
            [groupId]
        );
    } else if (g.strategy === 'least_busy') {
        // Find agent with fewest open conversations
        const counts = await db.query(
            `SELECT a.id, COALESCE(cnt, 0)::int AS cnt
             FROM unnest($1::uuid[]) AS a(id)
             LEFT JOIN (
                 SELECT assigned_agent_id, COUNT(*) AS cnt
                 FROM conversations
                 WHERE assigned_agent_id = ANY($1::uuid[]) AND status IN ('open', 'pending')
                 GROUP BY assigned_agent_id
             ) c ON c.assigned_agent_id = a.id
             ORDER BY cnt ASC NULLS FIRST
             LIMIT 1`,
            [agentIds]
        );
        agentId = counts.rows[0]?.id ?? agentIds[0];
    } else {
        // random
        agentId = agentIds[Math.floor(Math.random() * agentIds.length)];
    }

    await db.query(
        `UPDATE conversations SET assigned_agent_id = $1 WHERE id = $2`,
        [agentId, conversationId]
    );

    console.log(`[AgentGroup] Conv ${conversationId} assigned to agent ${agentId} via group "${g.name}"`);
    return agentId;
}

export default router;
