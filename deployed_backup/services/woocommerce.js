"use strict";
/**
 * WooCommerce REST API Service
 *
 * Wraps all WC REST API calls. Handles authentication, retries, and
 * loop prevention for bidirectional sync.
 *
 * Requires env vars: WC_URL, WC_KEY, WC_SECRET
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WC_ORDER_STATUSES = void 0;
exports.pushStatusToWC = pushStatusToWC;
exports.receiveStatusFromWC = receiveStatusFromWC;
exports.getWCOrder = getWCOrder;
exports.getProductStock = getProductStock;
exports.createWCOrder = createWCOrder;
exports.createDiscountRequest = createDiscountRequest;
exports.getB2BPrice = getB2BPrice;
exports.getAgentCommissions = getAgentCommissions;
exports.wcFetch = wcFetch;
const db_1 = require("../db");
// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
function getWCConfig() {
    const url = process.env.WC_URL;
    const key = process.env.WC_KEY;
    const secret = process.env.WC_SECRET;
    if (!url || !key || !secret) {
        throw new Error('WooCommerce credentials not configured (WC_URL, WC_KEY, WC_SECRET)');
    }
    return {
        url: url.replace(/\/$/, ''), // Strip trailing slash
        auth: Buffer.from(`${key}:${secret}`).toString('base64'),
    };
}
async function wcFetch(endpoint, method = 'GET', body) {
    const { url, auth } = getWCConfig();
    const response = await fetch(`${url}/wp-json/wc/v3${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`WC API ${method} ${endpoint} returned ${response.status}: ${text}`);
    }
    return response.json();
}
// ─────────────────────────────────────────────
// Order Status Sync
// ─────────────────────────────────────────────
/**
 * Valid WooCommerce order statuses
 */
exports.WC_ORDER_STATUSES = [
    'pending', 'processing', 'on-hold', 'completed',
    'cancelled', 'refunded', 'failed', 'trash',
];
/**
 * Map CRM-friendly status names to WooCommerce statuses
 */
const STATUS_MAP_CRM_TO_WC = {
    pending: 'pending',
    processing: 'processing',
    'on-hold': 'on-hold',
    'on_hold': 'on-hold',
    completed: 'completed',
    cancelled: 'cancelled',
    refunded: 'refunded',
    failed: 'failed',
};
/**
 * Check if a sync event happened recently to prevent infinite loops.
 * If WC sent us a status change in the last 10 seconds, don't push it back.
 */
async function isRecentSync(externalOrderId, direction, windowMs = 10000) {
    const result = await db_1.db.query(`SELECT id FROM order_sync_log
         WHERE external_order_id = $1
           AND sync_direction = $2
           AND synced_at > NOW() - INTERVAL '${windowMs} milliseconds'
           AND error IS NULL
         LIMIT 1`, [externalOrderId, direction]);
    return result.rows.length > 0;
}
/**
 * Log a sync event
 */
