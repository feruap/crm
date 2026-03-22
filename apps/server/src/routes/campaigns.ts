import { Router, Request, Response } from 'express';
import { db } from '../db';
import axios from 'axios';

const router = Router();

// GET /api/campaigns
router.get('/', async (_req: Request, res: Response) => {
    const result = await db.query(`
        SELECT c.*,
               COUNT(DISTINCT a.customer_id) AS total_customers,
               COUNT(DISTINCT a.order_id)    AS total_orders,
               COALESCE(SUM(o.total_amount), 0) AS total_revenue
        FROM campaigns c
        LEFT JOIN attributions a ON a.campaign_id = c.id
        LEFT JOIN orders o ON o.id = a.order_id
        GROUP BY c.id
        ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
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

// Helper: get Meta access token (DB takes priority, then env)
async function getMetaAccessToken(): Promise<string | null> {
    try {
        const row = await db.query(`SELECT value FROM business_settings WHERE key = 'meta_access_token' LIMIT 1`);
        if (row.rows[0]?.value) return row.rows[0].value;
    } catch { /* ignore */ }
    return process.env.META_ACCESS_TOKEN || null;
}

// GET /api/campaigns/meta-token — check token status
router.get('/meta-token', async (_req: Request, res: Response) => {
    try {
        const token = await getMetaAccessToken();
        if (!token) {
            res.json({ configured: false, valid: false, source: null });
            return;
        }
        // Check if DB or env
        const dbRow = await db.query(`SELECT value FROM business_settings WHERE key = 'meta_access_token' LIMIT 1`).catch(() => ({ rows: [] }));
        const source = dbRow.rows[0]?.value ? 'database' : 'env';
        // Validate token with a lightweight Graph API call
        try {
            const resp = await axios.get(`https://graph.facebook.com/v21.0/me`, {
                params: { access_token: token, fields: 'id,name' },
                timeout: 10000,
            });
            const masked = token.substring(0, 10) + '...' + token.substring(token.length - 6);
            res.json({
                configured: true,
                valid: true,
                source,
                masked_token: masked,
                meta_user: resp.data?.name || resp.data?.id || null,
            });
        } catch (apiErr: any) {
            const masked = token.substring(0, 10) + '...' + token.substring(token.length - 6);
            res.json({
                configured: true,
                valid: false,
                source,
                masked_token: masked,
                error: apiErr.response?.data?.error?.message || 'Token validation failed',
            });
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/campaigns/meta-token — save token manually
router.post('/meta-token', async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        if (!token || typeof token !== 'string' || !token.startsWith('EAA')) {
            res.status(400).json({ error: 'Token inválido. Debe iniciar con EAA...' });
            return;
        }
        // Validate before saving
        try {
            await axios.get(`https://graph.facebook.com/v21.0/me`, {
                params: { access_token: token, fields: 'id,name' },
                timeout: 10000,
            });
        } catch (apiErr: any) {
            res.status(400).json({ error: `Token no válido: ${apiErr.response?.data?.error?.message || apiErr.message}` });
            return;
        }
        // Save to business_settings
        await db.query(
            `INSERT INTO business_settings (key, value) VALUES ('meta_access_token', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [token]
        );
        res.json({ ok: true, message: 'Token de Meta guardado correctamente' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/campaigns/meta-token — remove saved token
router.delete('/meta-token', async (_req: Request, res: Response) => {
    try {
        await db.query(`DELETE FROM business_settings WHERE key = 'meta_access_token'`);
        res.json({ ok: true, message: 'Token de Meta eliminado' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/campaigns/google-config — save Google Ads developer token & MCC ID
router.post('/google-config', async (req: Request, res: Response) => {
    try {
        const { developer_token, mcc_id } = req.body;
        if (developer_token) {
            await db.query(
                `INSERT INTO business_settings (key, value) VALUES ('google_developer_token', $1)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [developer_token]
            );
        }
        if (mcc_id) {
            await db.query(
                `INSERT INTO business_settings (key, value) VALUES ('google_ads_mcc_id', $1)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [mcc_id]
            );
        }
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/campaigns/google-token — check Google token status
router.get('/google-token', async (_req: Request, res: Response) => {
    try {
        const rtRow = await db.query(`SELECT value FROM business_settings WHERE key = 'google_refresh_token' LIMIT 1`).catch(() => ({ rows: [] }));
        const dtRow = await db.query(`SELECT value FROM business_settings WHERE key = 'google_developer_token' LIMIT 1`).catch(() => ({ rows: [] }));
        const mccRow = await db.query(`SELECT value FROM business_settings WHERE key = 'google_ads_mcc_id' LIMIT 1`).catch(() => ({ rows: [] }));

        const hasRefresh = !!(rtRow.rows[0]?.value || process.env.GOOGLE_ADS_REFRESH_TOKEN);
        const hasDev = !!(dtRow.rows[0]?.value || process.env.GOOGLE_DEVELOPER_TOKEN);
        const mccId = mccRow.rows[0]?.value || process.env.GOOGLE_ADS_MCC_ID || null;

        res.json({
            configured: hasRefresh && hasDev,
            connected: hasRefresh,
            developer_token_set: hasDev,
            mcc_id: mccId,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/campaigns/google-token — disconnect Google
router.delete('/google-token', async (_req: Request, res: Response) => {
    try {
        await db.query(`DELETE FROM business_settings WHERE key IN ('google_refresh_token', 'google_developer_token', 'google_ads_mcc_id')`);
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/campaigns/sync-facebook
// Imports campaigns from Meta Ads API using the configured access token
// Supports META_AD_ACCOUNT_ID env var for direct ad account access (System User tokens)
router.post('/sync-facebook', async (_req: Request, res: Response) => {
    const accessToken = await getMetaAccessToken();
    if (!accessToken) {
        res.status(400).json({ error: 'META_ACCESS_TOKEN no configurado. Ve a Ajustes → Integraciones para agregar tu token.' });
        return;
    }

    const GRAPH_VERSION = 'v21.0';

    try {
        let adAccounts: any[] = [];

        // If META_AD_ACCOUNT_ID is set, use it directly (works with System User tokens)
        const directAccountId = process.env.META_AD_ACCOUNT_ID;
        if (directAccountId) {
            const actId = directAccountId.startsWith('act_') ? directAccountId : `act_${directAccountId}`;
            adAccounts = [{ id: actId, account_id: directAccountId.replace('act_', ''), name: 'Direct Account' }];
        } else {
            // Step 1: Get ad accounts via /me/adaccounts (requires User access token)
            const meResp = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,account_id',
                    limit: 50,
                },
            });
            adAccounts = meResp.data?.data || [];
        }

        if (adAccounts.length === 0) {
            res.json({ imported: 0, message: 'No ad accounts found. Set META_AD_ACCOUNT_ID env var if using a System User token.' });
            return;
        }

        let totalImported = 0;

        for (const account of adAccounts) {
            // Step 2: Get campaigns for each ad account
            const campaignsResp = await axios.get(
                `https://graph.facebook.com/${GRAPH_VERSION}/${account.id}/campaigns`,
                {
                    params: {
                        access_token: accessToken,
                        fields: 'id,name,status,objective,start_time,stop_time',
                        limit: 100,
                    },
                }
            );

            const fbCampaigns = campaignsResp.data?.data || [];

            for (const fbCamp of fbCampaigns) {
                // Step 3: Get ad sets for each campaign
                let adSets: any[] = [];
                try {
                    const adSetsResp = await axios.get(
                        `https://graph.facebook.com/${GRAPH_VERSION}/${fbCamp.id}/adsets`,
                        {
                            params: {
                                access_token: accessToken,
                                fields: 'id,name,status',
                                limit: 100,
                            },
                        }
                    );
                    adSets = adSetsResp.data?.data || [];
                } catch { /* ignore adset fetch errors */ }

                // Step 4: Get ads for each campaign
                let ads: any[] = [];
                try {
                    const adsResp = await axios.get(
                        `https://graph.facebook.com/${GRAPH_VERSION}/${fbCamp.id}/ads`,
                        {
                            params: {
                                access_token: accessToken,
                                fields: 'id,name,status',
                                limit: 100,
                            },
                        }
                    );
                    ads = adsResp.data?.data || [];
                } catch { /* ignore ad fetch errors */ }

                // Upsert campaign
                const metadata = {
                    account_id: account.account_id,
                    account_name: account.name,
                    objective: fbCamp.objective,
                    status: fbCamp.status,
                    start_time: fbCamp.start_time,
                    stop_time: fbCamp.stop_time,
                    ad_sets: adSets.map((s: any) => ({ id: s.id, name: s.name, status: s.status })),
                    ads: ads.map((a: any) => ({ id: a.id, name: a.name, status: a.status })),
                };

                await db.query(
                    `INSERT INTO campaigns (platform, platform_campaign_id, name, metadata)
                     VALUES ('facebook', $1, $2, $3)
                     ON CONFLICT (platform, platform_campaign_id) DO UPDATE
                         SET name = EXCLUDED.name,
                             metadata = EXCLUDED.metadata`,
                    [fbCamp.id, fbCamp.name, JSON.stringify(metadata)]
                );
                totalImported++;

                // Also upsert individual ads as separate campaign entries for granular tracking
                for (const ad of ads) {
                    const adSetForAd = adSets.length > 0 ? adSets[0] : null;
                    await db.query(
                        `INSERT INTO campaigns (platform, platform_campaign_id, platform_ad_set_id, platform_ad_id, name, metadata)
                         VALUES ('facebook', $1, $2, $3, $4, $5)
                         ON CONFLICT (platform, platform_campaign_id) DO UPDATE
                             SET name = EXCLUDED.name,
                                 platform_ad_set_id = EXCLUDED.platform_ad_set_id,
                                 platform_ad_id = EXCLUDED.platform_ad_id,
                                 metadata = EXCLUDED.metadata`,
                        [
                            `${fbCamp.id}_ad_${ad.id}`,
                            adSetForAd?.id || null,
                            ad.id,
                            `${fbCamp.name} > ${ad.name}`,
                            JSON.stringify({ ...metadata, ad_name: ad.name, ad_status: ad.status }),
                        ]
                    );
                    totalImported++;
                }
            }
        }

        res.json({ imported: totalImported, message: `Imported ${totalImported} campaigns from Facebook` });
    } catch (err: any) {
        console.error('Facebook sync error:', err.response?.data || err.message);
        res.status(500).json({
            error: 'Failed to sync from Facebook',
            details: err.response?.data?.error?.message || err.message,
        });
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
            if (MCC_ID && customerId === MCC_ID) {
                accountResults.push({ id: customerId, name: 'MCC', campaigns: 0 });
                continue;
            }
            try {
                let searchRes: any;
                let successfulLoginId = customerId;
                const searchQuery = {
                    query: `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
                                   campaign.base_campaign, customer.descriptive_name
                            FROM campaign
                            WHERE campaign.status != 'REMOVED'
                            ORDER BY campaign.id`,
                };
                try {
                    searchRes = await axios.post(
                        `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:search`,
                        searchQuery,
                        { headers: { ...authHeaders, 'login-customer-id': customerId }, timeout: 20000 }
                    );
                } catch (directErr: any) {
                    const directStatus = directErr.response?.status;
                    if ((directStatus === 403 || directStatus === 401) && MCC_ID) {
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
                    const platform = 'google';
                    const ai_instructions = `\n# Campaña: ${camp.name}\nEres un asistente de ventas para la campaña "${camp.name}" en Google Ads.\nTu objetivo principal es asistir al usuario que hizo clic en nuestro anuncio de Google.\nDebes ofrecer información clara sobre nuestros productos médicos y pruebas rápidas.\n`;
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

                // Daily spend tracking
                try {
                    const today = new Date();
                    const from90 = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    const dateFrom = from90.toISOString().split('T')[0];
                    const dateTo = today.toISOString().split('T')[0];
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
                        const spendDate = spendRow.segments?.date;
                        const spendAmount = ((Number(spendRow.metrics?.costMicros) || 0) / 1_000_000).toFixed(6);
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
        });
    }
});

export default router;
