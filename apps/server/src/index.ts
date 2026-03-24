import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './db';
import { requireAuth, requireRole, normalizeRole, hashPassword } from './middleware/auth';
import conversationsRouter from './routes/conversations';
import campaignsRouter from './routes/campaigns';
import attributionsRouter from './routes/attributions';
import webhooksRouter from './routes/webhooks';
import ordersRouter from './routes/orders';
import campaignMappingsRouter from './routes/campaign-mappings';
import medicalProductsRouter from './routes/medical-products';
import escalationRulesRouter from './routes/escalation-rules';
import analyticsRouter from './routes/analytics';
import inventoryRouter from './routes/inventory';
import agentCommissionsRouter from './routes/agent-commissions';
import authRouter from './routes/auth';
import channelsRouter from './routes/channels';

dotenv.config();                          // loads .env
dotenv.config({ path: '.env.whatsapp' }); // loads WhatsApp credentials (won't override existing)

const app = express();
app.use(cors());
app.use(express.json());

// ─── Health (public) ─────────────────────────
app.get('/health', async (_req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok', db: 'connected', time: new Date() });
    } catch {
        res.status(503).json({ status: 'error', db: 'disconnected' });
    }
});

// ─── Legal pages (public, required by Meta) ──
app.get('/legal/privacy', (_req, res) => {
    res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Política de Privacidad - Amunet CRM</title></head><body style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px">
<h1>Política de Privacidad</h1>
<p><strong>Última actualización:</strong> 22 de marzo de 2026</p>
<p>Amunet CRM ("nosotros") opera la aplicación Amunet CRM. Esta página le informa sobre nuestras políticas con respecto a la recopilación, uso y divulgación de datos personales cuando utiliza nuestro servicio.</p>
<h2>Información que recopilamos</h2>
<p>Recopilamos información que usted nos proporciona directamente, como nombre, correo electrónico y datos de contacto cuando interactúa con nuestros servicios a través de Facebook Messenger, Instagram o WhatsApp.</p>
<h2>Uso de la información</h2>
<p>Utilizamos la información recopilada para: responder a sus consultas, proporcionar nuestros servicios de diagnóstico rápido, mejorar nuestro servicio al cliente y enviar comunicaciones relacionadas con sus pedidos.</p>
<h2>Compartir información</h2>
<p>No vendemos ni compartimos su información personal con terceros, excepto cuando sea necesario para proporcionar nuestros servicios o cuando la ley lo requiera.</p>
<h2>Contacto</h2>
<p>Si tiene preguntas sobre esta política, contáctenos en: fernando.ruiz@amunet.com.mx</p>
</body></html>`);
});

app.get('/legal/terms', (_req, res) => {
    res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Términos y Condiciones - Amunet CRM</title></head><body style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px">
<h1>Términos y Condiciones</h1>
<p><strong>Última actualización:</strong> 22 de marzo de 2026</p>
<p>Al utilizar la aplicación Amunet CRM y sus servicios de mensajería, usted acepta estos términos y condiciones.</p>
<h2>Servicios</h2>
<p>Amunet CRM proporciona servicios de atención al cliente y venta de pruebas de diagnóstico rápido a través de canales de mensajería como Facebook Messenger, Instagram y WhatsApp.</p>
<h2>Uso aceptable</h2>
<p>Usted se compromete a utilizar nuestros servicios de manera responsable y de acuerdo con las leyes aplicables.</p>
<h2>Limitación de responsabilidad</h2>
<p>Nuestros servicios se proporcionan "tal cual". No garantizamos la disponibilidad ininterrumpida del servicio.</p>
<h2>Contacto</h2>
<p>Para consultas: fernando.ruiz@amunet.com.mx</p>
</body></html>`);
});

