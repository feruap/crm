import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// GET /api/flows  — list all bot flows
router.get('/', async (_req: Request, res: Response) => {
    const result = await db.query(`
        SELECT f.*,
               -- If campaign trigger, include campaign name
               CASE WHEN f.trigger_type = 'campaign' THEN
                   (SELECT name FROM campaigns WHERE id = (f.trigger_config->>'campaign_id')::uuid)
               END AS campaign_name
        FROM bot_flows f
        ORDER BY f.priority DESC, f.created_at ASC
    `);
    res.json(result.rows);
});

// GET /api/flows/:id
router.get('/:id', async (req: Request, res: Response) => {
    const result = await db.query(`SELECT * FROM bot_flows WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) { res.status(404).json({ error: 'not found' }); return; }
    res.json(result.rows[0]);
});

// POST /api/flows  — create new flow (supports both simple and visual)
router.post('/', async (req: Request, res: Response) => {
    const { name, trigger_type, trigger_config, steps, channel_providers, priority, flow_type, nodes, edges } = req.body;

    if (!name?.trim() || !trigger_type) {
        res.status(400).json({ error: 'name and trigger_type required' });
        return;
    }

    const valid_triggers = ['keyword', 'first_message', 'campaign', 'after_hours'];
    if (!valid_triggers.includes(trigger_type)) {
        res.status(400).json({ error: `trigger_type must be one of: ${valid_triggers.join(', ')}` });
        return;
    }

    const result = await db.query(
        `INSERT INTO bot_flows (name, trigger_type, trigger_config, steps, channel_providers, priority, flow_type, nodes, edges)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
            name.trim(),
            trigger_type,
            JSON.stringify(trigger_config ?? {}),
            JSON.stringify(steps ?? []),
            channel_providers ?? null,
            priority ?? 0,
            flow_type || 'simple',
            nodes ? JSON.stringify(nodes) : null,
            edges ? JSON.stringify(edges) : null,
        ]
    );
    res.status(201).json(result.rows[0]);
});

// PATCH /api/flows/:id  — update flow (supports both simple and visual)
router.patch('/:id', async (req: Request, res: Response) => {
    const { name, is_active, trigger_type, trigger_config, steps, channel_providers, priority, flow_type, nodes, edges } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined)              { params.push(name.trim());                     sets.push(`name = $${params.length}`); }
    if (is_active !== undefined)         { params.push(is_active);                       sets.push(`is_active = $${params.length}`); }
    if (trigger_type !== undefined)      { params.push(trigger_type);                    sets.push(`trigger_type = $${params.length}`); }
    if (trigger_config !== undefined)    { params.push(JSON.stringify(trigger_config));  sets.push(`trigger_config = $${params.length}`); }
    if (steps !== undefined)             { params.push(JSON.stringify(steps));           sets.push(`steps = $${params.length}`); }
    if (channel_providers !== undefined) { params.push(channel_providers);               sets.push(`channel_providers = $${params.length}`); }
    if (priority !== undefined)          { params.push(priority);                        sets.push(`priority = $${params.length}`); }
    if (flow_type !== undefined)         { params.push(flow_type);                       sets.push(`flow_type = $${params.length}`); }
    if (nodes !== undefined)             { params.push(JSON.stringify(nodes));            sets.push(`nodes = $${params.length}`); }
    if (edges !== undefined)             { params.push(JSON.stringify(edges));            sets.push(`edges = $${params.length}`); }

    if (sets.length === 0) { res.status(400).json({ error: 'nothing to update' }); return; }

    sets.push(`updated_at = NOW()`);
    params.push(req.params.id);
    const result = await db.query(
        `UPDATE bot_flows SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
    );
    res.json(result.rows[0]);
});

// DELETE /api/flows/:id
router.delete('/:id', async (req: Request, res: Response) => {
    await db.query(`DELETE FROM bot_flows WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
});

// ── Flow execution helper (used by webhook handler) ───────────────────────────
// Returns the first matching active flow for a given trigger context
export async function findMatchingFlow(params: {
    provider: string;
    messageText: string;
    isFirstMessage: boolean;
    campaignId?: string | null;
    isAfterHours: boolean;
}): Promise<any | null> {
    const { provider, messageText, isFirstMessage, campaignId, isAfterHours } = params;

    const flows = await db.query(
        `SELECT * FROM bot_flows
         WHERE is_active = TRUE
           AND (channel_providers IS NULL OR $1 = ANY(channel_providers))
         ORDER BY priority DESC, created_at ASC`,
        [provider]
    );

    const text = messageText.toLowerCase();

    for (const flow of flows.rows) {
        const config = flow.trigger_config as any;

        switch (flow.trigger_type) {
            case 'after_hours':
                if (isAfterHours) return flow;
                break;

            case 'first_message':
                if (isFirstMessage) return flow;
                break;

            case 'campaign':
                if (campaignId && config.campaign_id === campaignId) return flow;
                break;

            case 'keyword': {
                const keywords: string[] = config.keywords ?? [];
                const match = config.match ?? 'any'; // 'any' | 'all'
                if (keywords.length === 0) break;
                const hits = keywords.filter(kw => text.includes(kw.toLowerCase()));
                if (match === 'all' && hits.length === keywords.length) return flow;
                if (match === 'any' && hits.length > 0) return flow;
                break;
            }
        }
    }
    return null;
}

// ── Is current time within business hours? ────────────────────────────────────
export async function isWithinBusinessHours(): Promise<boolean> {
    const settings = await db.query(
        `SELECT key, value FROM business_settings WHERE key IN ('timezone', 'auto_reply_enabled')`
    );
    const map: Record<string, string> = {};
    for (const row of settings.rows) map[row.key] = row.value;
    if (map.auto_reply_enabled === 'false') return true; // treat as always open if disabled

    const tz = map.timezone || 'America/Mexico_City';
    const now = new Date();
    // Get local time in configured timezone
    const localStr = now.toLocaleString('en-US', { timeZone: tz, hour12: false,
        weekday: 'short', hour: '2-digit', minute: '2-digit' });
    // Parse weekday and time
    const [dayName, timePart] = localStr.split(', ');
    const days: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
    const dow = days[dayName] ?? -1;
    const [hStr, mStr] = (timePart ?? '').split(':');
    const currentMinutes = parseInt(hStr) * 60 + parseInt(mStr);

    const bh = await db.query(
        `SELECT is_open, open_time, close_time FROM business_hours WHERE day_of_week = $1`, [dow]
    );
    if (bh.rows.length === 0 || !bh.rows[0].is_open) return false;

    const [oh, om] = (bh.rows[0].open_time as string).split(':').map(Number);
    const [ch, cm] = (bh.rows[0].close_time as string).split(':').map(Number);
    const openMin  = oh * 60 + om;
    const closeMin = ch * 60 + cm;

    return currentMinutes >= openMin && currentMinutes < closeMin;
}

export default router;
