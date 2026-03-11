import { Router, Request, Response } from 'express';
import { db } from '../db';
import axios from 'axios';

const router = Router();

// GET /api/campaigns — includes conversion funnel counts + linked bot flow
router.get('/', async (_req: Request, res: Response) => {
    const result = await db.query(`
        SELECT c.*,
               COUNT(DISTINCT a.customer_id)                                  AS total_customers,
               COUNT(DISTINCT a.conversation_id)                              AS total_conversations,
               COUNT(DISTINCT CASE WHEN conv.status = 'resolved'
                                   THEN conv.id END)                          AS resolved_conversations,
               COUNT(DISTINCT a.order_id)                                     AS total_orders,
               COALESCE(SUM(o.total_amount), 0)                               AS total_revenue,
               COUNT(DISTINCT CASE WHEN a.woocommerce_synced = FALSE
                                    AND a.order_id IS NOT NULL
                                   THEN a.id END)                             AS woocommerce_pending,
               -- Linked bot flow (trigger_type = 'campaign')
               bf.id   AS bot_flow_id,
               bf.name AS bot_flow_name,
               bf.is_active AS bot_flow_active
        FROM campaigns c
        LEFT JOIN attributions a    ON a.campaign_id = c.id
        LEFT JOIN conversations conv ON conv.id = a.conversation_id
        LEFT JOIN orders o          ON o.id = a.order_id
        LEFT JOIN bot_flows bf      ON bf.trigger_type = 'campaign'
                                   AND bf.is_active = TRUE
                                   AND (bf.trigger_config->>'campaign_id')::text = c.id::text
        GROUP BY c.id, bf.id, bf.name, bf.is_active
        ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
});

// ── Meta Token Management ─────────────────────────────────────────────────────

// GET /api/campaigns/meta-token — check token status
router.get('/meta-token', async (_req: Request, res: Response) => {
    try {
        let token: string | null = null;
        let source = 'none';

        try {
            const row = await db.query(`SELECT value FROM business_settings WHERE key = 'meta_access_token' LIMIT 1`);
            if (row.rows[0]?.value) { token = row.rows[0].value; source = 'database'; }
        } catch { /* ignore */ }

        if (!token && process.env.META_ACCESS_TOKEN) {
            token = process.env.META_ACCESS_TOKEN;
            source = 'env';
        }

        if (!token) {
            res.json({ configured: false, oauth_available: !!(process.env.META_APP_ID && process.env.META_APP_SECRET) });
            return;
        }

        const meRes = await axios.get('https://graph.facebook.com/v21.0/me', {
            params: { fields: 'name,id', access_token: token },
            timeout: 10000,
        });

        let expiresAt: string | null = null;
        try {
            const expRow = await db.query(`SELECT value FROM business_settings WHERE key = 'meta_token_expires_at' LIMIT 1`);
            expiresAt = expRow.rows[0]?.value ?? null;
        } catch { /* ignore */ }

        res.json({
            configured: true,
            valid: true,
            user_name: meRes.data.name,
            user_id: meRes.data.id,
            expires_at: expiresAt,
            source,
            oauth_available: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
        });
    } catch (err: any) {
        const fbErr = err.response?.data?.error;
        res.json({
            configured: true,
            valid: false,
            error: fbErr?.message || err.message,
            oauth_available: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
        });
    }
});

// POST /api/campaigns/meta-token — save token manually
router.post('/meta-token', async (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token?.trim()) { res.status(400).json({ error: 'token requerido' }); return; }

    try {
        const meRes = await axios.get('https://graph.facebook.com/v21.0/me', {
            params: { fields: 'name,id', access_token: token },
            timeout: 10000,
        });

        let finalToken = token;
        let expiresAt: string | null = null;
        let exchanged = false;

        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;

        if (appId && appSecret) {
            try {
                const longRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
                    params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: token },
                    timeout: 10000,
                });
                finalToken = longRes.data.access_token;
                if (longRes.data.expires_in) {
                    expiresAt = new Date(Date.now() + longRes.data.expires_in * 1000).toISOString();
                }
                exchanged = true;
            } catch { /* use original token */ }
        }

        await db.query(
            `INSERT INTO business_settings (key, value) VALUES ('meta_access_token', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [finalToken]
        );
        if (expiresAt) {
            await db.query(
                `INSERT INTO business_settings (key, value) VALUES ('meta_token_expires_at', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [expiresAt]
            );
        }

        res.json({ ok: true, user_name: meRes.data.name, exchanged, expires_at: expiresAt });
    } catch (err: any) {
        const fbErr = err.response?.data?.error;
        res.status(400).json({ error: fbErr?.message || err.message || 'Token inválido' });
    }
});

// DELETE /api/campaigns/meta-token — disconnect
router.delete('/meta-token', async (_req: Request, res: Response) => {
    await db.query(`DELETE FROM business_settings WHERE key IN ('meta_access_token', 'meta_token_expires_at')`);
    res.json({ ok: true });
});

// GET /api/campaigns/meta-oauth/start — generate OAuth URL
router.get('/meta-oauth/start', (_req: Request, res: Response) => {
    const appId = process.env.META_APP_ID;
    const redirectUri = process.env.META_OAUTH_REDIRECT ||
        `${process.env.SERVER_URL || 'http://localhost:3001'}/api/campaigns/meta-oauth/callback`;

    if (!appId) {
        res.status(400).json({
            error: 'META_APP_ID no configurado',
            hint: 'Crea una Facebook App en https://developers.facebook.com y agrega META_APP_ID y META_APP_SECRET al .env',
        });
        return;
    }

    const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'ads_read,ads_management');
    url.searchParams.set('response_type', 'code');

    res.json({ url: url.toString() });
});

// GET /api/campaigns/meta-oauth/callback — OAuth callback (registered as public in index.ts)
router.get('/meta-oauth/callback', async (req: Request, res: Response) => {
    const { code, error: fbError } = req.query;
    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';

    if (fbError || !code) {
        res.redirect(`${frontendUrl}/settings?meta_error=${fbError || 'cancelled'}`);
        return;
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = process.env.META_OAUTH_REDIRECT ||
        `${process.env.SERVER_URL || 'http://localhost:3001'}/api/campaigns/meta-oauth/callback`;

    if (!appId || !appSecret) {
        res.redirect(`${frontendUrl}/settings?meta_error=no_app_config`);
        return;
    }

    try {
        const tokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
            params: { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code },
            timeout: 20000,
        });

        let accessToken = tokenRes.data.access_token;

        const longRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
            params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: accessToken },
            timeout: 20000,
        });
        accessToken = longRes.data.access_token;
        const expiresIn = longRes.data.expires_in;
        const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

        await db.query(
            `INSERT INTO business_settings (key, value) VALUES ('meta_access_token', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [accessToken]
        );
        if (expiresAt) {
            await db.query(
                `INSERT INTO business_settings (key, value) VALUES ('meta_token_expires_at', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [expiresAt]
            );
        }

        res.redirect(`${frontendUrl}/settings?meta=connected`);
    } catch (err: any) {
        console.error('meta-oauth callback error:', err.response?.data || err.message);
        res.redirect(`${frontendUrl}/settings?meta_error=token_exchange_failed`);
    }
});

// ─────────────────────────────────────────────────────────────────────────────

// POST /api/campaigns/sync-facebook — sincroniza campañas desde Meta Marketing API
// Requiere META_ACCESS_TOKEN en .env o token en el body (ad-hoc desde Settings)
router.post('/sync-facebook', async (req: Request, res: Response) => {
    try {
        // 1. Token priority: body (ad-hoc) > business_settings (UI-managed) > env
        let accessToken: string | null = req.body?.access_token || null;

        if (!accessToken) {
            try {
                const settingsRow = await db.query(
                    `SELECT value FROM business_settings WHERE key = 'meta_access_token' LIMIT 1`
                );
                accessToken = settingsRow.rows[0]?.value ?? null;
            } catch { /* ignore */ }
        }

        if (!accessToken) accessToken = process.env.META_ACCESS_TOKEN || null;

        if (!accessToken) {
            res.status(400).json({
                error: 'Sin token de Meta API',
                hint: 'Configura el token en Settings → Integraciones → Meta Ads API.',
                docs: 'https://developers.facebook.com/tools/explorer/',
            });
            return;
        }

        // 2. Obtener todas las cuentas publicitarias del usuario
        const accountsRes = await axios.get('https://graph.facebook.com/v21.0/me/adaccounts', {
            params: { fields: 'id,name,account_status,currency', access_token: accessToken, limit: 100 },
            timeout: 20000,
        });

        const accounts: any[] = accountsRes.data?.data ?? [];
        if (accounts.length === 0) {
            res.json({ imported: 0, accounts: [], message: 'No se encontraron cuentas publicitarias' });
            return;
        }

        // 3. Para cada cuenta, obtener campañas y upsertear en BD
        let totalImported = 0;
        const accountResults: { id: string; name: string; campaigns: number }[] = [];
        const errors: string[] = [];

        for (const account of accounts) {
            try {
                // Fetch campaigns and ad sets in parallel to detect Instagram-only placements
                const [campaignsRes, adSetsRes] = await Promise.all([
                    axios.get(`https://graph.facebook.com/v21.0/${account.id}/campaigns`, {
                        params: {
                            fields: 'id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time',
                            access_token: accessToken,
                            limit: 500,
                        },
                        timeout: 20000,
                    }),
                    axios.get(`https://graph.facebook.com/v21.0/${account.id}/adsets`, {
                        params: {
                            fields: 'campaign_id,publisher_platforms',
                            access_token: accessToken,
                            limit: 1000,
                        },
                        timeout: 20000,
                    }).catch(() => ({ data: { data: [] } })), // ignore adsets errors
                ]);

                // Build map: campaign_id -> set of publisher_platforms
                const campaignPlatforms = new Map<string, Set<string>>();
                for (const adSet of (adSetsRes.data?.data ?? [])) {
                    if (!campaignPlatforms.has(adSet.campaign_id)) {
                        campaignPlatforms.set(adSet.campaign_id, new Set());
                    }
                    for (const p of (adSet.publisher_platforms ?? [])) {
                        campaignPlatforms.get(adSet.campaign_id)!.add(p as string);
                    }
                }

                // Detect primary platform for a campaign
                const detectPlatform = (campId: string): string => {
                    const platforms = campaignPlatforms.get(campId);
                    if (!platforms || platforms.size === 0) return 'facebook';
                    const hasIG = platforms.has('instagram');
                    const hasFB = platforms.has('facebook') || platforms.has('audience_network') || platforms.has('messenger');
                    if (hasIG && !hasFB) return 'instagram';
                    return 'facebook'; // mixed or Facebook-only
                };

                const fbCampaigns: any[] = campaignsRes.data?.data ?? [];
                let accountImported = 0;

                for (const fbCamp of fbCampaigns) {
                    const platform = detectPlatform(fbCamp.id);
                    const ai_instructions = `
# Campaña: ${fbCamp.name}
Eres un asistente de ventas para la campaña "${fbCamp.name}" en Meta Ads (${platform}).
Tu objetivo principal es asistir al usuario que vio nuestro anuncio en redes sociales.
Aprovecha que los usuarios de redes buscan respuestas rápidas, ofréceles el catálogo y pregúntales directamente qué tipo de prueba médica necesitan.
`;
                    await db.query(
                        `INSERT INTO campaigns (platform, platform_campaign_id, name, metadata, is_active, ai_instructions)
                         VALUES ($1, $2, $3, $4, $5, $6)
                         ON CONFLICT (platform, platform_campaign_id)
                         DO UPDATE SET name = EXCLUDED.name, metadata = EXCLUDED.metadata, platform = EXCLUDED.platform, ai_instructions = COALESCE(campaigns.ai_instructions, EXCLUDED.ai_instructions)`,
                        [
                            platform,
                            fbCamp.id,
                            fbCamp.name,
                            JSON.stringify({
                                account_id: account.id,
                                account_name: account.name,
                                status: fbCamp.status,
                                objective: fbCamp.objective,
                                daily_budget: fbCamp.daily_budget ? Number(fbCamp.daily_budget) / 100 : null,
                                lifetime_budget: fbCamp.lifetime_budget ? Number(fbCamp.lifetime_budget) / 100 : null,
                                currency: account.currency,
                                synced_at: new Date().toISOString(),
                            }),
                            fbCamp.status === 'ACTIVE',
                            ai_instructions
                        ]
                    );
                    totalImported++;
                    accountImported++;
                }

                // --- GASTO DIARIO vía Facebook Insights API ---
                try {
                    const insightsRes = await axios.get(
                        `https://graph.facebook.com/v21.0/${account.id}/insights`,
                        {
                            params: {
                                fields: 'campaign_id,spend',
                                date_preset: 'last_90_days',
                                time_increment: 1,      // breakdown diario
                                level: 'campaign',
                                access_token: accessToken,
                                limit: 5000,
                            },
                            timeout: 30000,
                        }
                    );
                    const currency = account.currency ?? 'MXN';
                    for (const row of (insightsRes.data?.data ?? [])) {
                        const fbCampaignId = String(row.campaign_id);
                        const spendDate    = row.date_start;    // "YYYY-MM-DD" (daily breakdown)
                        const spendAmount  = parseFloat(row.spend ?? '0').toFixed(6);
                        if (!spendDate) continue;
                        await db.query(
                            `INSERT INTO campaign_daily_spend (campaign_id, spend_date, spend_amount, currency)
                             SELECT c.id, $2, $3, $4
                             FROM campaigns c
                             WHERE c.platform IN ('facebook', 'instagram') AND c.platform_campaign_id = $1
                             ON CONFLICT (campaign_id, spend_date)
                             DO UPDATE SET spend_amount = EXCLUDED.spend_amount, synced_at = NOW()`,
                            [fbCampaignId, spendDate, spendAmount, currency]
                        );
                    }
                } catch (insightsErr: any) {
                    // No bloquear el sync si falla insights
                    console.warn(`[sync-facebook] insights failed for account ${account.id}:`, insightsErr.response?.data?.error?.message || insightsErr.message);
                }

                accountResults.push({ id: account.id, name: account.name, campaigns: accountImported });
            } catch (accountErr: any) {
                const msg = accountErr.response?.data?.error?.message || accountErr.message;
                errors.push(`${account.name}: ${msg}`);
            }
        }

        res.json({
            imported: totalImported,
            accounts: accountResults,
            errors: errors.length > 0 ? errors : undefined,
        });

    } catch (error: any) {
        const fbError = error.response?.data?.error;
        console.error('sync-facebook error:', fbError || error.message);
        res.status(500).json({
            error: 'Error al sincronizar con Facebook',
            detail: fbError?.message || error.message,
            code: fbError?.code,
        });
    }
});

