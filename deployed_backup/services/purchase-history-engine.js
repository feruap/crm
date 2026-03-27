"use strict";
/**
 * Purchase History Engine
 *
 * Generates personalized conversation flows based on customer purchase history.
 *
 * Triggers:
 * - Pending order: "Veo que tu pedido #X está en proceso"
 * - Inactive customer (30+ days): Suggest reorder
 * - Cross-sell opportunity: Bought A but never B (complementary)
 * - Lifecycle stage detection: new, active, at-risk, dormant
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeCustomerHistory = analyzeCustomerHistory;
exports.recalculateCustomerSegments = recalculateCustomerSegments;
const db_1 = require("../db");
// ─────────────────────────────────────────────
// History Analysis
// ─────────────────────────────────────────────
/**
 * Analyze a customer's purchase history and generate contextual information.
 */
async function analyzeCustomerHistory(customerId) {
    // Get all orders for this customer
    const orders = await db_1.db.query(`SELECT id, external_order_id, total_amount, status, items, order_date
         FROM orders WHERE customer_id = $1
         ORDER BY order_date DESC`, [customerId]);
    const allOrders = orders.rows;
    const activeOrders = allOrders.filter((o) => !['cancelled', 'refunded', 'failed'].includes(o.status));
    // Pending orders (processing, on-hold)
    const pendingOrders = allOrders
        .filter((o) => ['processing', 'on-hold', 'pending'].includes(o.status))
        .map((o) => ({
        id: o.external_order_id,
        status: o.status,
        total: o.total_amount,
        items: (o.items || []).map((i) => i.name),
    }));
    // Days since last order
    let daysSinceLastOrder = null;
    if (activeOrders.length > 0 && activeOrders[0].order_date) {
        const lastDate = new Date(activeOrders[0].order_date);
        daysSinceLastOrder = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    // Lifetime spend
    const lifetimeSpend = activeOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);
    // Lifecycle stage
    let lifecycleStage = 'prospect';
    if (activeOrders.length === 0) {
        lifecycleStage = 'prospect';
    }
    else if (activeOrders.length === 1 && daysSinceLastOrder !== null && daysSinceLastOrder <= 30) {
        lifecycleStage = 'new';
    }
    else if (daysSinceLastOrder !== null && daysSinceLastOrder <= 60) {
        lifecycleStage = 'active';
    }
    else if (daysSinceLastOrder !== null && daysSinceLastOrder <= 120) {
        lifecycleStage = 'at_risk';
    }
    else if (daysSinceLastOrder !== null && daysSinceLastOrder <= 365) {
        lifecycleStage = 'dormant';
    }
    else if (daysSinceLastOrder !== null) {
        lifecycleStage = 'churned';
    }
    // Reorder candidate (30+ days since last order, was a repeat customer)
    const isReorderCandidate = activeOrders.length >= 2 && daysSinceLastOrder !== null && daysSinceLastOrder >= 30;
    // Cross-sell: find complementary products not yet purchased
    const crossSellOpportunities = await findCrossSellOpportunities(customerId, allOrders);
    // Generate a suggested greeting based on context
    const suggestedGreeting = generateGreeting(pendingOrders, daysSinceLastOrder, lifecycleStage, isReorderCandidate);
    return {
        hasPendingOrders: pendingOrders.length > 0,
        pendingOrders,
        daysSinceLastOrder,
        totalOrders: activeOrders.length,
        lifetimeSpend,
        isReorderCandidate,
        crossSellOpportunities,
        lifecycleStage,
        suggestedGreeting,
    };
}
// ─────────────────────────────────────────────
// Cross-sell Detection
// ─────────────────────────────────────────────
async function findCrossSellOpportunities(customerId, orders) {
    // Extract product IDs the customer has bought
    const boughtIds = new Set();
    for (const order of orders) {
        for (const item of (order.items || [])) {
            if (item.product_id)
                boughtIds.add(item.product_id);
        }
    }
    if (boughtIds.size === 0)
        return [];
    // Find medical products matching purchased WC products
    const purchased = await db_1.db.query(`SELECT id, name, complementary_product_ids
         FROM medical_products
         WHERE wc_product_id = ANY($1) AND is_active = TRUE`, [Array.from(boughtIds)]);
    const opportunities = [];
    const suggestedIds = new Set();
    for (const p of purchased.rows) {
        for (const compId of (p.complementary_product_ids || [])) {
            if (suggestedIds.has(compId))
                continue;
            // Check if customer already bought this complementary product
            const compProduct = await db_1.db.query(`SELECT id, name, wc_product_id FROM medical_products WHERE id = $1`, [compId]);
            if (compProduct.rows.length === 0)
                continue;
            const comp = compProduct.rows[0];
            if (comp.wc_product_id && boughtIds.has(comp.wc_product_id))
                continue;
            suggestedIds.add(compId);
            opportunities.push({
                product_name: comp.name,
                reason: `Complementaria a ${p.name} que ya ha adquirido`,
            });
        }
    }
    return opportunities.slice(0, 3); // Max 3 suggestions
}
// ─────────────────────────────────────────────
// Greeting Generation
// ─────────────────────────────────────────────
function generateGreeting(pendingOrders, daysSinceLastOrder, lifecycleStage, isReorderCandidate) {
    // Pending order gets highest priority
    if (pendingOrders.length > 0) {
        const order = pendingOrders[0];
        const statusMap = {
            processing: 'en proceso',
            'on-hold': 'en espera',
            pending: 'pendiente de pago',
        };
        return `Veo que tiene un pedido #${order.id} ${statusMap[order.status] || order.status}. ¿Necesita información sobre este pedido o hay algo más en lo que pueda ayudarle?`;
    }
    // Reorder candidate
    if (isReorderCandidate && daysSinceLastOrder) {
        return `¡Bienvenido de vuelta! Han pasado ${daysSinceLastOrder} días desde su último pedido. ¿Le gustaría reordenar o necesita asesoría sobre algún producto?`;
    }
    // At-risk or dormant customer
    if (lifecycleStage === 'at_risk') {
        return `¡Qué gusto saludarlo de nuevo! ¿En qué podemos ayudarle hoy?`;
    }
    if (lifecycleStage === 'dormant') {
        return `¡Bienvenido de vuelta! Tenemos novedades en nuestro catálogo. ¿Hay algún producto que le interese?`;
    }
    return null; // Use default greeting
}
// ─────────────────────────────────────────────
// Segment Calculation (for cron job)
// ─────────────────────────────────────────────
/**
 * Recalculate segments for all customers.
 * Should run as a daily cron job.
 */
