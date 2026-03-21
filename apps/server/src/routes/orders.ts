/**
 * Orders Routes
 *
 * GET  /api/orders                    — List orders (with filters)
 * GET  /api/orders/:id                — Get single order with attribution
 * PUT  /api/orders/:id/status         — Change status (syncs to WooCommerce)
 * GET  /api/orders/customer/:customerId — Orders for a specific customer
 * POST /api/orders/create             — Create a new order in WooCommerce
 * POST /api/orders/:id/discount-request — Request a discount for an order
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { pushStatusToWC, WC_ORDER_STATUSES, createWCOrder, createDiscountRequest, getB2BPrice } from '../services/woocommerce';

const router = Router();

// ─────────────────────────────────────────────
// GET /api/orders — List orders with filters
// ─────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
    const { status, customer_id, limit = '50', offset = '0' } = req.query;

    let query = `
        SELECT o.*,
               c.display_name AS customer_name,
               a.campaign_id,
               ca.name AS campaign_name,
               ca.platform AS campaign_platform
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        LEFT JOIN attributions a ON a.order_id = o.id
        LEFT JOIN campaigns ca ON ca.id = a.campaign_id
        WHERE 1=1
    `;
    const params: unknown[] = [];

    if (status) {
        params.push(status);
        query += ` AND o.status = $${params.length}`;
    }
    if (customer_id) {
        params.push(customer_id);
        query += ` AND o.customer_id = $${params.length}`;
    }

    params.push(Number(limit));
    query += ` ORDER BY o.order_date DESC NULLS LAST LIMIT $${params.length}`;

    params.push(Number(offset));
    query += ` OFFSET $${params.length}`;

    const result = await db.query(query, params);
    res.json(result.rows);
});

// ─────────────────────────────────────────────
// GET /api/orders/customer/:customerId
// ─────────────────────────────────────────────
router.get('/customer/:customerId', async (req: Request, res: Response) => {
    const result = await db.query(
        `SELECT o.*, a.campaign_id, ca.name AS campaign_name
         FROM orders o
         LEFT JOIN attributions a ON a.order_id = o.id
         LEFT JOIN campaigns ca ON ca.id = a.campaign_id
         WHERE o.customer_id = $1
         ORDER BY o.order_date DESC
         LIMIT 20`,
        [req.params.customerId]
    );
    res.json(result.rows);
});

// ─────────────────────────────────────────────
// GET /api/orders/:id — Single order with full details
// ─────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
    const result = await db.query(
        `SELECT o.*,
                c.display_name AS customer_name,
                a.campaign_id, a.attributed_at,
                ca.name AS campaign_name, ca.platform AS campaign_platform
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
         LEFT JOIN attributions a ON a.order_id = o.id
         LEFT JOIN campaigns ca ON ca.id = a.campaign_id
         WHERE o.id = $1`,
        [req.params.id]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Order not found' });
        return;
    }

    // Also get sync log for this order
    const syncLog = await db.query(
        `SELECT * FROM order_sync_log WHERE order_id = $1 ORDER BY synced_at DESC LIMIT 20`,
        [req.params.id]
    );

    res.json({
        ...result.rows[0],
        sync_log: syncLog.rows,
    });
});

// ─────────────────────────────────────────────
// PUT /api/orders/:id/status — Change order status
// Syncs the change to WooCommerce bidirectionally
// ─────────────────────────────────────────────
router.put('/:id/status', async (req: Request, res: Response) => {
    const { status } = req.body;

    if (!status || !WC_ORDER_STATUSES.includes(status)) {
        res.status(400).json({
            error: 'Invalid status',
            valid_statuses: WC_ORDER_STATUSES,
        });
        return;
    }

    // Get current order
    const order = await db.query(
        `SELECT id, external_order_id, status FROM orders WHERE id = $1`,
        [req.params.id]
    );

    if (order.rows.length === 0) {
        res.status(404).json({ error: 'Order not found' });
        return;
    }

    const { external_order_id, status: previousStatus } = order.rows[0];

    // Update in CRM first
    await db.query(
        `UPDATE orders SET status = $1 WHERE id = $2`,
        [status, req.params.id]
    );

    // Push to WooCommerce (non-blocking with result)
    const syncResult = await pushStatusToWC(
        Number(req.params.id),
        external_order_id,
        status,
        previousStatus
    );

    res.json({
        ok: true,
        order_id: req.params.id,
        previous_status: previousStatus,
        new_status: status,
        wc_sync: syncResult,
    });
});

// ─────────────────────────────────────────────
// POST /api/orders/create — Create a new order in WooCommerce from CRM
// ─────────────────────────────────────────────
router.post('/create', async (req: Request, res: Response) => {
    const { line_items, billing, coupon_lines, agent_id, meta_data } = req.body;

    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
        res.status(400).json({ error: 'line_items array is required with at least one item' });
        return;
    }

    const result = await createWCOrder({
        line_items,
        billing,
        coupon_lines,
        agent_id,
        meta_data,
    });

    if (result.ok) {
        res.status(201).json({
            ok: true,
            wc_order_id: result.wc_order_id,
            total: result.total,
        });
    } else {
        res.status(500).json({ ok: false, error: result.error });
    }
});

// ─────────────────────────────────────────────
// POST /api/orders/:id/discount-request — Request a discount for an order
// ─────────────────────────────────────────────
router.post('/:id/discount-request', async (req: Request, res: Response) => {
    const { discount_pct, reason, agent_id, customer_email, product_ids } = req.body;

    if (!discount_pct || !reason || !agent_id) {
        res.status(400).json({ error: 'discount_pct, reason, and agent_id are required' });
        return;
    }

    // Get the WC order ID
    const order = await db.query(
        `SELECT external_order_id FROM orders WHERE id = $1`,
        [req.params.id]
    );

    if (order.rows.length === 0) {
        res.status(404).json({ error: 'Order not found' });
        return;
    }

    const result = await createDiscountRequest({
        order_id: Number(order.rows[0].external_order_id),
        customer_email: customer_email || '',
        product_ids: product_ids || [],
        requested_discount_pct: discount_pct,
        reason,
        agent_id,
    });

    if (result.ok) {
        res.json({ ok: true, message: 'Discount request created and sent to WooCommerce' });
    } else {
        res.status(500).json({ ok: false, error: result.error });
    }
});

// ─────────────────────────────────────────────
// GET /api/orders/b2b-price/:productId — Get B2B price for a product
// ─────────────────────────────────────────────
router.get('/b2b-price/:productId', async (req: Request, res: Response) => {
    const { email } = req.query;

    try {
        const pricing = await getB2BPrice(Number(req.params.productId), email as string);
        res.json(pricing);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching B2B price', details: String(err) });
    }
});

export default router;
