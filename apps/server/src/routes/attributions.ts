import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// POST /api/attributions  — link a customer to a campaign (called on first contact)
router.post('/', async (req: Request, res: Response) => {
    const { customer_id, campaign_id, conversation_id } = req.body;

    const result = await db.query(
        `INSERT INTO attributions (customer_id, campaign_id, conversation_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [customer_id, campaign_id, conversation_id]
    );
    res.status(201).json(result.rows[0]);
});

// PATCH /api/attributions/:id/order  — attach an order to an existing attribution
router.patch('/:id/order', async (req: Request, res: Response) => {
    const { order_id, woocommerce_order_id } = req.body;

    await db.query(
        `UPDATE attributions
         SET order_id = $1, woocommerce_order_id = $2, woocommerce_synced = FALSE
         WHERE id = $3`,
        [order_id, woocommerce_order_id, req.params.id]
    );
    res.json({ ok: true });
});

// POST /api/attributions/sync-woocommerce
// Worker endpoint: finds all unsynced attributions and pushes them to WooCommerce
router.post('/sync-woocommerce', async (_req: Request, res: Response) => {
    const pending = await db.query(
        `SELECT a.*, o.external_order_id, c.platform, ca.platform_campaign_id, ca.name AS campaign_name
         FROM attributions a
         JOIN orders o ON o.id = a.order_id
         JOIN campaigns ca ON ca.id = a.campaign_id
         LEFT JOIN channels c ON c.id = (
             SELECT channel_id FROM conversations WHERE id = a.conversation_id LIMIT 1
         )
         WHERE a.woocommerce_synced = FALSE
           AND a.order_id IS NOT NULL`
    );

    const results = [];

    for (const row of pending.rows) {
        try {
            // Push attribution metadata to WooCommerce order via REST API
            // WC_URL and WC credentials come from env
            const wcUrl = process.env.WC_URL;
            const wcKey = process.env.WC_KEY;
            const wcSecret = process.env.WC_SECRET;

            if (!wcUrl || !wcKey || !wcSecret) {
                results.push({ id: row.id, ok: false, error: 'WooCommerce credentials not configured' });
                continue;
            }

            const auth = Buffer.from(`${wcKey}:${wcSecret}`).toString('base64');
            const response = await fetch(
                `${wcUrl}/wp-json/wc/v3/orders/${row.external_order_id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Basic ${auth}`,
                    },
                    body: JSON.stringify({
                        meta_data: [
                            { key: '_attribution_campaign_id', value: row.platform_campaign_id },
                            { key: '_attribution_campaign_name', value: row.campaign_name },
                            { key: '_attribution_platform', value: row.platform },
                            { key: '_attribution_source', value: 'myalice' },
                        ],
                    }),
                }
            );

            if (response.ok) {
                await db.query(
                    `UPDATE attributions
                     SET woocommerce_synced = TRUE, woocommerce_synced_at = NOW()
                     WHERE id = $1`,
                    [row.id]
                );
                results.push({ id: row.id, ok: true });
            } else {
                results.push({ id: row.id, ok: false, error: `WC returned ${response.status}` });
            }
        } catch (err) {
            results.push({ id: row.id, ok: false, error: String(err) });
        }
    }

    res.json({ processed: results.length, results });
});

export default router;
