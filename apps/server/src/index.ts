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
    const { provider, apiKey, model, systemPrompt, temperature } = req.body;

    await db.query(
        `UPDATE ai_settings SET is_default = FALSE WHERE is_default = TRUE`
    );

    await db.query(
        `INSERT INTO ai_settings (provider, api_key_encrypted, model_name, system_prompt, temperature, is_default)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         ON CONFLICT DO NOTHING`,
        [provider, apiKey, model, systemPrompt, temperature ?? 0.7]
    );

    res.json({ ok: true, provider });
});

app.get('/api/settings/ai', requireAuth, async (_req, res) => {
    const result = await db.query(
        `SELECT provider, model_name, system_prompt, temperature, is_default
         FROM ai_settings ORDER BY is_default DESC`
    );
    res.json(result.rows);
});

// ─── Auto-migrate missing columns ────────────
async function ensureSchema() {
    try {
        await db.query(`ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS wc_last_sync TIMESTAMP WITH TIME ZONE`);
        await db.query(`ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS wc_variation_ids INTEGER[] DEFAULT '{}'`);
        console.log('[schema] ensured medical_products columns');
    } catch (e: any) { console.error('[schema] migration error:', e.message); }
}

// ─── Start ────────────────────────────────────
const PORT = process.env.PORT || 3001;
ensureSchema().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
