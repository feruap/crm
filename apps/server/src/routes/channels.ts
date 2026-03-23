import { Router, Request, Response } from 'express';
import { db } from '../db';
import crypto from 'crypto';

const router = Router();

// ─── Helper: get Meta credentials from DB or env ────────────────────────
async function getMetaCredentials() {
    const result = await db.query(
        `SELECT key, value FROM business_settings WHERE key = ANY($1)`,
        [['meta_app_id', 'meta_app_secret', 'meta_verify_token', 'meta_access_token']]
    );
    const fromDB: Record<string, string> = {};
    for (const row of result.rows) fromDB[row.key] = row.value;
    return {
        appId: fromDB.meta_app_id || process.env.META_APP_ID || '',
        appSecret: fromDB.meta_app_secret || process.env.META_APP_SECRET || '',
        verifyToken: fromDB.meta_verify_token || process.env.META_VERIFY_TOKEN || '',
        accessToken: fromDB.meta_access_token || process.env.META_ACCESS_TOKEN || '',
    };
}

// ══════════════════════════════════════════════════════════════════════════
// ─── Facebook / Instagram OAuth Flow ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

// Scopes needed per channel type:
// Facebook Feed:   pages_show_list, pages_read_engagement, pages_manage_metadata
// Messenger:       pages_show_list, pages_messaging, pages_read_engagement
// Instagram Feed:  pages_show_list, instagram_basic, instagram_manage_comments
// Instagram Chat:  pages_show_list, instagram_basic, instagram_manage_messages
// We request ALL of them at once so one OAuth covers all channels
const META_OAUTH_SCOPES = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_metadata',
    'pages_messaging',
    'pages_read_user_content',
    'instagram_basic',
    'instagram_manage_comments',
    'instagram_manage_messages',
].join(',');

