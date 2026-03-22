import { Router, Request, Response } from 'express';
import { db } from '../db';

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

export default router;
