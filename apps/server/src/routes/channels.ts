import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// ── Helper: subscribe a Facebook/Instagram page to webhook events ──────────────
async function subscribePageToWebhook(
    pageId: string,
    pageAccessToken: string,
    provider: 'facebook' | 'instagram' = 'facebook'
): Promise<{ ok: boolean; error?: string }> {
    // Facebook: subscribe to messages + feed (DMs + post comments)
    // Instagram: subscribe to messages + comments + mentions
    const fields = provider === 'instagram'
        ? 'messages,comments,mentions'
        : 'messages,feed';

    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/subscribed_apps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ access_token: pageAccessToken, subscribed_fields: fields }).toString(),
        });
        const data: any = await res.json();
        if (data.error) return { ok: false, error: data.error.message };
        return { ok: !!data.success };
    } catch (err: any) {
        return { ok: false, error: err.message };
    }
}

// GET /api/channels  — list all configured channels
router.get('/', async (_req: Request, res: Response) => {
    const result = await db.query(`
        SELECT id, name, provider, subtype, is_active, sync_comments, created_at,
               provider_config->>'page_id'           AS page_id,
               provider_config->>'phone_number_id'   AS phone_number_id,
               provider_config->>'ig_account_id'     AS ig_account_id,
               provider_config->>'tiktok_open_id'    AS tiktok_open_id,
               provider_config->>'brand_name'        AS brand_name,
               provider_config->>'custom_prompt'     AS custom_prompt,
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

    const channel = result.rows[0];

    // Auto-subscribe to Meta webhook when creating a Facebook or Instagram channel
    if ((provider === 'facebook' || provider === 'instagram') && provider_config?.access_token) {
        const pageId = provider_config.page_id || provider_config.ig_account_id;
        if (pageId) {
            const subResult = await subscribePageToWebhook(pageId, provider_config.access_token, provider);
            if (!subResult.ok) {
                console.warn(`[channels] Auto-subscribe webhook failed for ${pageId}: ${subResult.error}`);
            } else {
                console.log(`[channels] Auto-subscribed webhook for ${provider} page ${pageId} (messages+feed)`);
            }
            channel.webhook_subscribed = subResult.ok;
            channel.webhook_subscribe_error = subResult.error ?? null;
        }
    }

    res.status(201).json(channel);
});

// PATCH /api/channels/:id  — update config / credentials
router.patch('/:id', async (req: Request, res: Response) => {
    const { name, provider_config, webhook_secret, is_active, sync_comments, subtype, brand_name } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined) { params.push(name); sets.push(`name = $${params.length}`); }
    if (brand_name !== undefined) { params.push(brand_name); sets.push(`brand_name = $${params.length}`); }
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
         RETURNING id, name, provider, subtype, is_active, sync_comments, created_at,
                   provider_config->>'page_id'       AS page_id,
                   provider_config->>'ig_account_id' AS ig_account_id,
                   provider_config->>'access_token'  AS access_token`,
        params
    );

    const channel = result.rows[0];

    // Re-subscribe to webhook if provider_config (credentials) changed
    if (provider_config !== undefined && channel && (channel.provider === 'facebook' || channel.provider === 'instagram')) {
        const pageId = channel.page_id || channel.ig_account_id;
        const token = provider_config.access_token || channel.access_token;
        if (pageId && token) {
            const subResult = await subscribePageToWebhook(pageId, token, channel.provider as 'facebook' | 'instagram');
            if (!subResult.ok) {
                console.warn(`[channels] Re-subscribe webhook failed for ${pageId}: ${subResult.error}`);
            } else {
                console.log(`[channels] Re-subscribed webhook for ${channel.provider} page ${pageId}`);
            }
        }
    }

    // Remove internal fields before responding
    const { page_id, ig_account_id, access_token, ...clean } = channel || {};
    res.json(clean);
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

// ── Channel Configuration (Meta/WhatsApp credentials in business_settings) ────

// GET /api/channels/config — get channel config (app_id, app_secret masked, verify_token, access_token status)
router.get('/config', async (_req: Request, res: Response) => {
    try {
        const keys = ['meta_app_id', 'meta_app_secret', 'meta_verify_token', 'meta_access_token'];
        const result = await db.query(
            `SELECT key, value FROM business_settings WHERE key = ANY($1)`,
            [keys]
        );
        const settings: Record<string, any> = {};
        for (const row of result.rows) {
            if (row.key === 'meta_app_secret') {
                // Mask the secret, show only last 6 chars
                settings[row.key] = row.value ? `${'•'.repeat(Math.max(0, row.value.length - 6))}${row.value.slice(-6)}` : null;
                settings.meta_app_secret_set = !!row.value;
            } else if (row.key === 'meta_access_token') {
                // Mask the token, show only first 10 and last 6 chars
                settings[row.key] = row.value ? `${row.value.slice(0, 10)}${'•'.repeat(20)}${row.value.slice(-6)}` : null;
                settings.meta_access_token_set = !!row.value;
            } else {
                settings[row.key] = row.value;
            }
        }
        // Also check env vars as fallback indicators
        settings.env_meta_verify_token = !!process.env.META_VERIFY_TOKEN;
        settings.env_meta_app_secret = !!process.env.META_APP_SECRET;
        settings.env_meta_access_token = !!process.env.META_ACCESS_TOKEN;
        settings.env_meta_app_id = !!process.env.META_APP_ID;

        res.json(settings);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/channels/config — update channel config
router.patch('/config', async (req: Request, res: Response) => {
    const allowedKeys = ['meta_app_id', 'meta_app_secret', 'meta_verify_token', 'meta_access_token'];
    const updates: string[] = [];

    try {
        for (const key of allowedKeys) {
            if (req.body[key] !== undefined) {
                const value = (req.body[key] || '').trim();
                if (value) {
                    await db.query(
                        `INSERT INTO business_settings (key, value) VALUES ($1, $2)
                         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                        [key, value]
                    );
                    updates.push(key);
                } else {
                    await db.query(`DELETE FROM business_settings WHERE key = $1`, [key]);
                    updates.push(`${key} (removed)`);
                }
            }
        }

        if (updates.length === 0) {
            res.status(400).json({ error: 'No valid keys provided', allowed: allowedKeys });
            return;
        }

        res.json({ ok: true, updated: updates });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/channels/auto-discover — discover FB pages + IG accounts and create channels
router.post('/auto-discover', async (_req: Request, res: Response) => {
    try {
        // Read token from business_settings, fallback to env
        const settingsRes = await db.query(
            `SELECT key, value FROM business_settings WHERE key IN ('meta_access_token', 'meta_app_secret')`
        );
        const settingsMap: Record<string, string> = {};
        for (const row of settingsRes.rows) settingsMap[row.key] = row.value;

        const accessToken = settingsMap['meta_access_token'] || process.env.META_ACCESS_TOKEN || '';
        if (!accessToken) {
            res.status(400).json({ error: 'No meta_access_token configurado. Configúralo en Settings > Canales & Webhooks.' });
            return;
        }

        // Fetch pages from Graph API
        const graphUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=name,id,access_token,instagram_business_account&limit=50&access_token=${encodeURIComponent(accessToken)}`;
        const graphRes = await fetch(graphUrl);
        const graphData: any = await graphRes.json();

        if (graphData.error) {
            res.status(400).json({ error: `Graph API error: ${graphData.error.message}` });
            return;
        }

        const pages: any[] = graphData.data || [];
        const created: string[] = [];
        const skipped: string[] = [];

        for (const page of pages) {
            const pageId = page.id;
            const pageName = page.name;
            const pageToken = page.access_token || accessToken;

            // Check existing channels with this page_id
            const existingRes = await db.query(
                `SELECT id, subtype FROM channels WHERE provider_config->>'page_id' = $1`,
                [pageId]
            );
            const existingSubtypes = existingRes.rows.map((r: any) => r.subtype);

            // Create Facebook Messenger channel if not exists
            if (!existingSubtypes.includes('messenger')) {
                await db.query(
                    `INSERT INTO channels (name, provider, subtype, provider_config, sync_comments)
                     VALUES ($1, 'facebook', 'messenger', $2, false)`,
                    [`${pageName} – Messenger`, JSON.stringify({ page_id: pageId, access_token: pageToken })]
                );
                created.push(`${pageName} (Facebook Messenger)`);
                // Auto-subscribe this page to webhook
                const subFb = await subscribePageToWebhook(pageId, pageToken, 'facebook');
                if (!subFb.ok) console.warn(`[auto-discover] Webhook subscribe failed for ${pageName} (${pageId}): ${subFb.error}`);
                else console.log(`[auto-discover] Webhook subscribed for ${pageName} (${pageId})`);
            } else {
                skipped.push(`${pageName} (Facebook Messenger)`);
            }

            // Create Facebook Feed channel if not exists
            if (!existingSubtypes.includes('feed')) {
                await db.query(
                    `INSERT INTO channels (name, provider, subtype, provider_config, sync_comments)
                     VALUES ($1, 'facebook', 'feed', $2, true)`,
                    [`${pageName} – Feed`, JSON.stringify({ page_id: pageId, access_token: pageToken })]
                );
                created.push(`${pageName} (Facebook Feed)`);
                // No need to subscribe again — already done above for the same page
            } else {
                skipped.push(`${pageName} (Facebook Feed)`);
            }

            // Create Instagram channel if page has linked IG account
            if (page.instagram_business_account) {
                const igId = page.instagram_business_account.id;
                const existingIg = await db.query(
                    `SELECT id FROM channels WHERE provider = 'instagram' AND provider_config->>'ig_account_id' = $1`,
                    [igId]
                );
                if (existingIg.rows.length === 0) {
                    await db.query(
                        `INSERT INTO channels (name, provider, subtype, provider_config, sync_comments)
                         VALUES ($1, 'instagram', null, $2, false)`,
                        [`${pageName} – Instagram`, JSON.stringify({ ig_account_id: igId, page_id: pageId, access_token: pageToken })]
                    );
                    created.push(`${pageName} (Instagram)`);
                    // Auto-subscribe Instagram page to webhook
                    const subIg = await subscribePageToWebhook(pageId, pageToken, 'instagram');
                    if (!subIg.ok) console.warn(`[auto-discover] IG webhook subscribe failed for ${pageName}: ${subIg.error}`);
                    else console.log(`[auto-discover] IG webhook subscribed for ${pageName} (${igId})`);
                } else {
                    skipped.push(`${pageName} (Instagram)`);
                }
            }
        }

        res.json({
            ok: true,
            pages_found: pages.length,
            created,
            skipped,
            message: created.length > 0
                ? `Se crearon ${created.length} canal(es): ${created.join(', ')}`
                : `No se crearon canales nuevos. ${skipped.length} ya existían.`,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
