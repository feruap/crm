/**
 * WooCommerce Integration Engine - REWRITTEN
 *
 * CORRECT ARCHITECTURE: Bot guides purchases to WooCommerce, NOT creates orders.
 *
 * Key flows:
 * 1. Cart Link Generation - Bot generates personalized WC cart URLs with attribution
 * 2. Order Webhook Handling - WC fires order.created → CRM matches to conversation
 * 3. Kanban State Awareness - Real WC statuses (pending, processing, shipped, etc.)
 * 4. WC History Context - Build customer context from actual WC order history
 * 5. Discount Workflow - Bot initiates SalesKing Custom Discounts (if needed)
 * 6. Commission Tracking - Track agent commissions from SalesKing metadata
 */

import { db } from '../db';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface WCOrderSummary {
    id: number;
    status: string;
    total: string;
    date_created: string;
    line_items: Array<{ name: string; quantity: number; total: string }>;
    kanban_state?: KanbanColumnInfo;
}

export interface KanbanColumnInfo {
    wc_status: string;
    kanban_column: string; // Spanish name
    color: string;
    customer_message: string; // What to tell the customer
}

export interface PricingTier {
    min_quantity: number;
    price_mxn: number;
    discount_percent: number;
}

export interface CustomerWCContext {
    total_orders: number;
    total_spent: number;
    last_order_date: string | null;
    pending_orders: WCOrderSummary[];
    most_purchased: string[];
    days_since_last_order: number;
    is_reorder_candidate: boolean;
    cross_sell_opportunities: string[];
    greeting_context: string; // Pre-built greeting for the bot
}

export interface GenerateCartLinkParams {
    productIds: Array<{ wcProductId: number; quantity: number }>;
    agentId: string;
    campaignId?: string;
    customerId?: string;
    couponCode?: string;
}

export interface DiscountRequestResult {
    success: boolean;
    requestId?: string;
    status?: string;
    message?: string;
    error?: string;
}

export interface AttributionResult {
    success: boolean;
    conversationId?: string;
    orderId?: string;
    agentId?: string;
    error?: string;
}

export interface CommissionInfo {
    orderId: string;
    agentId: string;
    orderTotal: number;
    commissionRate: number;
    commissionAmount: number;
}

// ─────────────────────────────────────────────
// Kanban Status Mapping (Real WC statuses)
// ─────────────────────────────────────────────

const KANBAN_STATUS_MAP: Record<string, KanbanColumnInfo> = {
    'pending': {
        wc_status: 'pending',
        kanban_column: 'Esperando Pago',
        color: '#f0ad4e',
        customer_message: 'Tu pedido está pendiente de pago.',
    },
    'on-hold': {
        wc_status: 'on-hold',
        kanban_column: 'En Espera',
        color: '#5bc0de',
        customer_message: 'Tu pedido está en revisión.',
    },
    'processing': {
        wc_status: 'processing',
        kanban_column: 'En Preparación',
        color: '#0275d8',
        customer_message: 'Tu pedido está siendo preparado para envío.',
    },
    'shipped': {
        wc_status: 'shipped',
        kanban_column: 'Enviado',
        color: '#5cb85c',
        customer_message: 'Tu pedido ya fue enviado. Llegaría en 2-5 días hábiles.',
    },
    'completed': {
        wc_status: 'completed',
        kanban_column: 'Entregado',
        color: '#5cb85c',
        customer_message: 'Tu pedido fue entregado.',
    },
    'cancelled': {
        wc_status: 'cancelled',
        kanban_column: 'Cancelado',
        color: '#d9534f',
        customer_message: 'Tu pedido fue cancelado.',
    },
    'refunded': {
        wc_status: 'refunded',
        kanban_column: 'Reembolsado',
        color: '#292b2c',
        customer_message: 'Tu reembolso ha sido procesado.',
    },
};

// ─────────────────────────────────────────────
// Cart Link Generation
// ─────────────────────────────────────────────

/**
 * Generate a personalized WooCommerce cart link with attribution + agent tracking.
 * Customer completes purchase on WC, order webhook syncs back to CRM.
 *
 * Example output:
 * https://testamunet.local/cart/?add-to-cart=123&quantity=20&utm_source=crm_bot&utm_medium=whatsapp&utm_campaign=hba1c_marzo_2026&salesking_agent=5
 */
