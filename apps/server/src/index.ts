import express from 'express';
import cors from 'cors';
import path from 'path';
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
import agentsRouter from './routes/agents';
import agentGroupsRouter from './routes/agent-groups';
import aiRouter from './routes/ai';
import alertsRouter from './routes/alerts';
import assignmentRulesRouter from './routes/assignmentRules';
import automationsRouter from './routes/automations';
import botRouter from './routes/bot';
import bulkCampaignsRouter from './routes/bulkCampaigns';
import businessHoursRouter from './routes/business-hours';
import channelsRouter from './routes/channels';
import customersRouter from './routes/customers';
import eventsRouter from './routes/events';
import flowsRouter from './routes/flows';
import knowledgeRouter from './routes/knowledge';
import pipelinesRouter from './routes/pipelines';
import productsRouter from './routes/products';
import quickRepliesRouter from './routes/quickReplies';
import scheduledMessagesRouter from './routes/scheduledMessages';
import simulatorRouter from './routes/simulator';
import teamsRouter from './routes/teams';
import widgetConfigRouter from './routes/widgetConfig';

dotenv.config();                          // loads .env
dotenv.config({ path: '.env.whatsapp' }); // loads WhatsApp credentials (won't override existing)

const app = express();
app.use(cors());
app.use(express.json());

// ─── Static files (widget.js) ────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// Explicit route for widget.js (fallback if express.static doesn't catch it)
app.get('/widget.js', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'widget.js'));
});

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

// ─── Widget config (GET public for embed, PUT has its own requireAuth) ──
app.use('/api/widget-config', widgetConfigRouter);

// ─── Protected Routes (require JWT) ──────────
app.use('/api/conversations',     requireAuth, conversationsRouter);
app.use('/api/campaigns',         requireAuth, campaignsRouter);
app.use('/api/attributions',      requireAuth, attributionsRouter);
app.use('/api/orders',            requireAuth, ordersRouter);
app.use('/api/campaign-mappings', requireAuth, campaignMappingsRouter);
app.use('/api/medical-products',  requireAuth, medicalProductsRouter);
app.use('/api/inventory',         requireAuth, inventoryRouter);
app.use('/api/agent-commissions', requireAuth, agentCommissionsRouter);
app.use('/api/agents',            requireAuth, agentsRouter);
app.use('/api/agent-groups',      requireAuth, agentGroupsRouter);
app.use('/api/ai',                requireAuth, aiRouter);
app.use('/api/alerts',            requireAuth, alertsRouter);
app.use('/api/assignment-rules',  requireAuth, assignmentRulesRouter);
app.use('/api/automations',       requireAuth, automationsRouter);
app.use('/api/bot',               requireAuth, botRouter);
app.use('/api/bulk-campaigns',    requireAuth, bulkCampaignsRouter);
app.use('/api/business-hours',    requireAuth, businessHoursRouter);
app.use('/api/channels',          requireAuth, channelsRouter);
app.use('/api/customers',         requireAuth, customersRouter);
app.use('/api/events',            requireAuth, eventsRouter);
app.use('/api/flows',             requireAuth, flowsRouter);
app.use('/api/knowledge',         requireAuth, knowledgeRouter);
app.use('/api/pipelines',         requireAuth, pipelinesRouter);
app.use('/api/products',          requireAuth, productsRouter);
app.use('/api/quick-replies',     requireAuth, quickRepliesRouter);
app.use('/api/scheduled-messages',requireAuth, scheduledMessagesRouter);
app.use('/api/simulator',         requireAuth, simulatorRouter);
app.use('/api/teams',             requireAuth, teamsRouter);
// widget-config mounted above as public (GET) / protected (PUT)

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
