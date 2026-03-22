/**
 * WooCommerce Price & Presentaciones Sync Service
 *
 * WooCommerce is the SOURCE OF TRUTH for prices/presentaciones.
 * This service periodically pulls product data from WC API and updates
 * the CRM medical_products table.
 *
 * Flow:
 * 1. Fetch all published products from WC REST API
 * 2. Match to medical_products by wc_product_id or url_tienda
 * 3. Update precio_publico, presentaciones, and related pricing fields
 * 4. Log all changes in wc_price_sync_log
 *
 * Can be triggered:
 * - Scheduled job (every 30 min via BullMQ or cron)
 * - Manual API call: POST /api/medical-products/sync-prices
 * - WC webhook on product.updated
 */

import { db } from '../db';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface WCProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  status: string;
  price: string;
  regular_price: string;
  sale_price: string;
  variations: number[];
  meta_data: Array<{ key: string; value: any }>;
}

interface WCVariation {
  id: number;
  price: string;
  regular_price: string;
  attributes: Array<{ name: string; option: string }>;
  description: string;
  stock_quantity: number | null;
}

interface SyncResult {
  synced: number;
  updated: number;
  errors: number;
  unmatched_wc: string[];
  unmatched_crm: string[];
  changes: Array<{
    product_name: string;
    field: string;
    old_value: string;
    new_value: string;
  }>;
}

interface Presentacion {
  cantidad: number;
  precio: number;
  sku?: string;
  wc_variation_id?: number;
}

// ─────────────────────────────────────────────
// WC API Client
// ─────────────────────────────────────────────

