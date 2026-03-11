import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
    }

    const result = await db.query(
        `SELECT id, name, email, password_hash, role, is_active FROM agents WHERE email = $1`,
        [email]
    );

    const agent = result.rows[0];

    if (!agent || !agent.is_active) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }

    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }

    const token = jwt.sign(
        { agentId: agent.id, email: agent.email, role: agent.role },
        process.env.JWT_SECRET || 'dev_secret',
        { expiresIn: '8h' }
    );

    res.json({
        token,
        agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role },
    });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
    const result = await db.query(
        `SELECT id, name, email, role, salesking_agent_code, wc_agent_id FROM agents WHERE id = $1`,
        [req.agent!.agentId]
    );
    res.json(result.rows[0]);
});

// PATCH /api/auth/me  — update own profile (name, salesking_agent_code, wc_agent_id)
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
    const { name, salesking_agent_code, wc_agent_id } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined) {
        params.push(name);
        sets.push(`name = $${params.length}`);
    }
    if (salesking_agent_code !== undefined) {
        params.push(salesking_agent_code || null);
        sets.push(`salesking_agent_code = $${params.length}`);
    }
    if (wc_agent_id !== undefined) {
        params.push(wc_agent_id || null);
        sets.push(`wc_agent_id = $${params.length}`);
    }

    if (sets.length === 0) {
        res.status(400).json({ error: 'Nothing to update' });
        return;
    }

    params.push(req.agent!.agentId);
    const result = await db.query(
        `UPDATE agents SET ${sets.join(', ')} WHERE id = $${params.length}
         RETURNING id, name, email, role, salesking_agent_code, wc_agent_id`,
        params
    );
    res.json(result.rows[0]);
});

// POST /api/auth/seed-admin  (only usable when no agents exist)
router.post('/seed-admin', async (req: Request, res: Response) => {
    const count = await db.query(`SELECT COUNT(*) FROM agents`);
    if (parseInt(count.rows[0].count) > 0) {
        res.status(403).json({ error: 'Agents already exist' });
        return;
    }

    const { name, email, password } = req.body;
    const hash = await bcrypt.hash(password, 12);

    const agent = await db.query(
        `INSERT INTO agents (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id, name, email, role`,
        [name, email, hash]
    );

    res.status(201).json(agent.rows[0]);
});

export default router;
