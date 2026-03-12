import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// GET /api/channels  — list all configured channels
router.get('/', async (_req: Request, res: Response) => {
    const result = await db.query(`
        SELECT id, name, provider, subtype, is_active, sync_comments, created_at,
               provider_config->>'page_id'           AS page_id,
               provider_config->>'phone_number_id'   AS phone_number_id,
               provider_config->>'ig_account_id'     AS ig_account_id,
               provider_config->>'tiktok_open_id'    AS tiktok_open_id,
               CASE WHEN provider_config->>'access_token' IS NOT NULL THEN TRUE ELSE FALSE END AS has_token,
               CASE WHEN webhook_secret IS NOT NULL THEN TRUE ELSE FALSE END AS has_webhook_secret
        FROM channels
        ORDER BY created_at ASC
    `);
    res.json(result.rows);
});

// POST /api/channels  — connect a new channel
router.post('/', async (req: Request, res: Response) => {
    const { name, provider, provider_config, webhook_secret, sync_comments, subtype } = req.body;

    if (!name || !provider) {
        res.status(400).json({ error: 'name and provider required' });
        return;
    }

    const valid = ['whatsapp', 'facebook', 'instagram', 'tiktok', 'webchat'];
    if (!valid.includes(provider)) {
        res.status(400).json({ error: `provider must be one of: ${valid.join(', ')}` });
        return;
    }

    const result = await db.query(
        `INSERT INTO channels (name, provider, subtype, provider_config, webhook_secret, sync_comments)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, provider, subtype, is_active, sync_comments, created_at`,
        [name, provider, subtype ?? null, JSON.stringify(provider_config ?? {}), webhook_secret ?? null, sync_comments ?? true]
    );
    res.status(201).json(result.rows[0]);
});

// PATCH /api/channels/:id  — update config / credentials
router.patch('/:id', async (req: Request, res: Response) => {
    const { name, provider_config, webhook_secret, is_active, sync_comments, subtype } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined) { params.push(name); sets.push(`name = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); sets.push(`is_active = $${params.length}`); }
    if (sync_comments !== undefined) { params.push(sync_comments); sets.push(`sync_comments = $${params.length}`); }
    if (webhook_secret !== undefined) { params.push(webhook_secret); sets.push(`webhook_secret = $${params.length}`); }
    if (subtype !== undefined) { params.push(subtype); sets.push(`subtype = $${params.length}`); }
    if (provider_config !== undefined) {
        params.push(JSON.stringify(provider_config));
        sets.push(`provider_config = provider_config || $${params.length}::jsonb`);
    }

    if (sets.length === 0) { res.status(400).json({ error: 'nothing to update' }); return; }

    params.push(req.params.id);
    const result = await db.query(
        `UPDATE channels SET ${sets.join(', ')} WHERE id = $${params.length}
         RETURNING id, name, provider, subtype, is_active, sync_comments, created_at`,
        params
    );
    res.json(result.rows[0]);
});

// DELETE /api/channels/:id  — disconnect channel
router.delete('/:id', async (req: Request, res: Response) => {
    await db.query(`DELETE FROM channels WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
});

// GET /api/channels/widget-available  — returns channels available for widget use
router.get('/widget-available', async (_req: Request, res: Response) => {
    // Get all active connected channels
    const result = await db.query(`
        SELECT id, name, provider, subtype, is_active,
               provider_config->>'phone_number_id'   AS phone_number_id,
               provider_config->>'whatsapp_number'    AS whatsapp_number,
               provider_config->>'page_id'            AS page_id,
               provider_config->>'page_username'      AS page_username,
               provider_config->>'ig_account_id'      AS ig_account_id,
               provider_config->>'ig_username'         AS ig_username
        FROM channels
        WHERE is_active = TRUE
        ORDER BY created_at ASC
    `);

    const channels = result.rows.map((ch: any) => {
        let url = '';
        let ready = false;

        switch (ch.provider) {
            case 'whatsapp':
                if (ch.whatsapp_number) {
                    url = `https://wa.me/${ch.whatsapp_number.replace(/[^0-9]/g, '')}`;
                    ready = true;
                }
                break;
            case 'facebook':
                if (ch.page_username || ch.page_id) {
                    url = `https://m.me/${ch.page_username || ch.page_id}`;
                    ready = true;
                }
                break;
            case 'instagram':
                if (ch.ig_username) {
                    url = `https://ig.me/m/${ch.ig_username}`;
                    ready = true;
                } else if (ch.ig_account_id) {
                    url = `https://ig.me/m/${ch.ig_account_id}`;
                    ready = true;
                }
                break;
            case 'tiktok':
                ready = true;
                break;
        }

        return {
            id: ch.id,
            name: ch.name,
            provider: ch.provider,
            subtype: ch.subtype,
            url,
            ready,
        };
    });

    // Always include webchat as available (no authorization needed)
    channels.push({
        id: 'webchat',
        name: 'Web Chat',
        provider: 'webchat',
        subtype: null,
        url: '',
        ready: true,
    });

    res.json(channels);
});

// GET /api/channels/webhook-url  — returns the public webhook URLs for each provider
router.get('/webhook-url', async (req: Request, res: Response) => {
    const base = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
    res.json({
        meta: `${base}/api/webhooks/meta`,
        whatsapp: `${base}/api/webhooks/whatsapp`,
        tiktok: `${base}/api/webhooks/tiktok`,
        verify_token: process.env.META_VERIFY_TOKEN || '(set META_VERIFY_TOKEN in .env)',
    });
});

export default router;