async function recalculateCustomerSegments() {
    const customers = await db_1.db.query(`SELECT DISTINCT customer_id FROM orders WHERE customer_id IS NOT NULL`);
    let updated = 0;
    for (const { customer_id } of customers.rows) {
        const history = await analyzeCustomerHistory(customer_id);
        // Upsert lifecycle stage
        await db_1.db.query(`INSERT INTO customer_segments (customer_id, segment_type, segment_value, metadata)
             VALUES ($1, 'lifecycle_stage', $2, $3)
             ON CONFLICT (customer_id, segment_type) DO UPDATE SET
                 segment_value = EXCLUDED.segment_value,
                 metadata = EXCLUDED.metadata,
                 last_calculated = NOW()`, [customer_id, history.lifecycleStage, JSON.stringify({
                days_since_last: history.daysSinceLastOrder,
                total_orders: history.totalOrders,
                lifetime_spend: history.lifetimeSpend,
            })]);
        // Value tier
        let valueTier = 'low';
        if (history.lifetimeSpend >= 100000)
            valueTier = 'vip';
        else if (history.lifetimeSpend >= 50000)
            valueTier = 'high';
        else if (history.lifetimeSpend >= 10000)
            valueTier = 'medium';
        await db_1.db.query(`INSERT INTO customer_segments (customer_id, segment_type, segment_value)
             VALUES ($1, 'value_tier', $2)
             ON CONFLICT (customer_id, segment_type) DO UPDATE SET
                 segment_value = EXCLUDED.segment_value, last_calculated = NOW()`, [customer_id, valueTier]);
        // Reorder due
        let reorderStatus = 'not_due';
        if (history.isReorderCandidate) {
            reorderStatus = history.daysSinceLastOrder && history.daysSinceLastOrder > 45 ? 'overdue' : 'due_soon';
        }
        await db_1.db.query(`INSERT INTO customer_segments (customer_id, segment_type, segment_value)
             VALUES ($1, 'reorder_due', $2)
             ON CONFLICT (customer_id, segment_type) DO UPDATE SET
                 segment_value = EXCLUDED.segment_value, last_calculated = NOW()`, [customer_id, reorderStatus]);
        updated++;
    }
    return { updated };
}
