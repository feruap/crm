/**
 * Campaign-Product Mappings Routes
 *
 * CRUD for mapping campaigns to products with auto-response content.
 *
 * GET    /api/campaign-mappings              — List all mappings
 * GET    /api/campaign-mappings/:id          — Get single mapping
 * POST   /api/campaign-mappings              — Create mapping
 * PUT    /api/campaign-mappings/:id          — Update mapping
 * DELETE /api/campaign-mappings/:id          — Delete mapping
 * PATCH  /api/campaign-mappings/:id/toggle   — Toggle auto_send
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// ─────────────────────────────────────────────
// GET /api/campaign-mappings
// ─────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
    try {
        const result = await db.query(`
            SELECT cpm.*,
                   c.name AS campaign_name,
                   c.platform AS campaign_platform,
                   c.platform_campaign_id,
                   c.platform_ad_id
            FROM campaign_product_mappings cpm
            JOIN campaigns c ON c.id = cpm.campaign_id
            ORDER BY cpm.updated_at DESC
        `);
        res.json(result.rows);
    } catch (err: unknown) {
        console.error('[campaign-mappings] Error loading mappings:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.includes('does not exist') || message.includes('relation')) {
            res.json([]);
        } else {
            res.status(500).json({ error: 'Error cargando mappings', detail: message });
        }
    }
});

// ─────────────────────────────────────────────
// GET /api/campaign-mappings/:id
// ─────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
    const result = await db.query(
        `SELECT cpm.*,
                c.name AS campaign_name,
                c.platform AS campaign_platform
         FROM campaign_product_mappings cpm
         JOIN campaigns c ON c.id = cpm.campaign_id
         WHERE cpm.id = $1`,
        [req.params.id]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Mapping not found' });
        return;
    }
    res.json(result.rows[0]);
});

// ─────────────────────────────────────────────
// POST /api/campaign-mappings
// ─────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
    const {
        campaign_id,
        wc_product_id,
        product_name,
        welcome_message,
        media_urls = [],
        auto_send = true,
        priority = 0,
    } = req.body;

    if (!campaign_id || !product_name || !welcome_message) {
        res.status(400).json({
            error: 'campaign_id, product_name, and welcome_message are required',
        });
        return;
    }

    // Verify campaign exists
    const campaign = await db.query(
        `SELECT id FROM campaigns WHERE id = $1`,
        [campaign_id]
    );
    if (campaign.rows.length === 0) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
    }

    const result = await db.query(
        `INSERT INTO campaign_product_mappings
            (campaign_id, wc_product_id, product_name, welcome_message, media_urls, auto_send, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [campaign_id, wc_product_id, product_name, welcome_message, JSON.stringify(media_urls), auto_send, priority]
    );

    res.status(201).json(result.rows[0]);
});

// ─────────────────────────────────────────────
// PUT /api/campaign-mappings/:id
// ─────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
    const {
        campaign_id,
        wc_product_id,
        product_name,
        welcome_message,
        media_urls,
        auto_send,
        priority,
        is_active,
    } = req.body;

    const result = await db.query(
        `UPDATE campaign_product_mappings
         SET campaign_id = COALESCE($1, campaign_id),
             wc_product_id = COALESCE($2, wc_product_id),
             product_name = COALESCE($3, product_name),
             welcome_message = COALESCE($4, welcome_message),
             media_urls = COALESCE($5, media_urls),
             auto_send = COALESCE($6, auto_send),
             priority = COALESCE($7, priority),
             is_active = COALESCE($8, is_active),
             updated_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [
            campaign_id, wc_product_id, product_name, welcome_message,
            media_urls ? JSON.stringify(media_urls) : null,
            auto_send, priority, is_active, req.params.id,
        ]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Mapping not found' });
        return;
    }
    res.json(result.rows[0]);
});

// ─────────────────────────────────────────────
// DELETE /api/campaign-mappings/:id
// ─────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
    const result = await db.query(
        `DELETE FROM campaign_product_mappings WHERE id = $1 RETURNING id`,
        [req.params.id]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Mapping not found' });
        return;
    }
    res.json({ ok: true, deleted: req.params.id });
});

// ─────────────────────────────────────────────
// PATCH /api/campaign-mappings/:id/toggle
// Quick toggle auto_send on/off
// ─────────────────────────────────────────────
router.patch('/:id/toggle', async (req: Request, res: Response) => {
    const result = await db.query(
        `UPDATE campaign_product_mappings
         SET auto_send = NOT auto_send, updated_at = NOW()
         WHERE id = $1
         RETURNING id, auto_send`,
        [req.params.id]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Mapping not found' });
        return;
    }
    res.json(result.rows[0]);
});

export default router;