// GET /api/channels/oauth/start — returns the Facebook OAuth URL for the frontend
router.get('/oauth/start', async (_req: Request, res: Response) => {
    try {
        const creds = await getMetaCredentials();
        if (!creds.appId) {
            res.status(400).json({ error: 'META_APP_ID not configured. Set it in Settings → Channels → Config.' });
            return;
        }

        const base = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
        const redirectUri = `${base}/api/channels/oauth/callback`;

        // State token to prevent CSRF
        const state = crypto.randomBytes(16).toString('hex');
        // Store state in a simple in-memory map (TTL 10 min)
        oauthStates.set(state, { createdAt: Date.now() });
        setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000);

        const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
            `client_id=${creds.appId}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(META_OAUTH_SCOPES)}` +
            `&state=${state}` +
            `&response_type=code`;

        res.json({ url: oauthUrl, state });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// In-memory store for OAuth states (simple approach, works for single-instance)
const oauthStates = new Map<string, { createdAt: number; code?: string; accessToken?: string }>();

// Exported for public mount in index.ts (no auth needed — Facebook redirects here)
export async function handleOAuthCallback(req: Request, res: Response) {
    // Delegate to the same logic
    return _handleOAuthCallback(req, res);
}

// Also mount on the router for consistency
router.get('/oauth/callback', async (req: Request, res: Response) => {
    return _handleOAuthCallback(req, res);
});

async function _handleOAuthCallback(req: Request, res: Response) {
    try {
        const { code, state, error: fbError, error_description } = req.query;

        if (fbError) {
            const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
            res.redirect(`${webUrl}/settings?oauth=error&message=${encodeURIComponent(String(error_description || fbError))}`);
            return;
        }

        if (!code || !state) {
            res.status(400).json({ error: 'Missing code or state parameter' });
            return;
        }

        // Validate state
        const stateStr = String(state);
        if (!oauthStates.has(stateStr)) {
            res.status(400).json({ error: 'Invalid or expired state. Please try again.' });
            return;
        }

        const creds = await getMetaCredentials();
        const base = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
        const redirectUri = `${base}/api/channels/oauth/callback`;

        // Exchange code for short-lived token
        const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?` +
            `client_id=${creds.appId}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&client_secret=${creds.appSecret}` +
            `&code=${code}`;

        const tokenResp = await fetch(tokenUrl);
        const tokenData = await tokenResp.json() as any;

        if (tokenData.error) {
            const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
            res.redirect(`${webUrl}/settings?oauth=error&message=${encodeURIComponent(tokenData.error.message)}`);
            return;
        }

        // Exchange short-lived token for long-lived token (60 days)
        const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token?` +
            `grant_type=fb_exchange_token` +
            `&client_id=${creds.appId}` +
            `&client_secret=${creds.appSecret}` +
            `&fb_exchange_token=${tokenData.access_token}`;

        const longResp = await fetch(longLivedUrl);
        const longData = await longResp.json() as any;

        const accessToken = longData.access_token || tokenData.access_token;

        // Store the token in the state map for the frontend to retrieve
        const stateEntry = oauthStates.get(stateStr)!;
        stateEntry.code = String(code);
        stateEntry.accessToken = accessToken;

        // Redirect to frontend settings page with success
        const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
        res.redirect(`${webUrl}/settings?oauth=success&state=${stateStr}`);
    } catch (err: any) {
        console.error('OAuth callback error:', err);
        const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
        res.redirect(`${webUrl}/settings?oauth=error&message=${encodeURIComponent(err.message)}`);
    }
}

// GET /api/channels/oauth/pages — list available Facebook pages & Instagram accounts
router.get('/oauth/pages', async (req: Request, res: Response) => {
    try {
        const { state } = req.query;

        // Try to get token from state (from recent OAuth) or from DB
        let userAccessToken = '';
        if (state && oauthStates.has(String(state))) {
            userAccessToken = oauthStates.get(String(state))!.accessToken || '';
        }
        if (!userAccessToken) {
            // Fallback: check if there's a stored token in business_settings
            const creds = await getMetaCredentials();
            userAccessToken = creds.accessToken;
        }

        if (!userAccessToken) {
            res.status(401).json({ error: 'No access token available. Please connect with Facebook first.' });
            return;
        }

        // Get pages the user manages
        const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?` +
            `fields=id,name,access_token,category,picture{url},instagram_business_account{id,username,profile_picture_url}` +
            `&limit=100` +
            `&access_token=${userAccessToken}`;

        const pagesResp = await fetch(pagesUrl);
        const pagesData = await pagesResp.json() as any;

        if (pagesData.error) {
            res.status(400).json({ error: pagesData.error.message });
            return;
        }

        // Get already connected channels to show status
        const existingChannels = await db.query(
            `SELECT provider_config->>'page_id' AS page_id,
                    provider_config->>'ig_account_id' AS ig_account_id,
                    provider, subtype, name, id
             FROM channels WHERE provider IN ('facebook', 'instagram')`
        );
        const connectedPageIds = new Set(existingChannels.rows.map((r: any) => r.page_id));
        const connectedIgIds = new Set(existingChannels.rows.map((r: any) => r.ig_account_id));

        const pages = (pagesData.data || []).map((page: any) => ({
            page_id: page.id,
            page_name: page.name,
            page_access_token: page.access_token,
            category: page.category,
            picture_url: page.picture?.data?.url,
            instagram_account: page.instagram_business_account ? {
                ig_account_id: page.instagram_business_account.id,
                ig_username: page.instagram_business_account.username,
                ig_picture_url: page.instagram_business_account.profile_picture_url,
            } : null,
            already_connected: {
                facebook: connectedPageIds.has(page.id),
                instagram: page.instagram_business_account ? connectedIgIds.has(page.instagram_business_account.id) : false,
            },
        }));

        res.json({ pages, user_token: userAccessToken });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/channels/oauth/connect — connect selected pages/accounts as channels
router.post('/oauth/connect', async (req: Request, res: Response) => {
    try {
        const { pages } = req.body;
        // pages = [{ page_id, page_name, page_access_token, channels: ['messenger', 'feed', 'instagram_chat', 'instagram_comments'] }]

        if (!pages || !Array.isArray(pages) || pages.length === 0) {
            res.status(400).json({ error: 'pages array required' });
            return;
        }

        const creds = await getMetaCredentials();
        const created: any[] = [];
        const errors: any[] = [];

        for (const page of pages) {
            const { page_id, page_name, page_access_token, channels: channelTypes, instagram_account } = page;

            if (!page_id || !page_access_token || !channelTypes || channelTypes.length === 0) continue;

            // Subscribe the page to our webhook (auto-setup!)
            try {
                const subscribeUrl = `https://graph.facebook.com/v21.0/${page_id}/subscribed_apps`;
                const subscribeResp = await fetch(subscribeUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        access_token: page_access_token,
                        subscribed_fields: [
                            'messages', 'messaging_postbacks', 'messaging_optins',
                            'feed', 'mention', 'name', 'picture',
                        ].join(','),
                    }),
                });
                const subData = await subscribeResp.json() as any;
                if (subData.error) {
                    errors.push({ page_id, page_name, error: `Webhook subscribe failed: ${subData.error.message}` });
                }
            } catch (subErr: any) {
                errors.push({ page_id, page_name, error: `Webhook subscribe: ${subErr.message}` });
            }

            // Create channel entries for each selected type
            for (const type of channelTypes) {
                try {
                    let provider = 'facebook';
                    let subtype: string | null = null;
                    let name = '';
                    let config: Record<string, string> = {};

                    if (type === 'messenger') {
                        provider = 'facebook';
                        subtype = 'messenger';
                        name = `${page_name} (Messenger)`;
                        config = { page_id, page_name, access_token: page_access_token };
                    } else if (type === 'feed') {
                        provider = 'facebook';
                        subtype = 'feed';
                        name = `${page_name} (Feed)`;
                        config = { page_id, page_name, access_token: page_access_token };
                    } else if (type === 'instagram_chat' && instagram_account) {
                        provider = 'instagram';
                        subtype = 'chat';
                        name = `${instagram_account.ig_username || page_name} (IG Chat)`;
                        config = {
                            page_id, page_name, access_token: page_access_token,
                            ig_account_id: instagram_account.ig_account_id,
                            ig_username: instagram_account.ig_username || '',
                        };
                    } else if (type === 'instagram_comments' && instagram_account) {
                        provider = 'instagram';
                        subtype = 'comments';
                        name = `${instagram_account.ig_username || page_name} (IG Comentarios)`;
                        config = {
                            page_id, page_name, access_token: page_access_token,
                            ig_account_id: instagram_account.ig_account_id,
                            ig_username: instagram_account.ig_username || '',
                        };
                    } else {
                        continue;
                    }

                    // Check if already connected (skip duplicates)
                    const existing = await db.query(
                        `SELECT id FROM channels WHERE provider = $1 AND subtype = $2 AND provider_config->>'page_id' = $3`,
                        [provider, subtype, page_id]
                    );
                    if (existing.rows.length > 0) {
                        // Update existing channel with new token
                        await db.query(
                            `UPDATE channels SET provider_config = provider_config || $1::jsonb, is_active = TRUE WHERE id = $2`,
                            [JSON.stringify(config), existing.rows[0].id]
                        );
                        created.push({ id: existing.rows[0].id, name, provider, subtype, updated: true });
                    } else {
                        const result = await db.query(
                            `INSERT INTO channels (name, provider, subtype, provider_config, is_active, sync_comments)
                             VALUES ($1, $2, $3, $4, TRUE, TRUE) RETURNING id`,
                            [name, provider, subtype, JSON.stringify(config)]
                        );
                        created.push({ id: result.rows[0].id, name, provider, subtype, updated: false });
                    }
                } catch (chErr: any) {
                    errors.push({ page_id, type, error: chErr.message });
                }
            }
        }

        // Also save the user token in business_settings as fallback
        if (pages[0]?.page_access_token) {
            // We store the first page's token as general Meta access token
            await db.query(
                `INSERT INTO business_settings (key, value) VALUES ('meta_access_token', $1)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [pages[0].page_access_token]
            );
        }

        res.json({ created, errors, total_created: created.length, total_errors: errors.length });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

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

export default router;