async function wcApiRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const wcUrl = process.env.WC_URL || 'https://tst.amunet.com.mx';
  const wcKey = process.env.WC_KEY;
  const wcSecret = process.env.WC_SECRET;

  if (!wcKey || !wcSecret) {
    throw new Error('WC_KEY and WC_SECRET environment variables required');
  }

  const url = new URL(`/wp-json/wc/v3/${endpoint}`, wcUrl);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const authHeader = 'Basic ' + Buffer.from(`${wcKey}:${wcSecret}`).toString('base64');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`WC API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ─────────────────────────────────────────────
// Fetch all WC products (paginated)
// ─────────────────────────────────────────────

async function fetchAllWCProducts(): Promise<WCProduct[]> {
  const allProducts: WCProduct[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const products = await wcApiRequest('products', {
      per_page: String(perPage),
      page: String(page),
      status: 'publish'
    });

    if (!products || products.length === 0) break;
    allProducts.push(...products);

    if (products.length < perPage) break;
    page++;
  }

  return allProducts;
}

// ─────────────────────────────────────────────
// Fetch variations for a product
// ─────────────────────────────────────────────

async function fetchVariations(productId: number): Promise<WCVariation[]> {
  try {
    return await wcApiRequest(`products/${productId}/variations`, {
      per_page: '100'
    });
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// Parse WC product into presentaciones
// ─────────────────────────────────────────────

function parseWCPresentaciones(product: WCProduct, variations: WCVariation[]): Presentacion[] {
  if (variations.length === 0) {
    // Simple product — single presentación
    const price = parseFloat(product.price);
    if (isNaN(price)) return [];
    return [{ cantidad: 1, precio: price }];
  }

  // Variable product — each variation is a presentación
  return variations.map(v => {
    const price = parseFloat(v.price || v.regular_price);
    // Try to extract quantity from attributes or description
    let cantidad = 1;
    for (const attr of v.attributes) {
      const match = attr.option.match(/(\d+)\s*(pruebas?|piezas?|tiras?|unidades?)/i);
      if (match) {
        cantidad = parseInt(match[1]);
      }
    }
    // Also try description
    if (cantidad === 1 && v.description) {
      const descMatch = v.description.match(/(\d+)\s*(pruebas?|piezas?|tiras?|unidades?)/i);
      if (descMatch) cantidad = parseInt(descMatch[1]);
    }

    return {
      cantidad,
      precio: isNaN(price) ? 0 : price,
      wc_variation_id: v.id
    };
  }).filter(p => p.precio > 0);
}

// ─────────────────────────────────────────────
// Main sync function
// ─────────────────────────────────────────────

export async function syncWCPrices(): Promise<SyncResult> {
  const result: SyncResult = {
    synced: 0,
    updated: 0,
    errors: 0,
    unmatched_wc: [],
    unmatched_crm: [],
    changes: []
  };

  console.log('[WC Sync] Starting price synchronization...');

  // 1. Fetch all CRM products
  const crmProducts = await db.query(`
    SELECT id, name, wc_product_id, url_tienda, precio_publico, presentaciones, wc_last_sync
    FROM medical_products
    WHERE is_active = TRUE
  `);

  // Build lookup maps
  const byWcId = new Map<number, any>();
  const byUrl = new Map<string, any>();
  for (const p of crmProducts.rows) {
    if (p.wc_product_id) byWcId.set(p.wc_product_id, p);
    if (p.url_tienda) {
      // Normalize URL for matching
      const slug = p.url_tienda.replace(/https?:\/\/[^/]+\/tienda\//, '').replace(/\/$/, '');
      byUrl.set(slug, p);
    }
  }

  // 2. Fetch all WC products
  let wcProducts: WCProduct[];
  try {
    wcProducts = await fetchAllWCProducts();
    console.log(`[WC Sync] Fetched ${wcProducts.length} WC products`);
  } catch (err: any) {
    console.error(`[WC Sync] Failed to fetch WC products: ${err.message}`);
    result.errors++;
    return result;
  }

  // 3. Match and sync each WC product
  for (const wc of wcProducts) {
    let crmProduct = byWcId.get(wc.id);

    // Try URL matching if no wc_product_id match
    if (!crmProduct) {
      const slug = wc.permalink.replace(/https?:\/\/[^/]+\/tienda\//, '').replace(/\/$/, '');
      crmProduct = byUrl.get(slug);
    }

    if (!crmProduct) {
      result.unmatched_wc.push(`${wc.name} (WC#${wc.id})`);
      continue;
    }

    result.synced++;

    // Fetch variations
    const variations = wc.variations.length > 0 ? await fetchVariations(wc.id) : [];
    const newPresentaciones = parseWCPresentaciones(wc, variations);
    const newPrecio = parseFloat(wc.price) || null;

    // Compare and update
    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    // Check precio_publico
    if (newPrecio && newPrecio !== parseFloat(crmProduct.precio_publico)) {
      result.changes.push({
        product_name: crmProduct.name,
        field: 'precio_publico',
        old_value: String(crmProduct.precio_publico || 'NULL'),
        new_value: String(newPrecio)
      });
      updates.push(`precio_publico = $${paramIdx++}`);
      params.push(newPrecio);

      // Log the change
      await db.query(`
        INSERT INTO wc_price_sync_log (medical_product_id, wc_product_id, field_changed, old_value, new_value)
        VALUES ($1, $2, 'precio_publico', $3, $4)
      `, [crmProduct.id, wc.id, String(crmProduct.precio_publico || ''), String(newPrecio)]);
    }

    // Check presentaciones
    const oldPres = JSON.stringify(crmProduct.presentaciones || []);
    const newPres = JSON.stringify(newPresentaciones);
    if (newPresentaciones.length > 0 && oldPres !== newPres) {
      result.changes.push({
        product_name: crmProduct.name,
        field: 'presentaciones',
        old_value: oldPres.substring(0, 100),
        new_value: newPres.substring(0, 100)
      });
      updates.push(`presentaciones = $${paramIdx++}`);
      params.push(JSON.stringify(newPresentaciones));

      await db.query(`
        INSERT INTO wc_price_sync_log (medical_product_id, wc_product_id, field_changed, old_value, new_value)
        VALUES ($1, $2, 'presentaciones', $3, $4)
      `, [crmProduct.id, wc.id, oldPres.substring(0, 500), newPres.substring(0, 500)]);
    }

    // Update wc_product_id if not set
    if (!crmProduct.wc_product_id) {
      updates.push(`wc_product_id = $${paramIdx++}`);
      params.push(wc.id);
    }

    // Update wc_variation_ids
    if (variations.length > 0) {
      updates.push(`wc_variation_ids = $${paramIdx++}`);
      params.push(variations.map(v => v.id));
    }

    // Always update sync timestamp
    updates.push(`wc_last_sync = NOW()`);
    updates.push(`updated_at = NOW()`);

    if (updates.length > 0) {
      params.push(crmProduct.id);
      await db.query(`
        UPDATE medical_products SET ${updates.join(', ')}
        WHERE id = $${paramIdx}
      `, params);

      if (updates.some(u => u.startsWith('precio_publico') || u.startsWith('presentaciones'))) {
        result.updated++;
      }
    }
  }

  // 4. Find CRM products with no WC match
  for (const crm of crmProducts.rows) {
    if (!crm.wc_product_id) {
      const slug = crm.url_tienda?.replace(/https?:\/\/[^/]+\/tienda\//, '').replace(/\/$/, '');
      const matched = wcProducts.some(wc => {
        const wcSlug = wc.permalink.replace(/https?:\/\/[^/]+\/tienda\//, '').replace(/\/$/, '');
        return wc.id === crm.wc_product_id || wcSlug === slug;
      });
      if (!matched) {
        result.unmatched_crm.push(`${crm.name} (CRM#${crm.id})`);
      }
    }
  }

  console.log(`[WC Sync] Done: ${result.synced} synced, ${result.updated} updated, ${result.errors} errors`);
  console.log(`[WC Sync] Unmatched WC: ${result.unmatched_wc.length}, Unmatched CRM: ${result.unmatched_crm.length}`);

  return result;
}

// ─────────────────────────────────────────────
// Webhook handler for product.updated
// ─────────────────────────────────────────────

export async function handleWCProductWebhook(payload: any): Promise<void> {
  const wcId = payload.id;
  if (!wcId) return;

  console.log(`[WC Webhook] Product updated: WC#${wcId}`);

  // Find matching CRM product
  const match = await db.query(
    'SELECT id, name FROM medical_products WHERE wc_product_id = $1',
    [wcId]
  );

  if (match.rows.length === 0) {
    console.log(`[WC Webhook] No CRM match for WC#${wcId}`);
    return;
  }

  // Trigger sync for this specific product
  await syncWCPrices();
}

// ─────────────────────────────────────────────
// Scheduled sync (call from a cron/BullMQ job)
// ─────────────────────────────────────────────

export async function scheduledPriceSync(): Promise<void> {
  try {
    const result = await syncWCPrices();
    console.log(`[Scheduled Sync] ${JSON.stringify({
      synced: result.synced,
      updated: result.updated,
      errors: result.errors,
      changes: result.changes.length
    })}`);
  } catch (err: any) {
    console.error(`[Scheduled Sync] Error: ${err.message}`);
  }
}
