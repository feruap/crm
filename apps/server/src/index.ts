import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './db';
import { requireAuth, requireRole } from './middleware/auth';
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

// ─── Start ────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
