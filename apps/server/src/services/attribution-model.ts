/**
 * Multi-Touch Attribution Model Service
 *
 * Supports 5 attribution models:
 * - first_touch:    100% credit to first touchpoint
 * - last_touch:     100% credit to last touchpoint
 * - linear:         Equal credit across all touchpoints
 * - time_decay:     Exponential decay, more recent = more credit
 * - position_based: 40% first, 40% last, 20% split among middle
 *
 * Recalculates revenue attribution when:
 * - An order is completed and has touchpoints
 * - The attribution model is changed globally
 * - Manual recalculation is triggered
 */

import { db } from '../db';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type AttributionModelType = 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based';

interface AttributionConfig {
    model_type: AttributionModelType;
    time_decay_halflife_days: number;
    position_first_weight: number;
    position_last_weight: number;
    lookback_window_days: number;
}

interface TouchpointForAttribution {
    id: number;
    customer_id: string;
    platform: string;
    campaign_id: string | null;
    ad_id: string | null;
    created_at: string;
}

interface AttributedTouchpoint {
    touchpoint_id: number;
    weight: number;
    revenue: number;
}

// ─────────────────────────────────────────────
// Load Config
// ─────────────────────────────────────────────

async function getConfig(): Promise<AttributionConfig> {
    const result = await db.query(
        `SELECT * FROM attribution_config WHERE is_active = TRUE LIMIT 1`
    );

    if (result.rows.length === 0) {
        return {
            model_type: 'last_touch',
            time_decay_halflife_days: 7,
            position_first_weight: 0.40,
            position_last_weight: 0.40,
            lookback_window_days: 30,
        };
    }

    return result.rows[0] as AttributionConfig;
}

// ─────────────────────────────────────────────
// Model Implementations
// ─────────────────────────────────────────────

function calculateFirstTouch(touchpoints: TouchpointForAttribution[]): Map<number, number> {
    const weights = new Map<number, number>();
    if (touchpoints.length === 0) return weights;
    touchpoints.forEach(tp => weights.set(tp.id, 0));
    weights.set(touchpoints[0].id, 1.0);
    return weights;
}

function calculateLastTouch(touchpoints: TouchpointForAttribution[]): Map<number, number> {
    const weights = new Map<number, number>();
    if (touchpoints.length === 0) return weights;
    touchpoints.forEach(tp => weights.set(tp.id, 0));
    weights.set(touchpoints[touchpoints.length - 1].id, 1.0);
    return weights;
}

function calculateLinear(touchpoints: TouchpointForAttribution[]): Map<number, number> {
    const weights = new Map<number, number>();
    if (touchpoints.length === 0) return weights;
    const weight = 1.0 / touchpoints.length;
    touchpoints.forEach(tp => weights.set(tp.id, weight));
    return weights;
}

function calculateTimeDecay(
    touchpoints: TouchpointForAttribution[],
    halflifeDays: number,
    conversionTime: Date
): Map<number, number> {
    const weights = new Map<number, number>();
    if (touchpoints.length === 0) return weights;

    const halflifeMs = halflifeDays * 24 * 60 * 60 * 1000;
    const decayRate = Math.log(2) / halflifeMs;

    // Calculate raw weights based on time distance from conversion
    let totalWeight = 0;
    const rawWeights: number[] = [];

    for (const tp of touchpoints) {
        const tpTime = new Date(tp.created_at).getTime();
        const timeDiff = conversionTime.getTime() - tpTime;
        const w = Math.exp(-decayRate * timeDiff);
        rawWeights.push(w);
        totalWeight += w;
    }

    // Normalize to sum = 1
    touchpoints.forEach((tp, i) => {
        weights.set(tp.id, totalWeight > 0 ? rawWeights[i] / totalWeight : 0);
    });

    return weights;
}

function calculatePositionBased(
    touchpoints: TouchpointForAttribution[],
    firstWeight: number,
    lastWeight: number
): Map<number, number> {
    const weights = new Map<number, number>();
    if (touchpoints.length === 0) return weights;

    if (touchpoints.length === 1) {
        weights.set(touchpoints[0].id, 1.0);
        return weights;
    }

    if (touchpoints.length === 2) {
        weights.set(touchpoints[0].id, firstWeight / (firstWeight + lastWeight));
        weights.set(touchpoints[1].id, lastWeight / (firstWeight + lastWeight));
        return weights;
    }

    // First and last get their weights; middle splits the remainder
    const middleWeight = 1.0 - firstWeight - lastWeight;
    const middleCount = touchpoints.length - 2;
    const perMiddle = middleWeight / middleCount;

    touchpoints.forEach((tp, i) => {
        if (i === 0) weights.set(tp.id, firstWeight);
        else if (i === touchpoints.length - 1) weights.set(tp.id, lastWeight);
        else weights.set(tp.id, perMiddle);
    });

    return weights;
}

// ─────────────────────────────────────────────
// Public: Calculate Attribution for an Order
// ─────────────────────────────────────────────

/**
 * Calculate and store attribution weights + revenue for an order.
 * Called when an order is completed.
 */