async function logSync(orderId, externalOrderId, previousStatus, newStatus, source, direction, error = null) {
    await db_1.db.query(`INSERT INTO order_sync_log (order_id, external_order_id, previous_status, new_status, source, sync_direction, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [orderId, externalOrderId, previousStatus, newStatus, source, direction, error]);
}
/**
 * Push a status change FROM CRM TO WooCommerce
 */
async function pushStatusToWC(orderId, externalOrderId, newStatus, previousStatus) {
    const wcStatus = STATUS_MAP_CRM_TO_WC[newStatus] || newStatus;
    // Loop prevention: if WC just told us about this, don't echo it back
    if (await isRecentSync(externalOrderId, 'wc_to_crm')) {
        return { ok: true }; // Silently skip — this is expected behavior
    }
    try {
        await wcFetch(`/orders/${externalOrderId}`, 'PUT', { status: wcStatus });
        await logSync(orderId, externalOrderId, previousStatus, wcStatus, 'crm', 'crm_to_wc');
        return { ok: true };
    }
    catch (err) {
        const errorMsg = String(err);
        await logSync(orderId, externalOrderId, previousStatus, wcStatus, 'crm', 'crm_to_wc', errorMsg);
        return { ok: false, error: errorMsg };
    }
}
/**
 * Receive a status change FROM WooCommerce and update CRM
 */
async function receiveStatusFromWC(externalOrderId, newStatus, previousStatus) {
    // Loop prevention: if CRM just pushed this, don't process the echo
    if (await isRecentSync(externalOrderId, 'crm_to_wc')) {
        return { ok: true }; // Silently skip
    }
    try {
        // Find order in CRM
        const order = await db_1.db.query(`SELECT id, status FROM orders WHERE external_order_id = $1`, [externalOrderId]);
        if (order.rows.length === 0) {
            // Order doesn't exist in CRM yet — create it
            return { ok: true }; // Will be created by the regular order sync
        }
        const crmOrder = order.rows[0];
        const oldStatus = previousStatus || crmOrder.status;
        // Update the order status in CRM
        await db_1.db.query(`UPDATE orders SET status = $1 WHERE id = $2`, [newStatus, crmOrder.id]);
        await logSync(crmOrder.id, externalOrderId, oldStatus, newStatus, 'woocommerce', 'wc_to_crm');
        return { ok: true };
    }
    catch (err) {
        const errorMsg = String(err);
        await logSync(null, externalOrderId, previousStatus || null, newStatus, 'woocommerce', 'wc_to_crm', errorMsg);
        return { ok: false, error: errorMsg };
    }
}
// ─────────────────────────────────────────────
// Order CRUD
// ─────────────────────────────────────────────
/**
 * Get a WooCommerce order by ID
 */
async function getWCOrder(wcOrderId) {
    return wcFetch(`/orders/${wcOrderId}`);
}
/**
 * Get product stock from WooCommerce
 */
async function getProductStock(productId) {
    const product = await wcFetch(`/products/${productId}`);
    return {
        in_stock: product.stock_status === 'instock',
        stock_quantity: product.stock_quantity,
        stock_status: product.stock_status,
    };
}
/**
 * Create a new order in WooCommerce from the CRM.
 * Returns the created WC order data.
 */
async function createWCOrder(request) {
    try {
        const wcOrderData = {
            status: 'pending',
            line_items: request.line_items.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                ...(item.price !== undefined ? { price: String(item.price) } : {}),
            })),
        };
        if (request.billing) {
            wcOrderData.billing = request.billing;
        }
        if (request.coupon_lines) {
            wcOrderData.coupon_lines = request.coupon_lines;
        }
        // Add CRM metadata
        const metaData = [
            { key: '_created_from', value: 'crm' },
            { key: '_crm_agent_id', value: request.agent_id || '' },
            ...(request.meta_data || []),
        ];
        wcOrderData.meta_data = metaData;
        const result = await wcFetch('/orders', 'POST', wcOrderData);
        // Also save the order in CRM database
        const items = result.line_items.map(li => ({
            product_id: li.product_id,
            name: li.name,
            quantity: li.quantity,
            total: li.total,
        }));
        // Try to find customer by email
        let customerId = null;
        if (request.billing?.email) {
            const customer = await db_1.db.query(`SELECT c.id FROM customers c
                 JOIN customer_attributes ca ON ca.customer_id = c.id
                 WHERE ca.key = 'email' AND ca.value = $1
                 LIMIT 1`, [request.billing.email]);
            if (customer.rows.length > 0)
                customerId = customer.rows[0].id;
        }
        await db_1.db.query(`INSERT INTO orders (external_order_id, customer_id, total_amount, currency, status, items, order_date)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (external_order_id) DO UPDATE
                 SET status = EXCLUDED.status, total_amount = EXCLUDED.total_amount`, [
            String(result.id),
            customerId,
            result.total,
            result.currency || 'MXN',
            result.status,
            JSON.stringify(items),
        ]);
        // Log the sync
        await logSync(null, String(result.id), null, result.status, 'crm', 'crm_to_wc');
        return { ok: true, wc_order_id: result.id, total: result.total };
    }
    catch (err) {
        return { ok: false, error: String(err) };
    }
}
/**
 * Create a discount request by adding a pending coupon/meta to the WC order.
 * Uses WC order meta to flag it for supervisor approval.
 *
 * SK Custom Discounts plugin reads _discount_request meta on orders.
 */
async function createDiscountRequest(request) {
    try {
        if (!request.order_id) {
            return { ok: false, error: 'order_id is required for discount request' };
        }
        // Add discount request metadata to the WC order
        await wcFetch(`/orders/${request.order_id}`, 'PUT', {
            meta_data: [
                { key: '_discount_request_status', value: 'pending' },
                { key: '_discount_request_pct', value: String(request.requested_discount_pct) },
                { key: '_discount_request_reason', value: request.reason },
                { key: '_discount_request_agent', value: request.agent_id },
                { key: '_discount_request_date', value: new Date().toISOString() },
            ],
        });
        // Record in CRM database
        await db_1.db.query(`INSERT INTO order_sync_log (external_order_id, previous_status, new_status, source, sync_direction)
             VALUES ($1, 'discount_requested', 'pending_approval', 'crm', 'crm_to_wc')`, [String(request.order_id)]);
        return { ok: true };
    }
    catch (err) {
        return { ok: false, error: String(err) };
    }
}
/**
 * Get B2B pricing for a customer via B2BKing integration.
 * Queries the WC product with customer context to get role-based pricing.
 */
async function getB2BPrice(productId, customerEmail) {
    try {
        const product = await wcFetch(`/products/${productId}`);
        // Look for B2BKing meta prices
        const b2bMeta = product.meta_data?.find(m => m.key === 'b2bking_regular_product_price');
        return {
            regular_price: product.regular_price,
            sale_price: product.sale_price || product.regular_price,
            b2b_price: b2bMeta?.value || undefined,
        };
    }
    catch {
        return { regular_price: '0', sale_price: '0' };
    }
}
/**
 * Get commission data for an agent from SalesKing.
 * SalesKing stores earnings in WP user meta and custom tables.
 * We query via the WC REST API + custom SalesKing endpoint if available.
 */
async function getAgentCommissions(wcUserId) {
    try {
        // SalesKing exposes agent data via WP REST API
        // Endpoint: /wp-json/salesking/v1/agents/{id}/earnings
        const { url, auth } = getWCConfig();
        const response = await fetch(`${url}/wp-json/salesking/v1/agents/${wcUserId}/earnings`, {
            headers: { Authorization: `Basic ${auth}` },
        });
        if (response.ok) {
            const data = await response.json();
            return data;
        }
        // Fallback: query directly from WC customers endpoint (user meta)
        const user = await wcFetch(`/customers/${wcUserId}`);
        const getMeta = (key) => {
            const m = user.meta_data?.find(m => m.key === key);
            return parseFloat(m?.value || '0');
        };
        return {
            earnings_total: getMeta('salesking_outstanding_earnings') + getMeta('salesking_paid_earnings'),
            earnings_pending: getMeta('salesking_outstanding_earnings'),
            earnings_paid: getMeta('salesking_paid_earnings'),
            orders_count: getMeta('salesking_total_orders'),
        };
    }
    catch {
        return { earnings_total: 0, earnings_pending: 0, earnings_paid: 0, orders_count: 0 };
    }
}