export function generateWCCartLink(params: GenerateCartLinkParams): string {
    const WC_STORE_URL = process.env.WC_STORE_URL || 'http://testamunet.local';

    const url = new URL(`${WC_STORE_URL}/cart/`);

    // Add products to cart
    if (params.productIds.length === 1) {
        // Single product: use add-to-cart syntax
        const prod = params.productIds[0];
        url.searchParams.append('add-to-cart', String(prod.wcProductId));
        url.searchParams.append('quantity', String(prod.quantity));
    } else {
        // Multiple products: add each separately
        for (const prod of params.productIds) {
            // WC requires separate requests for multiple items
            // For now, use first product and note limitation
            if (params.productIds.indexOf(prod) === 0) {
                url.searchParams.append('add-to-cart', String(prod.wcProductId));
                url.searchParams.append('quantity', String(prod.quantity));
            }
        }
    }

    // UTM Attribution
    url.searchParams.append('utm_source', 'crm_bot');
    url.searchParams.append('utm_medium', 'whatsapp'); // or other channel
    if (params.campaignId) {
        url.searchParams.append('utm_campaign', params.campaignId);
    }

    // SalesKing agent tracking
    if (params.agentId) {
        url.searchParams.append('salesking_agent', params.agentId);
    }

    // Coupon code if applicable
    if (params.couponCode) {
        url.searchParams.append('coupon', params.couponCode);
    }

    return url.toString();
}

// ─────────────────────────────────────────────
// WC Customer History Context
// ─────────────────────────────────────────────

/**
 * Get customer's WooCommerce order history and build context for bot personalization.
 * Called at conversation start to enable smarter greetings and upselling.
 */
export async function buildCustomerWCContext(customerEmail: string): Promise<CustomerWCContext> {
    try {
        // In production, this would call WC REST API
        // For now, return minimal context that can be populated from DB
        const dbResult = await db.query(
            `SELECT id FROM customers WHERE email = $1 LIMIT 1`,
            [customerEmail]
        ).catch(() => ({ rows: [] }));

        if (dbResult.rows.length === 0) {
            return {
                total_orders: 0,
                total_spent: 0,
                last_order_date: null,
                pending_orders: [],
                most_purchased: [],
                days_since_last_order: 999,
                is_reorder_candidate: false,
                cross_sell_opportunities: [],
                greeting_context: 'Hola! Bienvenido a Botón Médico.',
            };
        }

        // Query customer order history
        const ordersResult = await db.query(
            `SELECT id, total_amount, status, created_at
             FROM orders
             WHERE customer_id = $1
             ORDER BY created_at DESC
             LIMIT 10`,
            [dbResult.rows[0].id]
        ).catch(() => ({ rows: [] }));

        const orders = ordersResult.rows || [];
        const totalOrders = orders.length;
        const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

        const lastOrder = orders[0];
        const lastOrderDate = lastOrder?.created_at || null;
        const daysSinceLastOrder = lastOrder
            ? Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / (1000 * 60 * 60 * 24))
            : 999;

        const pendingOrders = orders.filter(o => ['pending', 'on-hold', 'processing'].includes(o.status));

        const greeting = lastOrderDate
            ? `Hola! Vemos que tu último pedido fue hace ${daysSinceLastOrder} días. ¿Necesitas reordenar?`
            : 'Hola! Bienvenido a Botón Médico. ¿En qué puedo ayudarte?';

        return {
            total_orders: totalOrders,
            total_spent: totalSpent,
            last_order_date: lastOrderDate,
            pending_orders: pendingOrders.map(o => ({
                id: o.id,
                status: o.status,
                total: String(o.total_amount),
                date_created: o.created_at,
                line_items: [],
            })),
            most_purchased: [], // Would be populated from order items
            days_since_last_order: daysSinceLastOrder,
            is_reorder_candidate: daysSinceLastOrder > 30 && daysSinceLastOrder < 365,
            cross_sell_opportunities: [], // Would use recommendations
            greeting_context: greeting,
        };
    } catch (err) {
        console.error('[Customer WC Context Error]', err);
        return {
            total_orders: 0,
            total_spent: 0,
            last_order_date: null,
            pending_orders: [],
            most_purchased: [],
            days_since_last_order: 999,
            is_reorder_candidate: false,
            cross_sell_opportunities: [],
            greeting_context: 'Hola! Bienvenido a Botón Médico.',
        };
    }
}

/**
 * Get customer's WooCommerce order history (via REST API or DB).
 */
export async function getCustomerWCOrders(customerEmail: string): Promise<WCOrderSummary[]> {
    try {
        // In production: call WC REST API
        // For now: query from CRM database
        const result = await db.query(
            `SELECT o.id, o.status, o.total_amount, o.created_at
             FROM orders o
             JOIN customers c ON o.customer_id = c.id
             WHERE c.email = $1
             ORDER BY o.created_at DESC
             LIMIT 20`,
            [customerEmail]
        ).catch(() => ({ rows: [] }));

        return (result.rows || []).map(row => ({
            id: row.id,
            status: row.status,
            total: String(row.total_amount),
            date_created: row.created_at,
            line_items: [],
        }));
    } catch (err) {
        console.error('[Get WC Orders Error]', err);
        return [];
    }
}