app.get('/legal/data-deletion', (_req, res) => {
    res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Eliminación de Datos - Amunet CRM</title></head><body style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px">
<h1>Solicitud de Eliminación de Datos</h1>
<p>Si desea solicitar la eliminación de sus datos personales de nuestro sistema, envíe un correo a: fernando.ruiz@amunet.com.mx con el asunto "Solicitud de eliminación de datos".</p>
<p>Procesaremos su solicitud en un plazo máximo de 30 días hábiles.</p>
</body></html>`);
});

// ─── Auth (public) ───────────────────────────
app.use('/api/auth', authRouter);

// ─── Agents management (frontend uses /api/agents) ─

// GET /api/agents — list all agents (gerente+)
app.get('/api/agents', requireAuth, requireRole('gerente'), async (_req, res) => {
    const result = await db.query(
        `SELECT id, name, email, role, is_active, created_at FROM agents ORDER BY created_at ASC`
    );
    const agents = result.rows.map(a => ({ ...a, role: normalizeRole(a.role) }));
    res.json(agents);
});

// POST /api/agents — create new agent (director+)
app.post('/api/agents', requireAuth, requireRole('director'), async (req, res) => {
    const { name, email, password, role = 'operador', salesking_agent_code } = req.body;
    if (!name || !email || !password) {
        res.status(400).json({ error: 'name, email y password requeridos' }); return;
    }
    const existing = await db.query('SELECT id FROM agents WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Ya existe un agente con ese email' }); return;
    }
    // Map normalized role to DB role
    const dbRole = role === 'superadmin' ? 'superadmin' : role === 'director' ? 'admin' : role === 'gerente' ? 'supervisor' : 'agent';
    const hashed = hashPassword(password);
    const result = await db.query(
        `INSERT INTO agents (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, TRUE) RETURNING id, name, email, role, is_active`,
        [name, email.toLowerCase().trim(), hashed, dbRole]
    );
    const a = result.rows[0];
    res.status(201).json({ ...a, role: normalizeRole(a.role) });
});

// PUT /api/agents/:id — update agent (director+)
app.put('/api/agents/:id', requireAuth, requireRole('gerente'), async (req, res) => {
    const { name, role, is_active, salesking_agent_code } = req.body;
    const updates: string[] = [];
    const params: unknown[] = [];
    if (name !== undefined) { params.push(name); updates.push(`name = $${params.length}`); }
    if (role !== undefined) {
        if (req.agent!.role !== 'director' && req.agent!.role !== 'superadmin') {
            res.status(403).json({ error: 'Solo director o superadmin pueden cambiar roles' }); return;
        }
        const dbRole = role === 'superadmin' ? 'superadmin' : role === 'director' ? 'admin' : role === 'gerente' ? 'supervisor' : 'agent';
        params.push(dbRole); updates.push(`role = $${params.length}`);
    }
    if (is_active !== undefined) { params.push(is_active); updates.push(`is_active = $${params.length}`); }
    if (updates.length === 0) { res.status(400).json({ error: 'Nada que actualizar' }); return; }
    params.push(req.params.id);
    const result = await db.query(
        `UPDATE agents SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, name, email, role, is_active`,
        params
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Agente no encontrado' }); return; }
    const a = result.rows[0];
    res.json({ ...a, role: normalizeRole(a.role) });
});

// DELETE /api/agents/:id — deactivate agent
app.delete('/api/agents/:id', requireAuth, requireRole('director'), async (req, res) => {
    await db.query('UPDATE agents SET is_active = FALSE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
});

// POST /api/agents/:id/reset-password — reset agent password (director+)
app.post('/api/agents/:id/reset-password', requireAuth, requireRole('director'), async (req, res) => {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
        res.status(400).json({ error: 'Contraseña mínimo 6 caracteres' }); return;
    }
    const hashed = hashPassword(new_password);
    await db.query('UPDATE agents SET password_hash = $1 WHERE id = $2', [hashed, req.params.id]);
    res.json({ ok: true });
});

// ─── Webhooks (public — validated by signature) ──
app.use('/api/webhooks', webhooksRouter);

// ─── Facebook OAuth callback (public — FB redirects here, no auth needed) ──
// This must be before the requireAuth channelsRouter mount
import { handleOAuthCallback } from './routes/channels';
app.get('/api/channels/oauth/callback', handleOAuthCallback);

// ─── Protected Routes (require JWT) ──────────
app.use('/api/conversations',     requireAuth, conversationsRouter);
app.use('/api/campaigns',         requireAuth, campaignsRouter);
app.use('/api/attributions',      requireAuth, attributionsRouter);
app.use('/api/orders',            requireAuth, ordersRouter);
app.use('/api/campaign-mappings', requireAuth, campaignMappingsRouter);
app.use('/api/medical-products',  requireAuth, medicalProductsRouter);
app.use('/api/inventory',         requireAuth, inventoryRouter);
app.use('/api/agent-commissions', requireAuth, agentCommissionsRouter);
app.use('/api/channels',          requireAuth, channelsRouter);

// ─── Manager+ Routes (gerente or director) ───
app.use('/api/escalation-rules',  requireAuth, requireRole('gerente'), escalationRulesRouter);
app.use('/api/analytics',         requireAuth, requireRole('gerente'), analyticsRouter);

// ─── AI Settings (director only) ─────────────
app.post('/api/settings/ai', requireAuth, requireRole('director'), async (req, res) => {
    const { provider, apiKey, model, systemPrompt, temperature, promptAdditions } = req.body;

    await db.query(
        `UPDATE ai_settings SET is_default = FALSE WHERE is_default = TRUE`
    );

    await db.query(
        `INSERT INTO ai_settings (provider, api_key_encrypted, model_name, system_prompt, temperature, is_default, prompt_additions)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6)
         ON CONFLICT DO NOTHING`,
        [provider, apiKey, model, systemPrompt, temperature ?? 0.7, promptAdditions || null]
    );

    res.json({ ok: true, provider });
});

app.get('/api/settings/ai', requireAuth, async (_req, res) => {
    const result = await db.query(
        `SELECT provider, model_name, system_prompt, temperature, is_default, prompt_additions
         FROM ai_settings ORDER BY is_default DESC`
    );
    res.json(result.rows);
});

// ─── Start ────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
