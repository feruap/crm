"use strict";
/**
 * Real-Time Inventory Service
 *
 * Queries WooCommerce REST API for product stock data.
 * Includes a 5-minute cache to avoid overloading the WC API.
 *
 * AlmacenPT plugin adds lot-level inventory to WC, but its
 * stock_quantity rollup is exposed via the standard WC product endpoint.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductStock = getProductStock;
exports.getBulkProductStock = getBulkProductStock;
exports.getStockTextForBot = getStockTextForBot;
exports.clearStockCache = clearStockCache;
// ─────────────────────────────────────────────
// Cache (in-memory, 5 min TTL)
// ─────────────────────────────────────────────
const stockCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
function getCachedStock(productId) {
    const entry = stockCache.get(productId);
    if (entry && entry.expiresAt > Date.now())
        return entry.data;
    if (entry)
        stockCache.delete(productId);
    return null;
}
function setCachedStock(productId, data) {
    stockCache.set(productId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}
// ─────────────────────────────────────────────
// WooCommerce API
// ─────────────────────────────────────────────
function getWCAuth() {
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
async function getProductStock(wcProductId) {
    // Check cache
    const cached = getCachedStock(wcProductId);
    if (cached)
        return cached;
    const { url, auth } = getWCAuth();
    const response = await fetch(`${url}/wp-json/wc/v3/products/${wcProductId}`, {
        headers: { Authorization: `Basic ${auth}` },
    });
    if (!response.ok) {
        throw new Error(`WC API error ${response.status} for product ${wcProductId}`);
    }
    const product = await response.json();
    const stockInfo = {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        stock_quantity: product.stock_quantity,
        stock_status: product.stock_status,
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
async function getBulkProductStock(wcProductIds) {
    const results = [];
    const uncachedIds = [];
    // Check cache first
    for (const id of wcProductIds) {
        const cached = getCachedStock(id);
        if (cached) {
            results.push(cached);
        }
        else {
            uncachedIds.push(id);
        }
    }
    if (uncachedIds.length === 0)
        return results;
    // Fetch uncached products in bulk (WC supports up to 100 per page)
    const { url, auth } = getWCAuth();
    const response = await fetch(`${url}/wp-json/wc/v3/products?include=${uncachedIds.join(',')}&per_page=100`, { headers: { Authorization: `Basic ${auth}` } });
    if (!response.ok) {
        throw new Error(`WC API bulk stock error ${response.status}`);
    }
    const products = await response.json();
    for (const product of products) {
        const stockInfo = {
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            stock_quantity: product.stock_quantity,
            stock_status: product.stock_status,
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
async function getStockTextForBot(wcProductId) {
    try {
        const stock = await getProductStock(wcProductId);
        if (stock.stock_status === 'outofstock') {
            return 'Actualmente agotado';
        }
        if (stock.stock_status === 'onbackorder') {
            return 'Disponible bajo pedido (backorder)';
        }
        if (stock.manage_stock && stock.stock_quantity !== null) {
            if (stock.stock_quantity <= 0)
                return 'Sin stock disponible';
            if (stock.low_stock_threshold && stock.stock_quantity <= stock.low_stock_threshold) {
                return `Últimas ${stock.stock_quantity} unidades disponibles`;
            }
            return `Disponible (${stock.stock_quantity} unidades en stock)`;
        }
        return 'Disponible';
    }
    catch {
        return 'Disponibilidad no verificada';
    }
}
// ─────────────────────────────────────────────
// Public: Clear Cache
// ─────────────────────────────────────────────
function clearStockCache() {
    stockCache.clear();
}