// ── Google Ads Token Management ───────────────────────────────────────────────

// GET /api/campaigns/google-token — check Google Ads token status
router.get('/google-token', async (_req: Request, res: Response) => {
    try {
        const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
        const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
        const oauth_available = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

        // Read developer token: DB > env
        const dtRow = await db.query(`SELECT value FROM business_settings WHERE key = 'google_developer_token' LIMIT 1`).catch(() => ({ rows: [] }));
        const devTokenDb: string | null = dtRow.rows[0]?.value ?? null;
        const devToken: string | null = devTokenDb || process.env.GOOGLE_DEVELOPER_TOKEN || null;

        // Read MCC ID: DB > env
        const mccRow = await db.query(`SELECT value FROM business_settings WHERE key = 'google_ads_mcc_id' LIMIT 1`).catch(() => ({ rows: [] }));
        const mccIdDb: string | null = mccRow.rows[0]?.value ?? null;
        const mccId: string | null = mccIdDb || (process.env.GOOGLE_ADS_MCC_ID || '').replace(/-/g, '') || null;

        const row = await db.query(`SELECT value FROM business_settings WHERE key = 'google_refresh_token' LIMIT 1`).catch(() => ({ rows: [] }));
        const refreshToken: string | null = row.rows[0]?.value ?? null;

        const baseInfo = {
            developer_token_set: !!devToken,
            developer_token_masked: devToken ? `${'*'.repeat(Math.max(0, devToken.length - 6))}${devToken.slice(-6)}` : null,
            mcc_id: mccId,
            mcc_id_set: !!mccId,
        };

        if (!refreshToken) {
            res.json({ configured: false, oauth_available, ...baseInfo });
            return;
        }

        // Exchange refresh token for access token to verify it works
        try {
            const tokenRes = await axios.post('https://oauth2.googleapis.com/token',
                new URLSearchParams({
                    client_id: GOOGLE_CLIENT_ID!,
                    client_secret: GOOGLE_CLIENT_SECRET!,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                }).toString(),
                { timeout: 10000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
            const accessToken = tokenRes.data.access_token;

            if (!accessToken) {
                throw new Error('No se recibió access_token de Google');
            }

            // Verify token info
            let userEmail: string | null = null;
            try {
                const tokenInfoRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`, { timeout: 8000 });
                userEmail = tokenInfoRes.data.email || null;
            } catch { /* optional */ }

            res.json({ configured: true, valid: true, user_email: userEmail, oauth_available, ...baseInfo });
        } catch (e: any) {
            const detail = e.response?.data?.error_description || e.response?.data?.error || e.message;
            res.json({ configured: true, valid: false, error: detail, oauth_available, ...baseInfo });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/campaigns/google-config — save developer token and/or MCC ID to DB
router.post('/google-config', async (req: Request, res: Response) => {
    const { developer_token, mcc_id } = req.body;
    const updates: string[] = [];

    try {
        if (developer_token !== undefined) {
            const val = (developer_token || '').trim();
            if (val) {
                await db.query(
                    `INSERT INTO business_settings (key, value) VALUES ('google_developer_token', $1)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [val]
                );
            } else {
                await db.query(`DELETE FROM business_settings WHERE key = 'google_developer_token'`);
            }
            updates.push('developer_token');
        }
        if (mcc_id !== undefined) {
            const val = (mcc_id || '').replace(/-/g, '').trim();
            if (val) {
                await db.query(
                    `INSERT INTO business_settings (key, value) VALUES ('google_ads_mcc_id', $1)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [val]
                );
            } else {
                await db.query(`DELETE FROM business_settings WHERE key = 'google_ads_mcc_id'`);
            }
            updates.push('mcc_id');
        }
        res.json({ ok: true, updated: updates });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/campaigns/google-token — disconnect Google (keeps developer_token and mcc_id)
router.delete('/google-token', async (_req: Request, res: Response) => {
    await db.query(`DELETE FROM business_settings WHERE key = 'google_refresh_token'`).catch(() => { });
    res.json({ ok: true });
});

// GET /api/campaigns/google-oauth/start — generate Google OAuth URL
router.get('/google-oauth/start', (_req: Request, res: Response) => {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
    if (!GOOGLE_CLIENT_ID) {
        res.status(400).json({ error: 'GOOGLE_CLIENT_ID no configurado en .env' });
        return;
    }
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', `${SERVER_URL}/api/campaigns/google-oauth/callback`);
    url.searchParams.set('scope', 'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent'); // force refresh_token on every auth
    res.json({ url: url.toString() });
});

// GET /api/campaigns/google-oauth/callback — OAuth callback (must be public, registered in index.ts)
router.get('/google-oauth/callback', async (req: Request, res: Response) => {
    const { code, error } = req.query as { code?: string; error?: string };
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';

    if (error || !code) {
        res.redirect(`${FRONTEND_URL}/settings?google_error=${encodeURIComponent(error || 'no_code')}`);
        return;
    }

    try {
        // Exchange code for tokens
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token',
            new URLSearchParams({
                code: code as string,
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: `${SERVER_URL}/api/campaigns/google-oauth/callback`,
                grant_type: 'authorization_code',
            }).toString(),
            { timeout: 15000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const { refresh_token, access_token } = tokenRes.data;
        if (!refresh_token) {
            res.redirect(`${FRONTEND_URL}/settings?google_error=no_refresh_token`);
            return;
        }

        // Save refresh token
        await db.query(
            `INSERT INTO business_settings (key, value) VALUES ('google_refresh_token', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [refresh_token]
        );

        // Try to auto-detect Google Ads developer token if already in env
        if (process.env.GOOGLE_DEVELOPER_TOKEN) {
            await db.query(
                `INSERT INTO business_settings (key, value) VALUES ('google_developer_token', $1)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [process.env.GOOGLE_DEVELOPER_TOKEN]
            ).catch(() => { });
        }

        res.redirect(`${FRONTEND_URL}/settings?google=connected`);
    } catch (e: any) {
        const msg = e.response?.data?.error_description || e.message;
        console.error('Google OAuth callback error:', msg);
        res.redirect(`${FRONTEND_URL}/settings?google_error=${encodeURIComponent(msg)}`);
    }
});

// POST /api/campaigns/sync-google — sync campaigns from Google Ads API
router.post('/sync-google', async (req: Request, res: Response) => {
    try {
        const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
        const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

        // Get developer token (env > DB)
        let developerToken: string | null = process.env.GOOGLE_DEVELOPER_TOKEN || null;
        if (!developerToken) {
            const dtRow = await db.query(`SELECT value FROM business_settings WHERE key = 'google_developer_token' LIMIT 1`).catch(() => ({ rows: [] }));
            developerToken = dtRow.rows[0]?.value ?? null;
        }

        // Get refresh token
        const rtRow = await db.query(`SELECT value FROM business_settings WHERE key = 'google_refresh_token' LIMIT 1`).catch(() => ({ rows: [] }));
        const refreshToken: string | null = rtRow.rows[0]?.value ?? null;

        if (!refreshToken) {
            res.status(400).json({ error: 'No hay cuenta de Google Ads conectada', hint: 'Conecta tu cuenta en Settings → Integraciones → Google Ads' });
            return;
        }
        if (!developerToken) {
            res.status(400).json({ error: 'GOOGLE_DEVELOPER_TOKEN no configurado', hint: 'Agrega GOOGLE_DEVELOPER_TOKEN en .env (Google Ads → Herramientas → Centro de API)' });
            return;
        }
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            res.status(400).json({ error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no configurados en .env' });
            return;
        }

        // Exchange refresh token for access token
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token',
            new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID!,
                client_secret: GOOGLE_CLIENT_SECRET!,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }).toString(),
            { timeout: 10000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        const accessToken = tokenRes.data.access_token;

        // MCC (Manager Account) ID — DB > env
        const mccRow = await db.query(`SELECT value FROM business_settings WHERE key = 'google_ads_mcc_id' LIMIT 1`).catch(() => ({ rows: [] }));
        const MCC_ID = (mccRow.rows[0]?.value || process.env.GOOGLE_ADS_MCC_ID || '').replace(/-/g, '');

        const authHeaders: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'developer-token': developerToken,
            ...(MCC_ID ? { 'login-customer-id': MCC_ID } : {}),
        };
        console.log("Token Response Data:", tokenRes.data);
        console.log("Auth Headers:", { ...authHeaders, Authorization: '[redacted]' });
        console.log("MCC_ID:", MCC_ID);

        // Get list of accessible customer accounts
        const customersRes = await axios.get('https://googleads.googleapis.com/v23/customers:listAccessibleCustomers', {
            headers: authHeaders,
            timeout: 15000,
        });
        const resourceNames: string[] = customersRes.data.resourceNames ?? [];

        let totalImported = 0;
        const accountResults: { id: string; name: string; campaigns: number }[] = [];
        const errors: string[] = [];

        for (const resourceName of resourceNames) {
            const customerId = resourceName.replace('customers/', '');
            // Skip querying the MCC itself — it has no campaigns
            if (MCC_ID && customerId === MCC_ID) {
                accountResults.push({ id: customerId, name: 'MCC (amun0326)', campaigns: 0 });
                continue;
            }
            try {
                // For each customer, try direct access first (login-customer-id = customerId),
                // then fall back to MCC access if direct fails.
                let searchRes: any;
                let successfulLoginId = customerId; // track which login-customer-id worked
                const searchQuery = {
                    query: `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
                                   campaign.base_campaign, customer.descriptive_name
                            FROM campaign
                            WHERE campaign.status != 'REMOVED'
                            ORDER BY campaign.id`,
                };
                try {
                    // First attempt: direct access using customer's own ID
                    searchRes = await axios.post(
                        `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:search`,
                        searchQuery,
                        { headers: { ...authHeaders, 'login-customer-id': customerId }, timeout: 20000 }
                    );
                } catch (directErr: any) {
                    const directStatus = directErr.response?.status;
                    if ((directStatus === 403 || directStatus === 401) && MCC_ID) {
                        // Second attempt: access through MCC
                        successfulLoginId = MCC_ID;
                        searchRes = await axios.post(
                            `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:search`,
                            searchQuery,
                            { headers: { ...authHeaders, 'login-customer-id': MCC_ID }, timeout: 20000 }
                        );
                    } else {
                        throw directErr;
                    }
                }

                const rows: any[] = searchRes.data?.results ?? [];
                let accountImported = 0;
                const customerName = rows[0]?.customer?.descriptiveName || customerId;

                for (const row of rows) {
                    const camp = row.campaign;
                    const channelType: string = camp.advertisingChannelType || 'UNKNOWN';
                    // Determine platform: YouTube → youtube, Display/Performance Max → google, Search/Shopping → google
                    const platform = 'google';
                    const ai_instructions = `
# Campaña: ${camp.name}
Eres un asistente de ventas para la campaña "${camp.name}" en Google Ads.
Tu objetivo principal es asistir al usuario que hizo clic en nuestro anuncio de Google.
Debes ofrecer información clara sobre nuestros productos médicos y pruebas rápidas.
Si preguntan por el precio, infórmales de manera cordial y ofrece un descuento especial por venir de la campaña de Google.
`;
                    await db.query(
                        `INSERT INTO campaigns (platform, platform_campaign_id, name, metadata, is_active, ai_instructions)
                         VALUES ($1, $2, $3, $4, $5, $6)
                         ON CONFLICT (platform, platform_campaign_id)
                         DO UPDATE SET name = EXCLUDED.name, metadata = EXCLUDED.metadata, ai_instructions = COALESCE(campaigns.ai_instructions, EXCLUDED.ai_instructions)`,
                        [
                            platform,
                            String(camp.id),
                            camp.name,
                            JSON.stringify({
                                account_id: customerId,
                                account_name: customerName,
                                status: camp.status,
                                channel_type: channelType,
                                synced_at: new Date().toISOString(),
                            }),
                            camp.status === 'ENABLED',
                            ai_instructions
                        ]
                    );
                    totalImported++;
                    accountImported++;
                }

                // --- GASTO DIARIO: segunda query GAQL con segments.date ---
                try {
                    const today = new Date();
                    const from90 = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    const dateFrom = from90.toISOString().split('T')[0];  // "YYYY-MM-DD"
                    const dateTo   = today.toISOString().split('T')[0];
                    const spendQuery = {
                        query: `SELECT campaign.id, segments.date, metrics.cost_micros
                                FROM campaign
                                WHERE campaign.status != 'REMOVED'
                                  AND segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
                                ORDER BY campaign.id, segments.date`,
                    };
                    const spendRes = await axios.post(
                        `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:search`,
                        spendQuery,
                        { headers: { ...authHeaders, 'login-customer-id': successfulLoginId }, timeout: 30000 }
                    );
                    for (const spendRow of (spendRes.data?.results ?? [])) {
                        const googleCampaignId = String(spendRow.campaign?.id);
                        const spendDate        = spendRow.segments?.date;       // "YYYY-MM-DD"
                        const spendAmount      = ((Number(spendRow.metrics?.costMicros) || 0) / 1_000_000).toFixed(6);
                        if (!spendDate) continue;
                        await db.query(
                            `INSERT INTO campaign_daily_spend (campaign_id, spend_date, spend_amount, currency)
                             SELECT c.id, $2, $3, COALESCE(c.spend_currency, 'MXN')
                             FROM campaigns c
                             WHERE c.platform = 'google' AND c.platform_campaign_id = $1
                             ON CONFLICT (campaign_id, spend_date)
                             DO UPDATE SET spend_amount = EXCLUDED.spend_amount, synced_at = NOW()`,
                            [googleCampaignId, spendDate, spendAmount]
                        );
                    }
                } catch (spendErr: any) {
                    console.warn(`[sync-google] spend query failed for customer ${customerId}:`, spendErr.response?.data?.error?.message || spendErr.message);
                }

                accountResults.push({ id: customerId, name: customerName, campaigns: accountImported });
            } catch (custErr: any) {
                const msg = custErr.response?.data?.error?.message || custErr.message;
                errors.push(`Customer ${customerId}: ${msg}`);
            }
        }

        res.json({ imported: totalImported, accounts: accountResults, errors: errors.length > 0 ? errors : undefined });

    } catch (error: any) {
        if (error.response) {
            console.error('Google Ads API Error Status:', error.response.status);
            console.error('Google Ads API Error Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('sync-google error:', error.message);
        }
        res.status(500).json({
            error: 'Error al sincronizar con Google Ads',
            detail: error.response?.data?.error?.message || error.message,
            googleResponse: error.response?.data,
            debugInfo: {
                errorStack: error.stack
            }
        });
    }
});

// POST /api/campaigns
router.post('/', async (req: Request, res: Response) => {
    const { platform, platform_campaign_id, platform_ad_set_id, platform_ad_id, name, metadata } = req.body;

    const result = await db.query(
        `INSERT INTO campaigns (platform, platform_campaign_id, platform_ad_set_id, platform_ad_id, name, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (platform, platform_campaign_id) DO UPDATE
             SET name = EXCLUDED.name, metadata = EXCLUDED.metadata
         RETURNING *`,
        [platform, platform_campaign_id, platform_ad_set_id, platform_ad_id, name, metadata]
    );
    res.status(201).json(result.rows[0]);
});

router.patch('/:id', async (req: Request, res: Response) => {
    const { name, is_active, metadata, ai_instructions } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined) { params.push(name); sets.push(`name = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); sets.push(`is_active = $${params.length}`); }
    if (metadata !== undefined) { params.push(JSON.stringify(metadata)); sets.push(`metadata = $${params.length}`); }
    if (ai_instructions !== undefined) { params.push(ai_instructions); sets.push(`ai_instructions = $${params.length}`); }

    if (sets.length === 0) { res.status(400).json({ error: 'nothing to update' }); return; }
    params.push(req.params.id);
    const result = await db.query(
        `UPDATE campaigns SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    res.json(result.rows[0]);
});

// GET /api/campaigns/:id/attributions
router.get('/:id/attributions', async (req: Request, res: Response) => {
    const result = await db.query(
        `SELECT a.*,
                cu.display_name AS customer_name,
                o.external_order_id, o.total_amount, o.status AS order_status
         FROM attributions a
         JOIN customers cu ON cu.id = a.customer_id
         LEFT JOIN orders o ON o.id = a.order_id
         WHERE a.campaign_id = $1
         ORDER BY a.attributed_at DESC`,
        [req.params.id]
    );
    res.json(result.rows);
});

export default router;
