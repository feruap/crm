import http from 'http';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import cron from 'node-cron';

import { db } from './db';
import { initSocket } from './socket';
import { runAlertsCron } from './routes/alerts';
import { requireAuth } from './middleware/auth';

import authRouter from './routes/auth';
import conversationsRouter from './routes/conversations';
import campaignsRouter from './routes/campaigns';
import attributionsRouter from './routes/attributions';
import webhooksRouter from './routes/webhooks';
import agentsRouter from './routes/agents';
import customersRouter from './routes/customers';
import productsRouter from './routes/products';
import alertsRouter from './routes/alerts';
import botRouter from './routes/bot';
import teamsRouter from './routes/teams';
import channelsRouter from './routes/channels';
import flowsRouter from './routes/flows';
import businessHoursRouter from './routes/business-hours';
import quickRepliesRouter from './routes/quickReplies';
import scheduledMsgsRouter from './routes/scheduledMessages';
import eventsRouter from './routes/events';
import analyticsRouter from './routes/analytics';
import aiRouter from './routes/ai';
import assignmentRulesRouter from './routes/assignmentRules';
import bulkCampaignsRouter from './routes/bulkCampaigns';
import widgetConfigRouter from './routes/widgetConfig';
import simulatorRouter from './routes/simulator';
import pipelinesRouter from './routes/pipelines';
import automationsRouter from './routes/automations';
import agentGroupsRouter from './routes/agent-groups';
import knowledgeRouter from './routes/knowledge';
import medicalProductsRouter from './routes/medical-products';
import './workers/bulkSender'; // Start worker

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({
  limit: '5mb',
  verify: (req: any, _res: any, buf: Buffer) => {
    req.rawBody = buf;
  }
}));
app.use(express.static('public'));

// ─── Socket.io ───────────────────────────────────────────────────────────────
initSocket(httpServer, process.env.CORS_ORIGIN || 'http://localhost:3000');

// ─── Health ──────────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok', db: 'connected', time: new Date() });
    } catch {
        res.status(503).json({ status: 'error', db: 'disconnected' });
    }
});

// ─── Public routes ───────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/webhooks', webhooksRouter);

// ─── Protected routes ────────────────────────────────────────────────────────
app.use('/api/conversations', requireAuth, conversationsRouter);
app.use('/api/campaigns', (req, res, next) => {
    // OAuth callbacks must be public — Facebook/Google redirect here without an auth token
    if (req.method === 'GET' && (req.path === '/meta-oauth/callback' || req.path === '/google-oauth/callback')) return next();
    return requireAuth(req, res, next);
}, campaignsRouter);

// Attributions: la mayoría requiere auth, pero /woocommerce-sync y /salesking-sync
// son webhooks públicos llamados por WooCommerce/SalesKing sin token
app.use('/api/attributions', (req, res, next) => {
    const publicPaths = ['/woocommerce-sync', '/salesking-sync'];
    if (publicPaths.includes(req.path) && req.method === 'POST') {
        return next(); // skip requireAuth
    }
    return requireAuth(req, res, next);
}, attributionsRouter);
app.use('/api/agents', requireAuth, agentsRouter);
app.use('/api/customers', requireAuth, customersRouter);
app.use('/api/products', requireAuth, productsRouter);
app.use('/api/alerts', requireAuth, alertsRouter);
app.use('/api/bot/knowledge', requireAuth, botRouter);
app.use('/api/teams', requireAuth, teamsRouter);
app.use('/api/channels', requireAuth, channelsRouter);
app.use('/api/flows', requireAuth, flowsRouter);
app.use('/api/settings/business-hours', requireAuth, businessHoursRouter);
app.use('/api/quick-replies', requireAuth, quickRepliesRouter);
app.use('/api/scheduled-messages', requireAuth, scheduledMsgsRouter);
app.use('/api/events', requireAuth, eventsRouter);
app.use('/api/analytics', requireAuth, analyticsRouter);
app.use('/api/ai', requireAuth, aiRouter);
app.use('/api/assignment-rules', requireAuth, assignmentRulesRouter);
app.use('/api/bulk-campaigns', requireAuth, bulkCampaignsRouter);
app.use('/api/widget-config', widgetConfigRouter);
app.use('/api/simulator', requireAuth, simulatorRouter);
app.use('/api/pipelines', requireAuth, pipelinesRouter);
app.use('/api/automations', requireAuth, automationsRouter);
app.use('/api/agent-groups', requireAuth, agentGroupsRouter);
app.use('/api/knowledge', requireAuth, knowledgeRouter);
app.use('/api/medical-products', requireAuth, medicalProductsRouter);