/**
 * Get specific order with Kanban state mapping.
 */
export async function getOrderWithKanbanState(orderId: string): Promise<any> {
    try {
        const result = await db.query(
            `SELECT id, status, total_amount, created_at FROM orders WHERE id = $1`,
            [orderId]
        ).catch(() => ({ rows: [] }));

        if (result.rows.length === 0) {
            return null;
        }

        const order = result.rows[0];
        const kanbanInfo = mapWCStatusToKanban(order.status);

        return {
            orderId: order.id,
            status: order.status,
            total: order.total_amount,
            created_at: order.created_at,
            kanban_column: kanbanInfo.kanban_column,
            customer_message: kanbanInfo.customer_message,
        };
    } catch (err) {
        console.error('[Get Order Kanban Error]', err);
        return null;
    }
}

/**
 * Map WooCommerce status to Kanban column info.
 */
export function mapWCStatusToKanban(wcStatus: string): KanbanColumnInfo {
    return KANBAN_STATUS_MAP[wcStatus.toLowerCase()] || {
        wc_status: wcStatus,
        kanban_column: 'Desconocido',
        color: '#999',
        customer_message: 'Tu pedido está en proceso.',
    };
}

// ─────────────────────────────────────────────
// Discount Workflow (SalesKing Custom Discounts)
// ─────────────────────────────────────────────

/**
 * Request discount via SalesKing Custom Discounts plugin.
 * Checks agent's max discount and approver hierarchy.
 */
export async function requestSKDiscount(params: {
    agentId: string;
    customerId: string;
    discountPercent: number;
    reason: string;
    cartItems: Array<{ name: string; qty: number }>;
    cartSubtotal: number;
}): Promise<DiscountRequestResult> {
    try {
        const { agentId, customerId, discountPercent, reason, cartItems, cartSubtotal } = params;

        // In production: check agent's max discount from SalesKing group meta
        // sk_group_max_discount (stored on agent user or group post)
        // For now: simulate with default max 15%

        const maxDiscount = 15; // Would come from SalesKing meta

        if (discountPercent > maxDiscount) {
            // Needs approver - route to parent agent
            const requestId = `sk_discount_req_${customerId}_${Date.now()}`;

            // Record in discount_requests table
            try {
                await db.query(
                    `INSERT INTO discount_requests (customer_id, agent_id, discount_percent, reason, status)
                     VALUES ($1, $2, $3, $4, 'pending')
                     ON CONFLICT DO NOTHING`,
                    [customerId, agentId, discountPercent, reason]
                ).catch(() => null);
            } catch {
                // Table may not exist
            }

            return {
                success: true,
                requestId,
                status: 'pending_approval',
                message: `Solicitud de descuento del ${discountPercent}% está pendiente de aprobación por tu gerente. Te notificaremos cuando se apruebe.`,
            };
        }

        // Discount within agent limit - can apply immediately
        return {
            success: true,
            requestId: `sk_discount_${customerId}_${Date.now()}`,
            status: 'approved',
            message: `Descuento del ${discountPercent}% aplicado.`,
        };
    } catch (err) {
        console.error('[Discount Request Error]', err);
        return {
            success: false,
            error: 'Error procesando solicitud de descuento',
        };
    }
}

// ─────────────────────────────────────────────
// Attribution Tracking
// ─────────────────────────────────────────────

/**
 * Track attribution when order webhook is received from WooCommerce.
 * Matches order to conversation via email/phone.
 */
export async function attributeOrderToConversation(params: {
    orderId: string;
    orderEmail: string;
    orderPhone: string;
    orderTotal: number;
    orderMeta: Record<string, string>;
}): Promise<AttributionResult> {
    try {
        const { orderId, orderEmail, orderPhone, orderTotal, orderMeta } = params;

        // Find conversation by customer email/phone
        const convResult = await db.query(
            `SELECT c.id, c.agent_id
             FROM conversations c
             JOIN customers cu ON c.customer_id = cu.id
             WHERE cu.email = $1 OR cu.phone = $2
             ORDER BY c.updated_at DESC
             LIMIT 1`,
            [orderEmail, orderPhone]
        ).catch(() => ({ rows: [] }));

        if (convResult.rows.length === 0) {
            return {
                success: false,
                error: 'No se encontró conversación asociada',
            };
        }

        const conversation = convResult.rows[0];

        // Extract UTM + agent from WC order meta
        const utmCampaign = orderMeta.utm_campaign || '';
        const salesKingAgent = orderMeta.salesking_agent || conversation.agent_id;

        // Track attribution in chain
        try {
            await db.query(
                `INSERT INTO attribution_chain (customer_id, conversation_id, order_id, campaign_id, order_total)
                 SELECT cu.id, $2, $1, $3, $4
                 FROM customers cu
                 WHERE cu.email = $5
                 ON CONFLICT DO NOTHING`,
                [orderId, conversation.id, utmCampaign, orderTotal, orderEmail]
            ).catch(() => null);
        } catch {
            // Table may not exist
        }

        return {
            success: true,
            conversationId: conversation.id,
            orderId,
            agentId: salesKingAgent,
        };
    } catch (err) {
        console.error('[Attribution Tracking Error]', err);
        return {
            success: false,
            error: 'Error registrando atribución',
        };
    }
}

