import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './db';
import conversationsRouter from './routes/conversations';
import campaignsRouter from './routes/campaigns';
import attributionsRouter from './routes/attributions';
import webhooksRouter from './routes/webhooks';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Health ───────────────────────────────────
app.get('/health', async (_req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok', db: 'connected', time: new Date() });
    } catch {
        res.status(503).json({ status: 'error', db: 'disconnected' });
    }
});

// ─── Routes ───────────────────────────────────
app.use('/api/conversations', conversationsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/attributions', attributionsRouter);
app.use('/api/webhooks', webhooksRouter);

// ─── AI Settings (persists to DB) ─────────────
app.post('/api/settings/ai', async (req, res) => {
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

app.get('/api/settings/ai', async (_req, res) => {
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
