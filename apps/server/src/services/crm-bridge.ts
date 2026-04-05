/**
 * Amunet CRM Bridge Client
 *
 * Client for the WordPress plugin "Amunet CRM Bridge v2.0.0"
 * which exposes SalesKing, B2BKing, visitor tracking, and order data
 * via REST API under the namespace `amunet-crm/v1`.
 *
 * Auth: WooCommerce API keys (same as WC REST API).
 * Uses query param auth to avoid WordPress intercepting Basic Auth.
 */

import { getWCCreds, WCCreds } from '../utils/wc-creds';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface BridgeHealthResponse {
  status: string;
  version: string;
  salesking_active: boolean;
  b2bking_active: boolean;
  wc_version: string;
}

export interface SalesKingAgentResponse {
  agent_id: number;
  display_name: string;
  email: string;
  user_choice: string;
  roles: string[];
  group: {
    id: number;
    name: string;
    max_discount: number;
  } | null;
  pricing: {
    agent_max_discount: number;
    effective_max_discount: number;
    can_increase_price: boolean;
    can_decrease_price: boolean;
    discount_from_commission: boolean;
  };
  earnings: {
    total: number;
    outstanding: number;
    paid: number;
  };
  parent_agent: number | null;
  assigned_customers: number;
}

export interface SalesKingGroupResponse {
  groups: Array<{
    id: number;
    name: string;
    max_discount: number;
    agent_count: number;
  }>;
}

export interface SalesKingSettingsResponse {
  can_edit_prices_increase: number;
  can_edit_prices_discount: number;
  discount_from_commission: number;
  different_price_channels: number;
  [key: string]: any;
}

export interface SalesKingRulesResponse {
  rules: Array<{
    id: number;
    title: string;
    salesking_standard_rule_priority?: string;
    type: string;
    amount: string;
    applies_to: string;
  }>;
}

export interface B2BKingPricingResponse {
  product_id: number;
  regular_price: string;
  sale_price: string;
  price: string;
  tax_status: string;
  tax_class: string;
  tiered_pricing: Array<{
    rule_id: number;
    min_quantity: number;
    discount_type: string; // e.g. 'percentage', 'fixed'
    discount_value: number;
    title: string;
  }>;
  customer_group_pricing: {
    group_id: number;
    group_name: string;
    regular_price: string | null;
    sale_price: string | null;
  } | null;
  tax_exempt: boolean;
}

export interface B2BKingCustomerResponse {
  customer_id: number;
  display_name: string;
  email: string;
  b2bking_group: {
    id: number;
    name: string;
  } | null;
  is_b2b: boolean;
  tax_exempt: boolean;
  discount_rules: any[];
}

export interface B2BKingGroupsResponse {
  groups: Array<{
    id: number;
    name: string;
    tax_exempt: boolean;
    discount: number;
    members: number;
  }>;
}

export interface OrderTrackingResponse {
  order_id: number;
  order_status: string;
  order_total: string;
  currency: string;
  date_created: string;
  date_paid: string | null;
  payment_method: string;
  has_tracking: boolean;
  tracking: any[];
  kanban_column?: string;
}

export interface PaymentMethodsResponse {
  methods: Array<{
    id: string;
    title: string;
    description: string;
    enabled: boolean;
  }>;
}

export interface ShippingZonesResponse {
  zones: Array<{
    zone_id: number;
    zone_name: string;
    methods: Array<{
      id: string;
      title: string;
      cost?: string;
    }>;
  }>;
}

export interface VisitorResponse {
  found: boolean;
  cookie_id?: string;
  phone?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  products_visited?: string;
  pages?: any[];
}

export interface TrackVisitorParams {
  cookie_id: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  products_visited?: string[];
  pages?: Array<{ url: string; title: string; ts: number }>;
  referrer?: string;
  landing_page?: string;
}

export interface LinkPhoneParams {
  cookie_id: string;
  phone: string;
}

// ─────────────────────────────────────────────
// Core fetch with WC auth
// ─────────────────────────────────────────────

let credsCache: WCCreds | null = null;
let credsCacheTime = 0;
const CREDS_CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getCachedCreds(): Promise<WCCreds> {
  if (credsCache && Date.now() - credsCacheTime < CREDS_CACHE_TTL) {
    return credsCache;
  }
  credsCache = await getWCCreds();
  credsCacheTime = Date.now();
  return credsCache;
}

/**
 * Fetch from the Amunet CRM Bridge plugin REST API.
 * Uses query param auth (consumer_key / consumer_secret) to avoid
 * WordPress Application Passwords intercepting Basic Auth headers.
 */
