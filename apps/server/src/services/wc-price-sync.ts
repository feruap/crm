/**
 * WooCommerce Price Sync Service
 */

import { db } from '../db';

interface WCSyncResult {
    synced: number;
    updated: number;
    errors: number;
    unmatched_wc: string[];
    unmatched_crm: string[];
    changes: Array<{ product_name: string; field: string; old_value: string; new_value: string }>;
}

async function wcApiRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const wcUrl = process.env.WC_URL || 'https://tst.amunet.com.mx';
    const wcKey = process.env.WC_KEY;
    const wcSecret = process.env.WC_SECRET;
    if (!wcKey || !wcSecret) throw new Error('WC_KEY and WC_SECRET environment variables required');
    const url = new URL(`/wp-json/wc/v3/${endpoint}`, wcUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const authHeader = 'Basic ' + Buffer.from(`${wcKey}:${wcSecret}`).toString('base64');
    const response = await fetch(url.toString(), {
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`WC API error: ${response.status} ${response.statusText}`);
    return response.json();
}

async function fetchAllWCProducts(): Promise<any[]> {
    const all: any[] = [];
    let page = 1;
    while (true) {
        const products = await wcApiRequest('products', { per_page: '100', page: String(page), status: 'publish' });
        if (!products || products.length === 0) break;
        all.push(...products);
        if (products.length < 100) break;
        page++;
    }
    return all;
}

async function fetchVariations(productId: number): Promise<any[]> {
    try { return await wcApiRequest(`products/${productId}/variations`, { per_page: '100' }); }
    catch { return []; }
}

function parseWCPresentaciones(product: any, variations: any[]): any[] {
    if (variations.length === 0) {
        const price = parseFloat(product.price);
        if (isNaN(price)) return [];
        return [{ cantidad: 1, precio: price }];
    }
    return variations.map(v => {
        const price = parseFloat(v.price || v.regular_price);
        let cantidad = 1;
        for (const attr of v.attributes) {
            const match = attr.option.match(/(\d+)\s*(pruebas?|piezas?|tiras?|unidades?)/i);
            if (match) cantidad = parseInt(match[1]);
        }
        if (cantidad === 1 && v.description) {
            const m = v.description.match(/(\d+)\s*(pruebas?|piezas?|tiras?|unidades?)/i);
            if (m) cantidad = parseInt(m[1]);
        }
        return { cantidad, precio: isNaN(price) ? 0 : price, wc_variation_id: v.id };
    }).filter((p: any) => p.precio > 0);
}

export async function syncWCPrices(): Promise<WCSyncResult> {
    const result: WCSyncResult = {
        synced: 0, updated: 0, errors: 0,
        unmatched_wc: [], unmatched_crm: [], changes: [],
    };
    console.log('[WC Sync] Starting price synchronization...');

    const crmProducts = await db.query(`
        SELECT id, name, wc_product_id, url_tienda, precio_publico, presentaciones, wc_last_sync
        FROM medical_products WHERE is_active = TRUE
    `);

    const byWcId = new Map<number, any>();
    const byUrl = new Map<string, any>();
    for (const p of crmProducts.rows) {
        if (p.wc_product_id) byWcId.set(p.wc_product_id, p);
        if (p.url_tienda) {
            const slug = p.url_tienda.replace(/https?:\/\/[^/]+\/tienda\//, '').replace(/\/$/, '');
            byUrl.set(slug, p);
        }
    }

    let wcProducts: any[];
    try {
        wcProducts = await fetchAllWCProducts();
        console.log(`[WC Sync] Fetched ${wcProducts.length} WC products`);
    } catch (err: any) {
        console.error(`[WC Sync] Failed: ${err.message}`);
        result.errors++;
        return result;
    }

    for (const wc of wcProducts) {
        let crmProduct = byWcId.get(wc.id);
        if (!crmProduct) {
            const slug = wc.permalink.replace(/https?:\/\/[^/]+\/tienda\//, '').replace(/\/$/, '');
            crmProduct = byUrl.get(slug);
        }
        if (!crmProduct) { result.unmatched_wc.push(`${wc.name} (WC#${wc.id})`); continue; }

        result.synced++;
        const variations = wc.variations.length > 0 ? await fetchVariations(wc.id) : [];
        const newPresentaciones = parseWCPresentaciones(wc, variations);
        const newPrecio = parseFloat(wc.price) || null;
        const updates: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (newPrecio && newPrecio !== parseFloat(crmProduct.precio_publico)) {
            result.changes.push({ product_name: crmProduct.name, field: 'precio_publico', old_value: String(crmProduct.precio_publico || 'NULL'), new_value: String(newPrecio) });
            updates.push(`precio_publico = $${idx++}`); params.push(newPrecio);
            await db.query(
                `INSERT INTO wc_price_sync_log (medical_product_id, wc_product_id, field_changed, old_value, new_value) VALUES ($1,$2,$3,$4,$5)`,
                [crmProduct.id, wc.id, 'precio_publico', String(crmProduct.precio_publico || ''), String(newPrecio)]
            );
        }

        const oldPres = JSON.stringify(crmProduct.presentaciones || []);
        const newPres = JSON.stringify(newPresentaciones);
        if (newPresentaciones.length > 0 && oldPres !== newPres) {
            result.changes.push({ product_name: crmProduct.name, field: 'presentaciones', old_value: oldPres.substring(0, 100), new_value: newPres.substring(0, 100) });
            updates.push(`presentaciones = $${idx++}`); params.push(JSON.stringify(newPresentaciones));
            await db.query(
                `INSERT INTO wc_price_sync_log (medical_product_id, wc_product_id, field_changed, old_value, new_value) VALUES ($1,$2,$3,$4,$5)`,
                [crmProduct.id, wc.id, 'presentaciones', oldPres.substring(0, 500), newPres.substring(0, 500)]
            );
        }

        if (!crmProduct.wc_product_id) { updates.push(`wc_product_id = $${idx++}`); params.push(wc.id); }
        if (variations.length > 0) { updates.push(`wc_variation_ids = $${idx++}`); params.push(variations.map((v: any) => v.id)); }
        updates.push(`wc_last_sync = NOW()`, `updated_at = NOW()`);
        params.push(crmProduct.id);
        await db.query(`UPDATE medical_products SET ${updates.join(', ')} WHERE id = $${idx}`, params);
        if (updates.some(u => u.startsWith('precio_publico') || u.startsWith('presentaciones'))) result.updated++;
    }

    for (const crm of crmProducts.rows) {
        if (!crm.wc_product_id) {
            const slug = crm.url_tienda?.replace(/https?:\/\/[^/]+\/tienda\//, '').replace(/\/$/, '');
            const matched = wcProducts.some((wc: any) => {
                const wcSlug = wc.permalink.replace(/https?:\/\/[^/]+\/tienda\//, '').replace(/\/$/, '');
                return wc.id === crm.wc_product_id || wcSlug === slug;
            });
            if (!matched) result.unmatched_crm.push(`${crm.name} (CRM#${crm.id})`);
        }
    }

    console.log(`[WC Sync] Done: ${result.synced} synced, ${result.updated} updated, ${result.errors} errors`);
    return result;
}

export async function handleWCProductWebhook(payload: any): Promise<void> {
    if (!payload.id) return;
    const match = await db.query('SELECT id FROM medical_products WHERE wc_product_id = $1', [payload.id]);
    if (match.rows.length === 0) return;
    await syncWCPrices();
}

export async function scheduledPriceSync(): Promise<void> {
    try {
        const r = await syncWCPrices();
        console.log(`[Scheduled Sync] synced=${r.synced} updated=${r.updated} errors=${r.errors}`);
    } catch (err: any) {
        console.error(`[Scheduled Sync] Error: ${err.message}`);
    }
}
