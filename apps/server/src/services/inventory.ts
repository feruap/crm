/**
 * Real-Time Inventory Service
 *
 * Queries WooCommerce REST API for product stock data.
 * Includes a 5-minute cache to avoid overloading the WC API.
 *
 * AlmacenPT plugin adds lot-level inventory to WC, but its
 * stock_quantity rollup is exposed via the standard WC product endpoint.
 */

import { db } from '../db';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface StockInfo {
    product_id: number;
    product_name: string;
    sku: string;
    stock_quantity: number | null;
    stock_status: 'instock' | 'outofstock' | 'onbackorder';
    manage_stock: boolean;
    backorders_allowed: boolean;
    low_stock_threshold: number | null;
    cached_at: string;
}

// ─────────────────────────────────────────────
// Cache (in-memory, 5 min TTL)
// ─────────────────────────────────────────────

const stockCache = new Map<number, { data: StockInfo; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedStock(productId: number): StockInfo | null {
    const entry = stockCache.get(productId);
    if (entry && entry.expiresAt > Date.now()) return entry.data;
    if (entry) stockCache.delete(productId);
    return null;
}

function setCachedStock(productId: number, data: StockInfo): void {
    stockCache.set(productId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─────────────────────────────────────────────
// WooCommerce API
// ─────────────────────────────────────────────

function getWCAuth(): { url: string; auth: string } {
    const wcUrl = process.env.WC_URL;
    const wcKey = process.env.WC_KEY;
    const wcSecret = process.env.WC_SECRET;

    if (!wcUrl || !wcKey || !wcSecret) {
        throw new Error('WooCommerce credentials not configured (WC_URL, WC_KEY, WC_SECRET)');
    }

    return {
        url: wcUrl,
        auth: Buffer.from(`${wcKey}:${wcSecret}`).toString('base64'),
    };
}

// ─────────────────────────────────────────────
// Public: Get Stock for a Product
// ─────────────────────────────────────────────

export async function getProductStock(wcProductId: number): Promise<StockInfo> {
    // Check cache
    const cached = getCachedStock(wcProductId);
    if (cached) return cached;

    const { url, auth } = getWCAuth();

    const response = await fetch(`${url}/wp-json/wc/v3/products/${wcProductId}`, {
        headers: { Authorization: `Basic ${auth}` },
    });

    if (!response.ok) {
        throw new Error(`WC API error ${response.status} for product ${wcProductId}`);
    }

    const product = await response.json() as {
        id: number;
        name: string;
        sku: string;
        stock_quantity: number | null;
        stock_status: string;
        manage_stock: boolean;
        backorders_allowed: boolean;
        low_stock_amount: number | null;
    };

    const stockInfo: StockInfo = {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        stock_quantity: product.stock_quantity,
        stock_status: product.stock_status as StockInfo['stock_status'],
        manage_stock: product.manage_stock,
        backorders_allowed: product.backorders_allowed,
        low_stock_threshold: product.low_stock_amount,
        cached_at: new Date().toISOString(),
    };

    setCachedStock(wcProductId, stockInfo);
    return stockInfo;
}

// ─────────────────────────────────────────────
// Public: Get Stock for Multiple Products
// ─────────────────────────────────────────────

export async function getBulkProductStock(wcProductIds: number[]): Promise<StockInfo[]> {
    const results: StockInfo[] = [];
    const uncachedIds: number[] = [];

    // Check cache first
    for (const id of wcProductIds) {
        const cached = getCachedStock(id);
        if (cached) {
            results.push(cached);
        } else {
            uncachedIds.push(id);
        }
    }

    if (uncachedIds.length === 0) return results;

    // Fetch uncached products in bulk (WC supports up to 100 per page)
    const { url, auth } = getWCAuth();

    const response = await fetch(
        `${url}/wp-json/wc/v3/products?include=${uncachedIds.join(',')}&per_page=100`,
        { headers: { Authorization: `Basic ${auth}` } }
    );

    if (!response.ok) {
        throw new Error(`WC API bulk stock error ${response.status}`);
    }

    const products = await response.json() as Array<{
        id: number;
        name: string;
        sku: string;
        stock_quantity: number | null;
        stock_status: string;
        manage_stock: boolean;
        backorders_allowed: boolean;
        low_stock_amount: number | null;
    }>;

    for (const product of products) {
        const stockInfo: StockInfo = {
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            stock_quantity: product.stock_quantity,
            stock_status: product.stock_status as StockInfo['stock_status'],
            manage_stock: product.manage_stock,
            backorders_allowed: product.backorders_allowed,
            low_stock_threshold: product.low_stock_amount,
            cached_at: new Date().toISOString(),
        };

        setCachedStock(product.id, stockInfo);
        results.push(stockInfo);
    }

    return results;
}

// ─────────────────────────────────────────────
// Public: Get Stock Text for Bot
// ─────────────────────────────────────────────

/**
 * Returns a human-readable stock status for use in bot responses.
 */
export async function getStockTextForBot(wcProductId: number): Promise<string> {
    try {
        const stock = await getProductStock(wcProductId);

        if (stock.stock_status === 'outofstock') {
            return 'Actualmente agotado';
        }

        if (stock.stock_status === 'onbackorder') {
            return 'Disponible bajo pedido (backorder)';
        }

        if (stock.manage_stock && stock.stock_quantity !== null) {
            if (stock.stock_quantity <= 0) return 'Sin stock disponible';
            if (stock.low_stock_threshold && stock.stock_quantity <= stock.low_stock_threshold) {
                return `Últimas ${stock.stock_quantity} unidades disponibles`;
            }
            return `Disponible (${stock.stock_quantity} unidades en stock)`;
        }

        return 'Disponible';
    } catch {
        return 'Disponibilidad no verificada';
    }
}

// ─────────────────────────────────────────────
// Public: Clear Cache
// ─────────────────────────────────────────────

export function clearStockCache(): void {
    stockCache.clear();
}
