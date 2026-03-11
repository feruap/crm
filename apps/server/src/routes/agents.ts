import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/agents  — supervisor/admin ve todos los agentes con métricas
router.get('/', async (_req: Request, res: Response) => {
    const result = await db.query(`
        SELECT
            a.id, a.name, a.email, a.role, a.is_active,
            a.salesking_agent_code, a.avatar_url, a.last_login_at, a.created_at,
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
router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
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
    res.status(201).json(result.rows[0]);
});

// PUT /api/agents/:id  — admin actualiza agente completo
router.put('/:id', requireRole('admin'), async (req: Request, res: Response) => {
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
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
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
router.post('/:id/reset-password', requireRole('admin'), async (req: Request, res: Response) => {
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
