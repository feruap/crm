import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { sendEmail } from '../utils/email';

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

// POST /api/auth/forgot-password  (public — user is locked out)
router.post('/forgot-password', async (req: Request, res: Response) => {
    const { email } = req.body;

    // Always return success to avoid revealing whether the email exists
    const SUCCESS_MSG = 'Si el correo existe en el sistema, recibirás un link de recuperación en breve.';

    if (!email) {
        res.status(400).json({ error: 'El correo es requerido' });
        return;
    }

    try {
        const result = await db.query(
            `SELECT id, name, email FROM agents WHERE email = $1 AND is_active = TRUE`,
            [email.toLowerCase().trim()]
        );

        if (result.rows.length === 0) {
            // Don't reveal whether the email exists
            res.json({ message: SUCCESS_MSG });
            return;
        }

        const agent = result.rows[0];

        // Invalidate any existing tokens for this agent
        await db.query(
            `DELETE FROM password_reset_tokens WHERE agent_id = $1`,
            [agent.id]
        );

        // Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await db.query(
            `INSERT INTO password_reset_tokens (agent_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
            [agent.id, tokenHash, expiresAt]
        );

        const resetUrl = `https://crm.botonmedico.com/reset-password?token=${token}`;

        const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#2563eb;padding:32px 40px;text-align:center;">
            <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
              <span style="font-size:24px;">🔐</span>
            </div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">MyAlice CRM</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Recuperación de contraseña</h2>
            <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
              Hola <strong>${agent.name}</strong>,
            </p>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta.
              Haz clic en el botón de abajo para crear una nueva contraseña.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetUrl}"
                 style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                Restablecer contraseña
              </a>
            </div>
            <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">
              O copia y pega este enlace en tu navegador:
            </p>
            <p style="margin:0 0 24px;word-break:break-all;">
              <a href="${resetUrl}" style="color:#2563eb;font-size:13px;">${resetUrl}</a>
            </p>
            <div style="border-top:1px solid #e2e8f0;padding-top:20px;margin-top:8px;">
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                ⏰ Este enlace expira en <strong>1 hora</strong>.<br>
                Si no solicitaste este cambio, puedes ignorar este correo con seguridad.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              © ${new Date().getFullYear()} MyAlice CRM — Todos los derechos reservados
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        await sendEmail(agent.email, 'Recupera tu contraseña — MyAlice CRM', html);

        res.json({ message: SUCCESS_MSG });
    } catch (err) {
        console.error('forgot-password error:', err);
        // Still return success to not leak info, but log the real error
        res.json({ message: SUCCESS_MSG });
    }
});

// POST /api/auth/reset-password  (public — user is locked out)
router.post('/reset-password', async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        res.status(400).json({ error: 'Token y nueva contraseña son requeridos' });
        return;
    }

    if (newPassword.length < 6) {
        res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        return;
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const result = await db.query(
            `SELECT id, agent_id, expires_at, used_at
             FROM password_reset_tokens
             WHERE token_hash = $1`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            res.status(400).json({ error: 'El enlace de recuperación no es válido' });
            return;
        }

        const resetToken = result.rows[0];

        if (resetToken.used_at) {
            res.status(400).json({ error: 'Este enlace ya fue utilizado' });
            return;
        }

        if (new Date(resetToken.expires_at) < new Date()) {
            res.status(400).json({ error: 'El enlace de recuperación ha expirado. Solicita uno nuevo.' });
            return;
        }

        const hash = await bcrypt.hash(newPassword, 12);

        await db.query(
            `UPDATE agents SET password_hash = $1 WHERE id = $2`,
            [hash, resetToken.agent_id]
        );

        await db.query(
            `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
            [resetToken.id]
        );

        res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (err) {
        console.error('reset-password error:', err);
        res.status(500).json({ error: 'Error al restablecer la contraseña' });
    }
});

export default router;