// ─── WooCommerce Settings ─────────────────────────────────────────────────────
// Reads/writes wc_url, wc_key, wc_secret, wc_webhook_secret from the settings table.
// These are the values the UI saves — the server reads them at runtime so no deploy needed.
app.get('/api/settings/woocommerce', requireAuth, async (_req, res) => {
    try {
        const result = await db.query(
            `SELECT key, value FROM settings WHERE key IN ('wc_url', 'wc_key', 'wc_secret', 'wc_webhook_secret')`
        );
        const map: Record<string, string> = {};
        for (const r of result.rows) map[r.key] = r.value;
        res.json({
            wc_url: map['wc_url'] || '',
            // Never return secrets in plaintext — return masked values so the UI knows they're set
            wc_key: map['wc_key'] ? '••••••••' : '',
            wc_secret: map['wc_secret'] ? '••••••••' : '',
            wc_webhook_secret: map['wc_webhook_secret'] ? '••••••••' : '',
            wc_key_set: !!map['wc_key'],
            wc_secret_set: !!map['wc_secret'],
            wc_webhook_secret_set: !!map['wc_webhook_secret'],
        });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

app.post('/api/settings/woocommerce', requireAuth, async (req, res) => {
    try {
        const { wc_url, wc_key, wc_secret, wc_webhook_secret } = req.body as Record<string, string>;
        const upsert = async (key: string, value: string | undefined) => {
            if (value === undefined || value === '••••••••') return; // don't overwrite with masked placeholder
            await db.query(
                `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
                [key, value]
            );
        };
        await upsert('wc_url', wc_url);
        await upsert('wc_key', wc_key);
        await upsert('wc_secret', wc_secret);
        await upsert('wc_webhook_secret', wc_webhook_secret);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// ─── AI Settings ─────────────────────────────────────────────────────────────
app.get('/api/settings/ai', requireAuth, async (_req, res) => {
    const result = await db.query(
        `SELECT provider, model_name, system_prompt, temperature, is_default, excluded_categories FROM ai_settings ORDER BY is_default DESC`
    );
    res.json(result.rows);
});

app.post('/api/settings/ai', requireAuth, async (req, res) => {
    const { provider, apiKey, model, systemPrompt, temperature, excludedCategories } = req.body;

    // If no new API key provided, keep the existing one from the current default config
    let resolvedApiKey = apiKey;
    if (!resolvedApiKey) {
        const existing = await db.query(
            `SELECT api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`
        );
        resolvedApiKey = existing.rows[0]?.api_key_encrypted ?? null;
    }

    await db.query(`UPDATE ai_settings SET is_default = FALSE WHERE is_default = TRUE`);

    // PG maps js arrays to postgres arrays naturally when passed via pg parameter
    const categories = excludedCategories && Array.isArray(excludedCategories) ? excludedCategories : [];

    await db.query(
        `INSERT INTO ai_settings (provider, api_key_encrypted, model_name, system_prompt, temperature, is_default, excluded_categories)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
        [provider, resolvedApiKey, model, systemPrompt, temperature ?? 0.7, categories]
    );
    res.json({ ok: true, provider });
});

// ─── Cron: alerts every 5 min ────────────────────────────────────────────────
cron.schedule('*/5 * * * *', () => {
    runAlertsCron().catch(console.error);
});

// ─── Cron: scheduled messages every minute ────────────────────────────────────
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date();
        const pendingResult = await db.query(
            `SELECT * FROM scheduled_messages WHERE status = 'pending' AND scheduled_at <= $1`,
            [now]
        );

        for (const msg of pendingResult.rows) {
            try {
                // In a real app, we would call the channel provider API (WhatsApp, Meta)
                // For this clone, we just insert into messages table and Socket.io will update the UI
                const { conversation_id, channel_id, agent_id, content, media_url } = msg;

                // Get customer_id from conversation
                const conv = await db.query('SELECT customer_id FROM conversations WHERE id = $1', [conversation_id]);
                const customer_id = conv.rows[0]?.customer_id;

                await db.query(
                    `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, media_url, message_type, handled_by)
                     VALUES ($1, $2, $3, 'outbound', $4, $5, $6, 'human')`,
                    [conversation_id, channel_id, customer_id, content, media_url, media_url ? 'image' : 'text']
                );

                await db.query(`UPDATE scheduled_messages SET status = 'sent', sent_at = NOW() WHERE id = $1`, [msg.id]);
                console.log(`✅ Scheduled message ${msg.id} sent successfully.`);
            } catch (err) {
                console.error(`❌ Failed to send scheduled message ${msg.id}:`, err);
                await db.query(`UPDATE scheduled_messages SET status = 'failed', error_message = $1 WHERE id = $2`, [String(err), msg.id]);
            }
        }
    } catch (err) {
        console.error('❌ Error in scheduled messages cron:', err);
    }
});

// ─── Lead Stagnant Tracker Cron (Every hour) ──────────────────────────────────
cron.schedule('0 * * * *', async () => {
    try {
        await db.query(`
            UPDATE conversations
            SET is_stagnant = TRUE
            WHERE is_stagnant = FALSE
              AND status = 'open'
              AND last_stage_change + (stagnant_threshold_days * interval '1 day') < NOW()
        `);
    } catch (err) {
        console.error('❌ Error in stagnant leads cron:', err);
    }
});

// ─── Auto-Migration (Fase 7) ─────────────────────────────────────────────────
async function runMigrations() {
    try {
        // 1. Check for initial schema
        const hasAgents = await db.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'agents'
            ) AS exists
        `);

        if (!hasAgents.rows[0].exists) {
            console.log('📦 Initializing base schema from schema.sql...');
            const schemaPath = path.join(__dirname, '../packages/db/schema.sql');
            if (fs.existsSync(schemaPath)) {
                const schemaSql = fs.readFileSync(schemaPath, 'utf8');
                // pg handle multiple statements if they are in one string
                await db.query(schemaSql);
                console.log('✅ Base schema initialized successfully.');
            } else {
                console.error('❌ schema.sql not found at', schemaPath);
            }
        }

        // 2. run Fase 7 migrations...
        await db.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        // ... rest of migrations logic ...

        const check = await db.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'agent_groups'
            ) AS migrated
        `);
        if (check.rows[0].migrated) {
            console.log('✅ Fase 7 migration already applied, skipping.');
        } else {

        console.log('📦 Running Fase 7 migration...');

        // 7.1 Mark simulated conversations
        await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE`);

        // 7.2 Simulator session persistence
        await db.query(`
            CREATE TABLE IF NOT EXISTS simulator_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
                conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
                channel_id UUID REFERENCES channels(id),
                customer_name TEXT,
                customer_phone TEXT,
                campaign_id UUID,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(agent_id)
            )
        `);

        // 7.3 Agent Groups
        await db.query(`
            CREATE TABLE IF NOT EXISTS agent_groups (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                channel_id UUID REFERENCES channels(id),
                strategy TEXT NOT NULL DEFAULT 'round_robin'
                    CHECK (strategy IN ('round_robin', 'least_busy', 'random')),
                current_index INT DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS agent_group_members (
                group_id UUID REFERENCES agent_groups(id) ON DELETE CASCADE,
                agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
                PRIMARY KEY (group_id, agent_id)
            )
        `);

        // 7.4 Visual flow support
        await db.query(`ALTER TABLE bot_flows ADD COLUMN IF NOT EXISTS flow_type TEXT DEFAULT 'simple'`);
        await db.query(`ALTER TABLE bot_flows ADD COLUMN IF NOT EXISTS nodes JSONB`);
        await db.query(`ALTER TABLE bot_flows ADD COLUMN IF NOT EXISTS edges JSONB`);

        // 7.5 Settings key-value store
        await db.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // 7.6 AI Settings config
        await db.query(`
            CREATE TABLE IF NOT EXISTS ai_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                provider TEXT NOT NULL,
                api_key_encrypted TEXT,
                model_name TEXT NOT NULL,
                system_prompt TEXT,
                temperature NUMERIC(3,2) DEFAULT 0.7,
                is_default BOOLEAN DEFAULT FALSE,
                excluded_categories TEXT[],
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        console.log('✅ Fase 7 migration completed successfully!');
        } // end else (migration not yet applied)
    } catch (err) {
        console.error('❌ Fase 7 migration error:', err);
        // Don't crash the server — tables might partially exist
    }

    // ── Post-migration: add columns that may be missing ─────────────────────
    const safeAlter = async (sql: string) => {
        try { await db.query(sql); } catch (_) { /* column already exists */ }
    };
    await safeAlter(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS wc_agent_id TEXT`);
    await safeAlter(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS salesking_agent_code TEXT`);
    await safeAlter(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS reset_token TEXT`);
    await safeAlter(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ`);
    await safeAlter(`ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS excluded_categories TEXT[]`);
    await safeAlter(`ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS model_name TEXT`);
    await safeAlter(`ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS temperature NUMERIC(3,2) DEFAULT 0.7`);
    await safeAlter(`ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`);
    await safeAlter(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ai_instructions TEXT`);
    await safeAlter(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS automated_flow TEXT`);
    await safeAlter(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS brand_name TEXT`);
    await safeAlter(`ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS units_per_box INTEGER`);
    await safeAlter(`ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS presentaciones JSONB`);
    await safeAlter(`ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS wc_variation_ids INTEGER[]`);

    // Ensure automations table exists (was missing from Fase 7)
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS automations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                trigger_type TEXT NOT NULL DEFAULT 'message',
                conditions JSONB DEFAULT '{}',
                actions JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
    } catch (_) { /* already exists */ }
}

// ─── Startup Initialization ──────────────────────────────────────────────────
async function init() {
    try {
        console.log('Running startup initialization...');

        // Run pending migrations first
        await runMigrations();

        const count = await db.query('SELECT COUNT(*) FROM agents');
        if (parseInt(count.rows[0].count) === 0) {
            const bcrypt = await import('bcryptjs');
            const hash = await bcrypt.hash('admin123', 12);
            await db.query(
                `INSERT INTO agents (name, email, password_hash, role) VALUES ($1, $2, $3, $4)`,
                ['Admin', 'admin@myalice.ai', hash, 'admin']
            );
            console.log('✅ Default admin user seeded: admin@myalice.ai / admin123');
        } else {
            console.log('System already has agents, skipping seed.');
        }
    } catch (err) {
        console.error('❌ Initialization failed:', err);
    }
}

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(Number(PORT), '0.0.0.0', async () => {
    console.log(`Server + Socket.io running on port ${PORT} (0.0.0.0)`);
    await init();
});