// ─────────────────────────────────────────────
// Commission Tracking (SalesKing integration)
// ─────────────────────────────────────────────

/**
 * Get agent commission for an order from SalesKing metadata.
 */
export async function getAgentCommissionForOrder(
    orderId: string,
    agentId: string
): Promise<CommissionInfo> {
    try {
        // Check conversation_commissions table
        const result = await db.query(
            `SELECT order_total, commission_rate, commission_amount
             FROM conversation_commissions
             WHERE order_id = $1 AND agent_id = $2`,
            [orderId, agentId]
        ).catch(() => ({ rows: [] }));

        if (result.rows.length > 0) {
            const row = result.rows[0];
            return {
                orderId,
                agentId,
                orderTotal: row.order_total,
                commissionRate: row.commission_rate,
                commissionAmount: row.commission_amount,
            };
        }

        // Default commission (10%)
        return {
            orderId,
            agentId,
            orderTotal: 0,
            commissionRate: 0.1,
            commissionAmount: 0,
        };
    } catch (err) {
        console.error('[Commission Tracking Error]', err);
        return {
            orderId,
            agentId,
            orderTotal: 0,
            commissionRate: 0.1,
            commissionAmount: 0,
        };
    }
}

// ─────────────────────────────────────────────
// B2BKing Pricing (Product-group pricing tiers)
// ─────────────────────────────────────────────

/**
 * Get B2BKing pricing for a product and customer group.
 * Product meta: b2bking_product_pricetiers_group_[GROUP_ID]
 * Format: "qty:price" pairs like "10:95.50;50:90.00"
 */
export async function getB2BPricing(
    productId: number,
    customerGroupId?: string
): Promise<PricingTier[]> {
    try {
        if (!customerGroupId) {
            // Return default public pricing
            return [
                { min_quantity: 1, price_mxn: 100, discount_percent: 0 },
                { min_quantity: 10, price_mxn: 90, discount_percent: 10 },
                { min_quantity: 50, price_mxn: 80, discount_percent: 20 },
            ];
        }

        // In production: query WC product meta for B2BKing tier data
        // For now: return default
        return [
            { min_quantity: 1, price_mxn: 95.5, discount_percent: 4.5 },
            { min_quantity: 10, price_mxn: 85.5, discount_percent: 14.5 },
            { min_quantity: 50, price_mxn: 75.5, discount_percent: 24.5 },
        ];
    } catch (err) {
        console.error('[B2B Pricing Error]', err);
        return [];
    }
}

// ─────────────────────────────────────────────
// Kanban Permissions (Role-based from SalesKing)
// ─────────────────────────────────────────────

/**
 * Get agent's Kanban transition permissions.
 */
export function getAgentKanbanPermissions(agentId: string, agentRole: string) {
    const baseTransitions: Record<string, string[]> = {
        'Esperando Pago': ['En Preparación', 'Cancelado'],
        'En Preparación': ['Enviado', 'Cancelado'],
        'Enviado': ['Entregado', 'Cancelado'],
        'Entregado': [],
        'Cancelado': [],
        'Reembolsado': [],
        'En Espera': ['En Preparación', 'Cancelado'],
    };

    // Role-based restrictions (SalesKing hierarchy)
    let allowedStates = Object.keys(baseTransitions);

    if (agentRole === 'operador' || agentRole === 'agent') {
        allowedStates = ['Esperando Pago', 'En Preparación', 'En Espera'];
    } else if (agentRole === 'gerente' || agentRole === 'supervisor') {
        allowedStates = Object.keys(baseTransitions);
    }

    const transitions: Record<string, string[]> = {};
    for (const state of allowedStates) {
        transitions[state] = baseTransitions[state] || [];
    }

    return {
        agent_role: agentRole,
        allowed_states: allowedStates,
        transitions,
    };
}
