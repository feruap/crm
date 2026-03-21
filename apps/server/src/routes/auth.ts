/**
 * Authentication Routes
 *
 * POST /api/auth/login      — Login with email + password
 * POST /api/auth/register   — Register new agent (director only, or first user)
 * GET  /api/auth/me         — Get current agent info
 * GET  /api/auth/agents     — List all agents (gerente+)
 * PUT  /api/auth/agents/:id — Update agent (gerente+ for role changes)
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
    generateToken,
    hashPassword,
    verifyPassword,
    normalizeRole,
    requireAuth,
    requireRole,
    AuthPayload,
} from '../middleware/auth';

const router = Router();

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ error: 'Email y contraseña son requeridos' });
        return;
    }

    const result = await db.query(
        `SELECT id, name, email, password_hash, role, is_active FROM agents WHERE email = $1`,
        [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
        res.status(401).json({ error: 'Credenciales incorrectas' });
        return;
    }

    const agent = result.rows[0];

    if (!agent.is_active) {
        res.status(403).json({ error: 'Cuenta desactivada. Contacta a un administrador.' });
        return;
    }

    if (!verifyPassword(password, agent.password_hash)) {
        res.status(401).json({ error: 'Credenciales incorrectas' });
        return;
    }

    const role = normalizeRole(agent.role);

    const payload: AuthPayload = {
        agent_id: agent.id,
        email: agent.email,
        role,
        name: agent.name,
    };

    const token = generateToken(payload);

    res.json({
        token,
        agent: {
            id: agent.id,
            name: agent.name,
            email: agent.email,
            role,
        },
    });
});

// ─────────────────────────────────────────────
// POST /api/auth/register — Create new agent
// First user = auto-director. After that, only director can create.
// ─────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
    const { name, email, password, role = 'operador' } = req.body;

    if (!name || !email || !password) {
        res.status(400).json({ error: 'name, email, y password son requeridos' });
        return;
    }

    if (password.length < 6) {
        res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        return;
    }

    // Check if this is the first user (auto-promote to director)
    const agentCount = await db.query(`SELECT COUNT(*) AS cnt FROM agents`);
    const isFirstUser = parseInt(agentCount.rows[0].cnt, 10) === 0;

    // If not first user, require auth and director role
    if (!isFirstUser) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Solo un director puede crear nuevos agentes' });
            return;
        }

        try {
            const { verifyToken } = await import('../middleware/auth');
            const payload = verifyToken(authHeader.substring(7));
            const callerRole = payload.role;

            if (callerRole !== 'director' && callerRole !== 'gerente') {
                res.status(403).json({ error: 'Solo director o gerente pueden crear agentes' });
                return;
            }

            // Gerentes can only create operadores
            if (callerRole === 'gerente' && role !== 'operador') {
                res.status(403).json({ error: 'Gerentes solo pueden crear operadores' });
                return;
            }
        } catch {
            res.status(401).json({ error: 'Token inválido' });
            return;
        }
    }

    // Check duplicate email
    const existing = await db.query(`SELECT id FROM agents WHERE email = $1`, [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Ya existe un agente con ese email' });
        return;
    }

    const finalRole = isFirstUser ? 'director' : role;
    const dbRole = finalRole === 'director' ? 'admin' : finalRole === 'gerente' ? 'supervisor' : 'agent';

    const hashed = hashPassword(password);

    const result = await db.query(
        `INSERT INTO agents (name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id, name, email, role`,
        [name, email.toLowerCase().trim(), hashed, dbRole]
    );

    const agent = result.rows[0];
    const normalizedRole = normalizeRole(agent.role);

    const payload: AuthPayload = {
        agent_id: agent.id,
        email: agent.email,
        role: normalizedRole,
        name: agent.name,
    };

    const token = generateToken(payload);

    res.status(201).json({
        token,
        agent: {
            id: agent.id,
            name: agent.name,
            email: agent.email,
            role: normalizedRole,
        },
        first_user: isFirstUser,
    });
});

// ─────────────────────────────────────────────
// GET /api/auth/me — Current agent info
// ─────────────────────────────────────────────
router.get('/me', requireAuth, async (req: Request, res: Response) => {
    const agent = await db.query(
        `SELECT id, name, email, role, is_active, created_at FROM agents WHERE id = $1`,
        [req.agent!.agent_id]
    );

    if (agent.rows.length === 0) {
        res.status(404).json({ error: 'Agente no encontrado' });
        return;
    }

    const a = agent.rows[0];
    res.json({
        id: a.id,
        name: a.name,
        email: a.email,
        role: normalizeRole(a.role),
        is_active: a.is_active,
        created_at: a.created_at,
    });
});

// ─────────────────────────────────────────────
// GET /api/auth/agents — List agents (gerente+)
// ─────────────────────────────────────────────
router.get('/agents', requireAuth, requireRole('gerente'), async (_req: Request, res: Response) => {
    const result = await db.query(
        `SELECT id, name, email, role, is_active, created_at FROM agents ORDER BY created_at ASC`
    );

    const agents = result.rows.map(a => ({
        ...a,
        role: normalizeRole(a.role),
    }));

    res.json(agents);
});

// ─────────────────────────────────────────────
// PUT /api/auth/agents/:id — Update agent (role, active)
// ─────────────────────────────────────────────
router.put('/agents/:id', requireAuth, requireRole('gerente'), async (req: Request, res: Response) => {
    const { name, role, is_active } = req.body;
    const updates: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined) {
        params.push(name);
        updates.push(`name = $${params.length}`);
    }

    if (role !== undefined) {
        // Only director can change roles
        if (req.agent!.role !== 'director') {
            res.status(403).json({ error: 'Solo el director puede cambiar roles' });
            return;
        }
        const dbRole = role === 'director' ? 'admin' : role === 'gerente' ? 'supervisor' : 'agent';
        params.push(dbRole);
        updates.push(`role = $${params.length}`);
    }

    if (is_active !== undefined) {
        params.push(is_active);
        updates.push(`is_active = $${params.length}`);
    }

    if (updates.length === 0) {
        res.status(400).json({ error: 'Nada que actualizar' });
        return;
    }

    params.push(req.params.id);
    const result = await db.query(
        `UPDATE agents SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, name, email, role, is_active`,
        params
    );

    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Agente no encontrado' });
        return;
    }

    const a = result.rows[0];
    res.json({ ...a, role: normalizeRole(a.role) });
});

export default router;
