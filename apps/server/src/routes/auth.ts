import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
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

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
        res.status(400).json({ error: 'Email requerido' });
        return;
    }

    const successMsg = { message: 'Si el correo existe, recibirás un link de recuperación' };

    try {
        const agentResult = await db.query('SELECT id, email FROM agents WHERE email = $1', [email]);
        if (agentResult.rows.length === 0) {
            res.json(successMsg);
            return;
        }

        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await db.query(
            `UPDATE agents SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
            [tokenHash, expires, agentResult.rows[0].id]
        );

        const resetUrl = `https://crm.botonmedico.com/reset-password?token=${token}`;

        // Get SMTP config from settings table
        const smtpResult = await db.query(
            `SELECT key, value FROM settings WHERE key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from')`
        );
        const smtp: Record<string, string> = {};
        for (const row of smtpResult.rows) smtp[row.key] = row.value;

        const host = smtp.smtp_host || process.env.SMTP_HOST || '';
        const port = parseInt(smtp.smtp_port || process.env.SMTP_PORT || '587');
        const user = smtp.smtp_user || process.env.SMTP_USER || '';
        const pass = smtp.smtp_pass || process.env.SMTP_PASS || '';
        const from = smtp.smtp_from || process.env.SMTP_FROM || user;

        console.log('[forgot-password] SMTP config:', { host, port, user, from, hasPass: !!pass, secure: port === 465 });

        if (!host) {
            console.error('[forgot-password] No SMTP host configured — email NOT sent');
        } else {
            const transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
            });

            console.log('[forgot-password] Sending email to:', agentResult.rows[0].email);
            try {
                const info = await transporter.sendMail({
                    from: `"MyAlice CRM" <${from}>`,
                    to: agentResult.rows[0].email,
                    subject: 'Recuperación de contraseña - MyAlice CRM',
                    html: `
                    <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
                        <h2 style="color:#1e40af">Recuperar contraseña</h2>
                        <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
                        <p>Haz clic en el siguiente enlace para crear una nueva contraseña. Este enlace es válido por <strong>1 hora</strong>.</p>
                        <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
                            Restablecer contraseña
                        </a>
                        <p style="color:#64748b;font-size:13px">Si no solicitaste esto, puedes ignorar este correo.</p>
                        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
                        <p style="color:#94a3b8;font-size:12px">MyAlice CRM - botonmedico.com</p>
                    </div>
                `,
                });
                console.log('[forgot-password] Email sent:', info.messageId);
            } catch (mailErr) {
                console.error('[forgot-password] sendMail error:', mailErr);
                throw mailErr;
            }
        }

        res.json(successMsg);
    } catch (err) {
        console.error('Forgot password error:', err);
        res.json(successMsg);
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
    const { token, password } = req.body;
    if (!token || !password) {
        res.status(400).json({ error: 'Token y contraseña requeridos' });
        return;
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const agentResult = await db.query(
            `SELECT id FROM agents WHERE reset_token = $1 AND reset_token_expires > NOW()`,
            [tokenHash]
        );

        if (agentResult.rows.length === 0) {
            res.status(400).json({ error: 'Token inválido o expirado' });
            return;
        }

        const hashed = await bcrypt.hash(password, 10);
        await db.query(
            `UPDATE agents SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
            [hashed, agentResult.rows[0].id]
        );

        res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Error al actualizar contraseña' });
    }
});

export default router;
