/**
 * Analytics Routes
 *
 * Aggregation endpoints for the attribution dashboard.
 *
 * GET    /api/analytics/attribution         — Attribution overview by campaign
 * GET    /api/analytics/attribution/roas    — ROAS by campaign/ad
 * GET    /api/analytics/attribution/funnel  — Conversion funnel
 * GET    /api/analytics/attribution/trend   — Revenue trend over time
 * GET    /api/analytics/conversion-events   — CAPI/Google conversion event log
 * GET    /api/analytics/attribution/config  — Current attribution model config
 * PUT    /api/analytics/attribution/config  — Update attribution model
 * POST   /api/analytics/attribution/recalculate — Recalculate all attributions
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
    getAttributionConfig,
    updateAttributionConfig,
    recalculateAllAttributions,
} from '../services/attribution-model';

const router = Router();

// ─────────────────────────────────────────────
// Attribution by Campaign
// ─────────────────────────────────────────────

router.get('/attribution', async (req: Request, res: Response) => {
    const { days = '30', platform } = req.query;
    const daysNum = Number(days);

    let query = `
        SELECT
            c.id AS campaign_id,
            c.name AS campaign_name,
            c.platform,
            c.platform_campaign_id,
            COUNT(DISTINCT at2.id) AS touchpoints,
            COUNT(DISTINCT CASE WHEN conv.id IS NOT NULL THEN conv.id END) AS conversations,
            COUNT(DISTINCT CASE WHEN a.order_id IS NOT NULL THEN a.order_id END) AS orders,
            COALESCE(SUM(a.attributed_revenue), 0) AS total_revenue,
            COALESCE(AVG(CASE WHEN o.total_amount IS NOT NULL THEN o.total_amount END), 0) AS avg_order_value
        FROM campaigns c
        LEFT JOIN attribution_touchpoints at2 ON at2.campaign_id = c.id
            AND at2.created_at >= NOW() - INTERVAL '1 day' * $1
        LEFT JOIN attributions a ON a.campaign_id = c.id
            AND a.attributed_at >= NOW() - INTERVAL '1 day' * $1
        LEFT JOIN conversations conv ON conv.id = a.conversation_id
        LEFT JOIN orders o ON o.id = a.order_id
    `;

    const params: unknown[] = [daysNum];

    if (platform) {
        params.push(platform);
        query += ` WHERE c.platform = $${params.length}::ad_platform`;
    }

    query += `
        GROUP BY c.id, c.name, c.platform, c.platform_campaign_id
        ORDER BY total_revenue DESC
    `;

    const result = await db.query(query, params);
    res.json(result.rows);
});

// ─────────────────────────────────────────────
// ROAS by Campaign/Ad
// ─────────────────────────────────────────────

router.get('/attribution/roas', async (req: Request, res: Response) => {
    const { days = '30' } = req.query;

    // ROAS needs ad spend data — we calculate revenue per campaign and
    // the ROAS = revenue / spend. Spend comes from campaign metadata if available.
    const result = await db.query(
        `SELECT
            c.id AS campaign_id,
            c.name AS campaign_name,
            c.platform,
            c.platform_ad_id,
            COALESCE((c.metadata->>'spend')::numeric, 0) AS ad_spend,
            COALESCE(SUM(a.attributed_revenue), 0) AS revenue,
            CASE
                WHEN COALESCE((c.metadata->>'spend')::numeric, 0) > 0
                THEN ROUND(SUM(a.attributed_revenue) / (c.metadata->>'spend')::numeric, 2)
                ELSE NULL
            END AS roas,
            COUNT(DISTINCT a.order_id) FILTER (WHERE a.order_id IS NOT NULL) AS conversions,
            COUNT(DISTINCT at2.id) AS clicks,
            CASE
                WHEN COUNT(DISTINCT at2.id) > 0
                THEN ROUND(COALESCE((c.metadata->>'spend')::numeric, 0) / COUNT(DISTINCT at2.id), 2)
                ELSE NULL
            END AS cost_per_click,
            CASE
                WHEN COUNT(DISTINCT a.order_id) FILTER (WHERE a.order_id IS NOT NULL) > 0
                THEN ROUND(COALESCE((c.metadata->>'spend')::numeric, 0) /
                     COUNT(DISTINCT a.order_id) FILTER (WHERE a.order_id IS NOT NULL), 2)
                ELSE NULL
            END AS cost_per_conversion
        FROM campaigns c
        LEFT JOIN attributions a ON a.campaign_id = c.id
            AND a.attributed_at >= NOW() - INTERVAL '1 day' * $1
        LEFT JOIN attribution_touchpoints at2 ON at2.campaign_id = c.id
            AND at2.created_at >= NOW() - INTERVAL '1 day' * $1
        GROUP BY c.id, c.name, c.platform, c.platform_ad_id, c.metadata
        ORDER BY revenue DESC`,
        [Number(days)]
    );

    res.json(result.rows);
});

// ─────────────────────────────────────────────
// Conversion Funnel
// ─────────────────────────────────────────────

router.get('/attribution/funnel', async (req: Request, res: Response) => {
    const { days = '30' } = req.query;
    const daysNum = Number(days);

    // Funnel stages: Touchpoints → Conversations → Attributions → Orders
    const result = await db.query(
        `SELECT
            (SELECT COUNT(*) FROM attribution_touchpoints
             WHERE created_at >= NOW() - INTERVAL '1 day' * $1) AS total_touchpoints,
            (SELECT COUNT(DISTINCT customer_id) FROM attribution_touchpoints
             WHERE created_at >= NOW() - INTERVAL '1 day' * $1) AS unique_leads,
            (SELECT COUNT(*) FROM conversations
             WHERE created_at >= NOW() - INTERVAL '1 day' * $1) AS total_conversations,
            (SELECT COUNT(*) FROM attributions
             WHERE attributed_at >= NOW() - INTERVAL '1 day' * $1) AS attributed_conversations,
            (SELECT COUNT(DISTINCT order_id) FROM attributions
             WHERE order_id IS NOT NULL AND attributed_at >= NOW() - INTERVAL '1 day' * $1) AS attributed_orders,
            (SELECT COALESCE(SUM(attributed_revenue), 0) FROM attributions
             WHERE attributed_at >= NOW() - INTERVAL '1 day' * $1) AS total_attributed_revenue`,
        [daysNum]
    );

    res.json(result.rows[0]);
});

// ─────────────────────────────────────────────
// Revenue Trend
// ─────────────────────────────────────────────

router.get('/attribution/trend', async (req: Request, res: Response) => {
    const { days = '30', group_by = 'day' } = req.query;

    const dateFormat = group_by === 'week'
        ? `DATE_TRUNC('week', o.order_date)`
        : group_by === 'month'
            ? `DATE_TRUNC('month', o.order_date)`
            : `DATE_TRUNC('day', o.order_date)`;

    const result = await db.query(
        `SELECT
            ${dateFormat} AS period,
            COUNT(DISTINCT o.id) AS orders,
            COALESCE(SUM(o.total_amount), 0) AS revenue,
            COUNT(DISTINCT a.campaign_id) AS campaigns_involved,
            COALESCE(SUM(a.attributed_revenue), 0) AS attributed_revenue
        FROM orders o
        LEFT JOIN attributions a ON a.order_id = o.id
        WHERE o.order_date >= NOW() - INTERVAL '1 day' * $1
        GROUP BY ${dateFormat}
        ORDER BY period ASC`,
        [Number(days)]
    );

    res.json(result.rows);
});

// ─────────────────────────────────────────────
// Conversion Events Log (CAPI + Google)
// ─────────────────────────────────────────────

router.get('/conversion-events', async (req: Request, res: Response) => {
    const { limit = '50', platform, status } = req.query;

    let query = `
        SELECT ce.*,
               o.external_order_id,
               c.display_name AS customer_name
        FROM conversion_events ce
        LEFT JOIN orders o ON o.id = ce.order_id
        LEFT JOIN customers c ON c.id = ce.customer_id
        WHERE 1=1
    `;
    const params: unknown[] = [];

    if (platform) {
        params.push(platform);
        query += ` AND ce.platform = $${params.length}`;
    }

    if (status) {
        params.push(status);
        query += ` AND ce.status = $${params.length}`;
    }

    params.push(Number(limit));
    query += ` ORDER BY ce.created_at DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);
    res.json(result.rows);
});

// ─────────────────────────────────────────────
// Attribution Model Config
// ─────────────────────────────────────────────

router.get('/attribution/config', async (_req: Request, res: Response) => {
    const config = await getAttributionConfig();
    res.json(config);
});

router.put('/attribution/config', async (req: Request, res: Response) => {
    const updated = await updateAttributionConfig(req.body);
    res.json(updated);
});

router.post('/attribution/recalculate', async (_req: Request, res: Response) => {
    const result = await recalculateAllAttributions();
    res.json(result);
});

export default router;