export async function attributeOrderRevenue(
    orderId: number,
    customerId: string
): Promise<{ touchpoints: AttributedTouchpoint[]; model: string }> {
    const config = await getConfig();

    // Get the order
    const orderResult = await db.query(
        `SELECT total_amount, currency, order_date FROM orders WHERE id = $1`,
        [orderId]
    );
    if (orderResult.rows.length === 0) return { touchpoints: [], model: config.model_type };

    const orderRevenue = parseFloat(orderResult.rows[0].total_amount || '0');
    const orderDate = new Date(orderResult.rows[0].order_date || Date.now());

    // Get touchpoints within lookback window
    const lookbackDate = new Date(orderDate.getTime() - config.lookback_window_days * 24 * 60 * 60 * 1000);

    const touchpoints = await db.query(
        `SELECT id, customer_id, platform, campaign_id, ad_id, created_at
         FROM attribution_touchpoints
         WHERE customer_id = $1 AND created_at >= $2 AND created_at <= $3
         ORDER BY created_at ASC`,
        [customerId, lookbackDate.toISOString(), orderDate.toISOString()]
    );

    const tps = touchpoints.rows as TouchpointForAttribution[];

    if (tps.length === 0) return { touchpoints: [], model: config.model_type };

    // Calculate weights based on model
    let weights: Map<number, number>;

    switch (config.model_type) {
        case 'first_touch':
            weights = calculateFirstTouch(tps);
            break;
        case 'last_touch':
            weights = calculateLastTouch(tps);
            break;
        case 'linear':
            weights = calculateLinear(tps);
            break;
        case 'time_decay':
            weights = calculateTimeDecay(tps, config.time_decay_halflife_days, orderDate);
            break;
        case 'position_based':
            weights = calculatePositionBased(tps, config.position_first_weight, config.position_last_weight);
            break;
        default:
            weights = calculateLastTouch(tps);
    }

    // Update touchpoints with weights and attributed revenue
    const results: AttributedTouchpoint[] = [];

    for (const [tpId, weight] of weights.entries()) {
        const revenue = Math.round(orderRevenue * weight * 100) / 100;

        await db.query(
            `UPDATE attribution_touchpoints
             SET attribution_weight = $1, attributed_revenue = attributed_revenue + $2
             WHERE id = $3`,
            [weight, revenue, tpId]
        );

        results.push({ touchpoint_id: tpId, weight, revenue });
    }

    // Also update the attribution record if it exists
    const lastTp = tps[tps.length - 1];
    if (lastTp.campaign_id) {
        await db.query(
            `UPDATE attributions
             SET attributed_revenue = $1, attribution_model = $2, attribution_weight = 1.0
             WHERE order_id = $3 AND campaign_id = $4`,
            [orderRevenue, config.model_type, orderId, lastTp.campaign_id]
        );
    }

    return { touchpoints: results, model: config.model_type };
}

// ─────────────────────────────────────────────
// Public: Recalculate All Attributions
// ─────────────────────────────────────────────

/**
 * Recalculate all attributions based on the current model.
 * Resets all attributed_revenue to 0, then re-processes all orders.
 */
export async function recalculateAllAttributions(): Promise<{ orders_processed: number; model: string }> {
    const config = await getConfig();

    // Reset all touchpoint attributed_revenue
    await db.query(`UPDATE attribution_touchpoints SET attributed_revenue = 0, attribution_weight = 0`);
    await db.query(`UPDATE attributions SET attributed_revenue = 0, attribution_model = $1`, [config.model_type]);

    // Get all completed orders with a customer
    const orders = await db.query(
        `SELECT o.id, o.customer_id
         FROM orders o
         WHERE o.customer_id IS NOT NULL AND o.status IN ('completed', 'processing')
         ORDER BY o.order_date ASC`
    );

    let processed = 0;

    for (const order of orders.rows) {
        await attributeOrderRevenue(order.id, order.customer_id);
        processed++;
    }

    return { orders_processed: processed, model: config.model_type };
}

// ─────────────────────────────────────────────
// Public: Get Attribution Config
// ─────────────────────────────────────────────

export async function getAttributionConfig(): Promise<AttributionConfig> {
    return getConfig();
}

/**
 * Update attribution model configuration.
 */
export async function updateAttributionConfig(
    updates: Partial<AttributionConfig>
): Promise<AttributionConfig> {
    const result = await db.query(
        `UPDATE attribution_config SET
             model_type = COALESCE($1, model_type),
             time_decay_halflife_days = COALESCE($2, time_decay_halflife_days),
             position_first_weight = COALESCE($3, position_first_weight),
             position_last_weight = COALESCE($4, position_last_weight),
             lookback_window_days = COALESCE($5, lookback_window_days),
             updated_at = NOW()
         WHERE is_active = TRUE
         RETURNING *`,
        [
            updates.model_type || null,
            updates.time_decay_halflife_days ?? null,
            updates.position_first_weight ?? null,
            updates.position_last_weight ?? null,
            updates.lookback_window_days ?? null,
        ]
    );

    return result.rows[0] as AttributionConfig;
}
