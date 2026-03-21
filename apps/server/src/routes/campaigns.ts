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

// POST /api/campaigns/sync-facebook
// Imports campaigns from Meta Ads API using the configured access token
router.post('/sync-facebook', async (_req: Request, res: Response) => {
    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!accessToken) {
        res.status(400).json({ error: 'META_ACCESS_TOKEN not configured' });
        return;
    }

    try {
        // Step 1: Get ad accounts
        const meResp = await axios.get('https://graph.facebook.com/v19.0/me/adaccounts', {
            params: {
                access_token: accessToken,
                fields: 'id,name,account_id',
                limit: 50,
            },
        });

        const adAccounts = meResp.data?.data || [];
        if (adAccounts.length === 0) {
            res.json({ imported: 0, message: 'No ad accounts found' });
            return;
        }

        let totalImported = 0;

        for (const account of adAccounts) {
            // Step 2: Get campaigns for each ad account
            const campaignsResp = await axios.get(
                `https://graph.facebook.com/v19.0/${account.id}/campaigns`,
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
                        `https://graph.facebook.com/v19.0/${fbCamp.id}/adsets`,
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
                        `https://graph.facebook.com/v19.0/${fbCamp.id}/ads`,
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

export default router;