export async function bridgeFetch<T = any>(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<T> {
  const creds = await getCachedCreds();
  if (!creds.url || !creds.key || !creds.secret) {
    throw new Error('WooCommerce credentials not configured for CRM Bridge');
  }

  const baseUrl = creds.url.replace(/\/$/, '');
  const separator = endpoint.includes('?') ? '&' : '?';
  const authParams = `consumer_key=${encodeURIComponent(creds.key)}&consumer_secret=${encodeURIComponent(creds.secret)}`;
  const fullUrl = `${baseUrl}/wp-json/amunet-crm/v1${endpoint}${separator}${authParams}`;

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(fullUrl, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CRM Bridge ${method} ${endpoint} returned ${response.status}: ${text}`);
  }

  return response.json();
}

// ─────────────────────────────────────────────
// API Methods
// ─────────────────────────────────────────────

/** Health check - verifies plugin is active and accessible */
export async function bridgeHealth(): Promise<BridgeHealthResponse> {
  return bridgeFetch('/health');
}

// ── SalesKing ──

/** Get SalesKing agent details including groups, rules, earnings */
export async function getSalesKingAgent(agentId: number): Promise<SalesKingAgentResponse> {
  return bridgeFetch(`/salesking-agent/${agentId}`);
}

/** Get all SalesKing agent groups with max discount */
export async function getSalesKingGroups(): Promise<SalesKingGroupResponse> {
  return bridgeFetch('/salesking-groups');
}

/** Get SalesKing global settings */
export async function getSalesKingSettings(): Promise<SalesKingSettingsResponse> {
  return bridgeFetch('/salesking-settings');
}

/** Get SalesKing commission rules */
export async function getSalesKingRules(): Promise<SalesKingRulesResponse> {
  return bridgeFetch('/salesking-rules');
}

// ── B2BKing ──

/** Get B2BKing pricing tiers for a product (all groups) */
export async function getB2BKingPricing(productId: number): Promise<B2BKingPricingResponse> {
  return bridgeFetch(`/b2bking-pricing/${productId}`);
}

/** Get B2BKing customer details including group and tax status */
export async function getB2BKingCustomer(customerId: number): Promise<B2BKingCustomerResponse> {
  return bridgeFetch(`/b2bking-customer/${customerId}`);
}

/** Get all B2BKing groups */
export async function getB2BKingGroups(): Promise<B2BKingGroupsResponse> {
  return bridgeFetch('/b2bking-groups');
}

// ── Orders ──

/** Get order tracking info including status, payment, and shipment tracking */
export async function getOrderTracking(orderId: number): Promise<OrderTrackingResponse> {
  return bridgeFetch(`/order-tracking/${orderId}`);
}

// ── Store Config ──

/** Get available payment methods */
export async function getPaymentMethods(): Promise<PaymentMethodsResponse> {
  return bridgeFetch('/payment-methods');
}

/** Get shipping zones with methods */
export async function getShippingZones(): Promise<ShippingZonesResponse> {
  return bridgeFetch('/shipping-zones');
}

// ── Visitor Tracking ──

/** Look up visitor by phone number */
export async function getVisitorByPhone(phone: string): Promise<VisitorResponse> {
  // Strip non-digits for URL
  const cleanPhone = phone.replace(/\D/g, '');
  return bridgeFetch(`/visitor/${cleanPhone}`);
}

/** Look up visitor by cookie ID */
export async function getVisitorByCookie(cookieId: string): Promise<VisitorResponse> {
  return bridgeFetch(`/visitor-by-cookie/${encodeURIComponent(cookieId)}`);
}

/** Track a visitor event (page view, UTM capture, etc.) */
export async function trackVisitor(params: TrackVisitorParams): Promise<{ ok: boolean }> {
  return bridgeFetch('/track', 'POST', params);
}

/** Link a phone number to a visitor cookie (WhatsApp attribution) */
export async function linkVisitorPhone(params: LinkPhoneParams): Promise<{ ok: boolean }> {
  return bridgeFetch('/link-phone', 'POST', params);
}

// ─────────────────────────────────────────────
// Convenience: Get agent's max discount
// ─────────────────────────────────────────────

/**
 * Get the maximum discount an agent can apply based on their SalesKing config.
 * Uses pricing.effective_max_discount (considers group + agent-level overrides).
 * Falls back to group.max_discount if pricing data is not available.
 */
export async function getAgentMaxDiscount(agentId: number): Promise<number> {
  try {
    const agent = await getSalesKingAgent(agentId);
    // effective_max_discount is the combined limit (group + agent overrides)
    if (agent.pricing?.effective_max_discount != null) {
      return agent.pricing.effective_max_discount;
    }
    // Fallback to group max discount
    if (agent.group?.max_discount != null) {
      return agent.group.max_discount;
    }
    return 0;
  } catch (err) {
    console.error(`[CRM Bridge] Failed to get agent ${agentId} max discount:`, err);
    return 0;
  }
}

/**
 * Get B2B pricing tiers for a specific product.
 * Returns tiered discount rules (quantity-based) from B2BKing.
 */
export async function getB2BPricingTiers(
  productId: number
): Promise<B2BKingPricingResponse['tiered_pricing']> {
  try {
    const pricing = await getB2BKingPricing(productId);
    return pricing.tiered_pricing || [];
  } catch (err) {
    console.error(`[CRM Bridge] Failed to get B2B pricing for product ${productId}:`, err);
    return [];
  }
}

/**
 * Get B2B customer-group-specific pricing for a product.
 * Passes customer_id to the bridge so it can look up group pricing.
 */
export async function getB2BCustomerPricing(
  productId: number,
  customerId: number
): Promise<B2BKingPricingResponse> {
  return bridgeFetch(`/b2bking-pricing/${productId}?customer_id=${customerId}`);
}
