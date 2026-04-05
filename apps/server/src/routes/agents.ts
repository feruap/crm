import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { listSalesKingAgents, createWPUser, updateWPUser, getSalesKingGroups } from '../services/crm-bridge';

const router = Router();
router.use(requireAuth);

// GET /api/agents  — supervisor/admin ve todos los agentes con métricas
router.get('/', async (_req: Request, res: Response) => {
    const result = await db.query(`
        SELECT
            a.id, a.name, a.email, a.role, a.is_active,
            a.salesking_agent_code, a.wc_agent_id, a.avatar_url, a.last_login_at, a.created_at,
            COUNT(DISTINCT c.id) FILTER (WHERE c.status IN ('open','pending')) AS active_conversations,
            COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'resolved'
                AND c.updated_at > NOW() - INTERVAL '1 day')             AS resolved_today,
            COALESCE(SUM(o.total_amount), 0)                             AS pipeline_value,
            ROUND(
                100.0 * COUNT(m.id) FILTER (WHERE m.handled_by = 'bot')
                / NULLIF(COUNT(m.id), 0)
            )                                                            AS bot_rate,
            0 AS avg_response_min
        FROM agents a
        LEFT JOIN conversations c ON c.assigned_agent_id = a.id
        LEFT JOIN attributions at2 ON at2.conversation_id = c.id
        LEFT JOIN orders o ON o.id = at2.order_id
        LEFT JOIN messages m ON m.conversation_id = c.id
        GROUP BY a.id
        ORDER BY active_conversations DESC
    `);
    res.json(result.rows);
});

// POST /api/agents  — admin crea agente
router.post('/', requireRole('admin', 'superadmin'), async (req: Request, res: Response) => {
    const { name, email, password, role = 'agent', salesking_agent_code } = req.body;
    if (!name || !email || !password) {
        res.status(400).json({ error: 'name, email y password son requeridos' });
        return;
    }

    // Check email unique
    const existing = await db.query('SELECT id FROM agents WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Ya existe un agente con ese email' });
        return;
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
        `INSERT INTO agents (name, email, password_hash, role, salesking_agent_code)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, role, is_active, salesking_agent_code, created_at`,
        [name, email, hash, role, salesking_agent_code ?? null]
    );
    const newAgent = result.rows[0];

    // Auto-create WordPress/SalesKing user in background
    try {
        const username = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '');
        const wpResult = await createWPUser({
            username,
            email,
            display_name: name,
            crm_role: role === 'supervisor' ? 'shop_manager' : role === 'admin' ? 'administrator' : 'agent',
        });
        if (wpResult?.wp_user_id) {
            await db.query(
                `UPDATE agents SET wc_agent_id = $1, salesking_agent_code = COALESCE(salesking_agent_code, $2) WHERE id = $3`,
                [String(wpResult.wp_user_id), wpResult.salesking_agentid || null, newAgent.id]
            );
            newAgent.wc_agent_id = String(wpResult.wp_user_id);
        }
    } catch (wpErr: any) {
        console.warn('[agents] Auto-create WP user failed (non-blocking):', wpErr.message);
        // Non-blocking: agent is created in CRM even if WP creation fails
    }

    res.status(201).json(newAgent);
});

