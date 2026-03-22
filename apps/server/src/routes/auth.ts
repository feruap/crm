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
import crypto from 'crypto';
import nodemailer from 'nodemailer';
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

            if (callerRole !== 'superadmin' && callerRole !== 'director' && callerRole !== 'gerente') {
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
    const dbRole = finalRole === 'superadmin' ? 'superadmin' : finalRole === 'director' ? 'admin' : finalRole === 'gerente' ? 'supervisor' : 'agent';

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
        // Only director/superadmin can change roles
        if (req.agent!.role !== 'director' && req.agent!.role !== 'superadmin') {
            res.status(403).json({ error: 'Solo el director puede cambiar roles' });
            return;
        }
        const dbRole = role === 'superadmin' ? 'superadmin' : role === 'director' ? 'admin' : role === 'gerente' ? 'supervisor' : 'agent';
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

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password — Request password reset
// ─────────────────────────────────────────────
router.post('/forgot-password', async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
        res.status(400).json({ error: 'Email es requerido' });
        return;
    }

    try {
        const token = crypto.randomBytes(32).toString('hex');

        await db.query(
            `UPDATE agents SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '1 hour'
             WHERE email = $2 AND is_active = TRUE`,
            [token, email.toLowerCase().trim()]
        );

        // Try to send email, but don't fail if it doesn't work
        try {
            const mailConfigResult = await db.query(`SELECT * FROM system_mail_config LIMIT 1`);
            if (mailConfigResult.rows.length > 0) {
                const config = mailConfigResult.rows[0];
                const transporter = nodemailer.createTransport({
                    host: config.smtp_host,
                    port: config.smtp_port,
                    secure: config.smtp_port === 465,
                    auth: {
                        user: config.email,
                        pass: config.password_encrypted,
                    },
                });

                const resetLink = `${process.env.WEB_URL || 'https://crm.botonmedico.com'}/login?reset=${token}`;
                await transporter.sendMail({
                    from: config.email,
                    to: email,
                    subject: 'Restablecer contraseña - Botón Médico',
                    html: `<p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p><a href="${resetLink}">${resetLink}</a><p>Este enlace expira en 1 hora.</p>`,
                });
            }
        } catch (emailError) {
            console.error('Error sending password reset email:', emailError);
            // Continue anyway - don't expose error to user
        }

        res.json({
            ok: true,
            message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña',
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Error procesando solicitud' });
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/reset-password — Reset password with token
// ─────────────────────────────────────────────
router.post('/reset-password', async (req: Request, res: Response) => {
    const { token, password } = req.body;

    if (!token || !password) {
        res.status(400).json({ error: 'Token y contraseña son requeridos' });
        return;
    }

    if (password.length < 6) {
        res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        return;
    }

    try {
        const result = await db.query(
            `SELECT id, email FROM agents WHERE reset_token = $1 AND reset_token_expires > NOW()`,
            [token]
        );

        if (result.rows.length === 0) {
            res.status(401).json({ error: 'Token inválido o expirado' });
            return;
        }

        const agent = result.rows[0];
        const hashedPassword = hashPassword(password);

        await db.query(
            `UPDATE agents SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
            [hashedPassword, agent.id]
        );

        res.json({ ok: true, message: 'Contraseña restablecida correctamente' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Error restableciendo contraseña' });
    }
});

// ─────────────────────────────────────────────
// GET /api/auth/settings/mail — Get mail config (director+)
// ─────────────────────────────────────────────
router.get('/settings/mail', requireAuth, requireRole('director'), async (_req: Request, res: Response) => {
    try {
        const result = await db.query(`SELECT * FROM system_mail_config LIMIT 1`);

        if (result.rows.length === 0) {
            res.json({ ok: false, message: 'No mail config found' });
            return;
        }

        const config = result.rows[0];
        res.json({
            ok: true,
            data: {
                email: config.email,
                smtp_host: config.smtp_host,
                smtp_port: config.smtp_port,
                smtp_encryption: config.smtp_encryption,
                imap_host: config.imap_host,
                imap_port: config.imap_port,
                imap_encryption: config.imap_encryption,
                password: config.password_encrypted ? `****${config.password_encrypted.slice(-4)}` : '****',
            },
        });
    } catch (error) {
        console.error('Get mail config error:', error);
        res.status(500).json({ error: 'Error retrieving mail config' });
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/settings/mail — Update mail config (director+)
// ─────────────────────────────────────────────
router.post('/settings/mail', requireAuth, requireRole('director'), async (req: Request, res: Response) => {
    const { email, password, smtp_host, smtp_port, smtp_encryption, imap_host, imap_port, imap_encryption } = req.body;

    if (!email || !password || !smtp_host || !smtp_port) {
        res.status(400).json({ error: 'Campos requeridos: email, password, smtp_host, smtp_port' });
        return;
    }

    try {
        // Delete existing config and insert new one
        await db.query(`DELETE FROM system_mail_config`);
        await db.query(
            `INSERT INTO system_mail_config (email, password_encrypted, smtp_host, smtp_port, smtp_encryption, imap_host, imap_port, imap_encryption, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [email, password, smtp_host, smtp_port, smtp_encryption, imap_host, imap_port, imap_encryption, req.agent!.agent_id]
        );

        res.json({ ok: true, message: 'Mail config actualizado' });
    } catch (error) {
        console.error('Update mail config error:', error);
        res.status(500).json({ error: 'Error updating mail config' });
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/settings/mail/test — Test mail connection (director+)
// ─────────────────────────────────────────────
router.post('/settings/mail/test', requireAuth, requireRole('director'), async (_req: Request, res: Response) => {
    try {
        const result = await db.query(`SELECT * FROM system_mail_config LIMIT 1`);

        if (result.rows.length === 0) {
            res.status(400).json({ error: 'No mail config found' });
            return;
        }

        const config = result.rows[0];

        try {
            const transporter = nodemailer.createTransport({
                host: config.smtp_host,
                port: config.smtp_port,
                secure: config.smtp_port === 465,
                auth: {
                    user: config.email,
                    pass: config.password_encrypted,
                },
            });

            await transporter.verify();
            res.json({ ok: true, message: 'Conexión exitosa' });
        } catch (transportError) {
            console.error('Nodemailer transport error:', transportError);
            res.status(400).json({ error: 'Error de conexión SMTP' });
        }
    } catch (error) {
        console.error('Test mail config error:', error);
        res.status(500).json({ error: 'Error testing mail config' });
    }
});

export default router;