// POST /api/agents/sync-salesking — import agents from SalesKing into CRM
router.post('/sync-salesking', requireRole('admin', 'superadmin'), async (req: Request, res: Response) => {
    try {
        // 1. Fetch all SalesKing agents from WordPress
        const wpAgents = await listSalesKingAgents();

        // 2. Fetch current CRM agents
        const crmResult = await db.query('SELECT id, email, wc_agent_id, salesking_agent_code FROM agents');
        const crmAgents = crmResult.rows;

        // Build lookup maps
        const crmByEmail = new Map(crmAgents.map((a: any) => [a.email?.toLowerCase(), a]));
        const crmByWcId = new Map(crmAgents.map((a: any) => [String(a.wc_agent_id), a]));

        const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

        for (const wpAgent of wpAgents.agents) {
            try {
                // Check if already linked by wc_agent_id
                const existingByWcId = crmByWcId.get(String(wpAgent.wp_user_id));
                // Check if email matches an existing CRM agent
                const existingByEmail = crmByEmail.get(wpAgent.email?.toLowerCase());

                // Map WP roles to CRM roles
                let crmRole = 'agent';
                if (wpAgent.roles.includes('administrator')) crmRole = 'admin';
                else if (wpAgent.roles.includes('shop_manager')) crmRole = 'supervisor';

                if (existingByWcId) {
                    // Already linked — update salesking_agent_code if needed
                    const updates: string[] = [];
                    const params: any[] = [];
                    let paramIdx = 1;

                    if (wpAgent.salesking_agentid && existingByWcId.salesking_agent_code !== wpAgent.salesking_agentid) {
                        updates.push(`salesking_agent_code = $${paramIdx++}`);
                        params.push(wpAgent.salesking_agentid);
                    }

                    if (updates.length > 0) {
                        params.push(existingByWcId.id);
                        await db.query(
                            `UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
                            params
                        );
                        results.updated++;
                    } else {
                        results.skipped++;
                    }
                } else if (existingByEmail) {
                    // Email match — link the WP user ID and update SK code
                    await db.query(
                        `UPDATE agents SET wc_agent_id = $1, salesking_agent_code = COALESCE($2, salesking_agent_code) WHERE id = $3`,
                        [String(wpAgent.wp_user_id), wpAgent.salesking_agentid, existingByEmail.id]
                    );
                    results.updated++;
                } else {
                    // New agent — create in CRM
                    const tempPassword = require('crypto').randomBytes(16).toString('hex');
                    const hash = await bcrypt.hash(tempPassword, 12);

                    await db.query(
                        `INSERT INTO agents (name, email, password_hash, role, wc_agent_id, salesking_agent_code, is_active)
                         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                         ON CONFLICT (email) DO UPDATE SET
                            wc_agent_id = EXCLUDED.wc_agent_id,
                            salesking_agent_code = COALESCE(EXCLUDED.salesking_agent_code, agents.salesking_agent_code)`,
                        [
                            wpAgent.display_name,
                            wpAgent.email,
                            hash,
                            crmRole,
                            String(wpAgent.wp_user_id),
                            wpAgent.salesking_agentid || null,
                        ]
                    );
                    results.created++;
                }
            } catch (err: any) {
                results.errors.push(`${wpAgent.display_name}: ${err.message}`);
            }
        }

        // Also fetch SalesKing groups for reference
        let groups: any[] = [];
        try {
            const groupsRes = await getSalesKingGroups();
            groups = groupsRes.groups || [];
        } catch (e) {}

        res.json({
            ...results,
            total_wp_agents: wpAgents.total,
            total_crm_agents: crmAgents.length,
            salesking_groups: groups,
        });
    } catch (err: any) {
        console.error('[SalesKing Sync]', err);
        res.status(500).json({ error: 'Failed to sync with SalesKing: ' + err.message });
    }
});

// POST /api/agents/push-to-wp — push a CRM agent to WordPress/SalesKing
router.post('/push-to-wp', requireRole('admin', 'superadmin'), async (req: Request, res: Response) => {
    const { agent_id, salesking_group_id, parent_agent_id } = req.body;
    if (!agent_id) {
        res.status(400).json({ error: 'agent_id is required' });
        return;
    }

    try {
        // Get CRM agent
        const agentRes = await db.query('SELECT * FROM agents WHERE id = $1', [agent_id]);
        if (agentRes.rows.length === 0) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }
        const agent = agentRes.rows[0];

        // Check if already linked to WP
        if (agent.wc_agent_id) {
            // Update existing WP user
            const wpResult = await updateWPUser(parseInt(agent.wc_agent_id), {
                display_name: agent.name,
                email: agent.email,
                crm_role: agent.role,
                salesking_group_id,
                parent_agent_id,
            });

            // Update SK code if returned
            if (wpResult.salesking_agentid) {
                await db.query(
                    'UPDATE agents SET salesking_agent_code = $1 WHERE id = $2',
                    [wpResult.salesking_agentid, agent_id]
                );
            }

            res.json({ action: 'updated', ...wpResult });
        } else {
            // Create new WP user
            const username = agent.email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
            const wpResult = await createWPUser({
                username,
                email: agent.email,
                display_name: agent.name,
                crm_role: agent.role,
                salesking_group_id,
                parent_agent_id,
            });

            // Link the WP user ID back to CRM
            await db.query(
                'UPDATE agents SET wc_agent_id = $1, salesking_agent_code = COALESCE($2, salesking_agent_code) WHERE id = $3',
                [String(wpResult.wp_user_id), wpResult.salesking_agentid, agent_id]
            );

            res.json({ action: 'created', ...wpResult });
        }
    } catch (err: any) {
        console.error('[Push to WP]', err);
        res.status(500).json({ error: 'Failed to push to WordPress: ' + err.message });
    }
});

// GET /api/agents/salesking-groups — get SalesKing groups for UI dropdowns
router.get('/salesking-groups', requireRole('admin', 'supervisor'), async (_req: Request, res: Response) => {
    try {
        const groups = await getSalesKingGroups();
        res.json(groups);
    } catch (err: any) {
        console.error('[SK Groups]', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/agents/:id  — admin actualiza agente completo
router.put('/:id', requireRole('admin', 'superadmin'), async (req: Request, res: Response) => {
    const { name, email, role, is_active, salesking_agent_code, avatar_url } = req.body;
    const { id } = req.params;

    // Check email unique if changing
    if (email) {
        const existing = await db.query('SELECT id FROM agents WHERE email = $1 AND id != $2', [email, id]);
        if (existing.rows.length > 0) {
            res.status(409).json({ error: 'Ya existe un agente con ese email' });
            return;
        }
    }

    await db.query(
        `UPDATE agents SET
            name                 = COALESCE($1, name),
            email                = COALESCE($2, email),
            role                 = COALESCE($3, role),
            is_active            = COALESCE($4, is_active),
            salesking_agent_code = COALESCE($5, salesking_agent_code),
            avatar_url           = COALESCE($6, avatar_url)
         WHERE id = $7`,
        [name, email, role, is_active, salesking_agent_code, avatar_url, id]
    );

    const updated = await db.query(
        'SELECT id, name, email, role, is_active, salesking_agent_code, avatar_url, created_at FROM agents WHERE id = $1',
        [id]
    );
    res.json(updated.rows[0]);
});

// PATCH /api/agents/:id  — alias compatible hacia atrás
router.patch('/:id', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
    const { name, role, is_active, salesking_agent_code } = req.body;
    await db.query(
        `UPDATE agents SET
            name                 = COALESCE($1, name),
            role                 = COALESCE($2, role),
            is_active            = COALESCE($3, is_active),
            salesking_agent_code = COALESCE($4, salesking_agent_code)
         WHERE id = $5`,
        [name, role, is_active, salesking_agent_code, req.params.id]
    );
    res.json({ ok: true });
});

// DELETE /api/agents/:id  — admin desactiva agente (soft delete)
// Reasigna sus conversaciones abiertas a null
router.delete('/:id', requireRole('admin', 'superadmin'), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reassign_to } = req.body; // UUID del agente que recibirá las convs, o null

    // Prevent self-deletion
    if (req.agent?.agentId === id) {
        res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
        return;
    }

    // Reassign open conversations
    if (reassign_to) {
        await db.query(
            `UPDATE conversations SET assigned_agent_id = $1
             WHERE assigned_agent_id = $2 AND status IN ('open','pending')`,
            [reassign_to, id]
        );
    } else {
        await db.query(
            `UPDATE conversations SET assigned_agent_id = NULL
             WHERE assigned_agent_id = $1 AND status IN ('open','pending')`,
            [id]
        );
    }

    // Soft delete: mark inactive
    await db.query('UPDATE agents SET is_active = FALSE WHERE id = $1', [id]);

    res.json({ ok: true });
});

// POST /api/agents/:id/reset-password  — admin resetea contraseña
router.post('/:id/reset-password', requireRole('admin', 'superadmin'), async (req: Request, res: Response) => {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
        res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        return;
    }

    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE agents SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
    res.json({ ok: true });
});

export default router;
