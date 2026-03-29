/**
 * Medical Products Routes
 *
 * CRUD for medical diagnostic test products with clinical data.
 * Includes PDF technical sheet upload and indexing.
 *
 * GET    /api/medical-products                    — List all products
 * GET    /api/medical-products/:id                — Get single product with chunks
 * POST   /api/medical-products                    — Create product
 * PUT    /api/medical-products/:id                — Update product
 * DELETE /api/medical-products/:id                — Delete product
 * POST   /api/medical-products/:id/upload-sheet   — Upload PDF technical sheet
 * POST   /api/medical-products/:id/generate-embedding — Generate product embedding
 * GET    /api/medical-products/:id/recommendations — Get recommendations for a message
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { indexPDFForProduct, generateProductEmbedding } from '../services/pdf-indexer';
import { getRecommendations } from '../services/recommendation-engine';
import { syncWCPrices } from '../services/wc-price-sync';

const router = Router();

// Auto-migrate: add units_per_box column if not present
db.query(`ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS units_per_box INTEGER`)
    .catch((err: any) => console.warn('units_per_box migration:', err.message));

// ─────────────────────────────────────────────
// GET /api/medical-products
// ─────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
    const { category, active_only } = req.query;

    let query = `
        SELECT mp.*,
               (SELECT COUNT(*) FROM medical_knowledge_chunks mkc WHERE mkc.medical_product_id = mp.id) AS chunk_count,
               array_agg(DISTINCT comp.name) FILTER (WHERE comp.name IS NOT NULL) AS complementary_names
        FROM medical_products mp
        LEFT JOIN medical_products comp ON comp.id = ANY(mp.complementary_product_ids)
        WHERE 1=1
    `;
    const params: unknown[] = [];

    if (category) {
        params.push(category);
        query += ` AND mp.diagnostic_category = $${params.length}`;
    }
    if (active_only === 'true') {
        query += ` AND mp.is_active = TRUE`;
    }

    query += ` GROUP BY mp.id ORDER BY mp.diagnostic_category, mp.name`;

    const result = await db.query(query, params);
    res.json(result.rows);
});

// ─────────────────────────────────────────────
// GET /api/medical-products/categories
// ─────────────────────────────────────────────
router.get('/categories', async (_req: Request, res: Response) => {
    const result = await db.query(
        `SELECT diagnostic_category, COUNT(*) AS product_count
         FROM medical_products WHERE is_active = TRUE
         GROUP BY diagnostic_category ORDER BY diagnostic_category`
    );
    res.json(result.rows);
});

// ─────────────────────────────────────────────
// GET /api/medical-products/:id
// ─────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
    const product = await db.query(
        `SELECT * FROM medical_products WHERE id = $1`,
        [req.params.id]
    );

    if (product.rows.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
    }

    // Get associated knowledge chunks
    const chunks = await db.query(
        `SELECT id, chunk_type, content, source_filename, created_at
         FROM medical_knowledge_chunks
         WHERE medical_product_id = $1
         ORDER BY chunk_type, id`,
        [req.params.id]
    );

    // Get complementary product names
    const compIds = product.rows[0].complementary_product_ids || [];
    let complementaryProducts: unknown[] = [];
    if (compIds.length > 0) {
        const comps = await db.query(
            `SELECT id, name, diagnostic_category FROM medical_products WHERE id = ANY($1)`,
            [compIds]
        );
        complementaryProducts = comps.rows;
    }

    res.json({
        ...product.rows[0],
        knowledge_chunks: chunks.rows,
        complementary_products: complementaryProducts,
    });
});

// ─────────────────────────────────────────────
// POST /api/medical-products
// ─────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
    const {
        wc_product_id, name, sku, diagnostic_category,
        clinical_indications, sample_type, sensitivity, specificity,
        result_time, methodology, regulatory_approval,
        complementary_product_ids, recommended_profiles,
        contraindications, interpretation_guide,
        storage_conditions, shelf_life, technical_sheet_url, price_range,
    } = req.body;

    if (!name || !diagnostic_category) {
        res.status(400).json({ error: 'name and diagnostic_category are required' });
        return;
    }

    const result = await db.query(
        `INSERT INTO medical_products
            (wc_product_id, name, sku, diagnostic_category,
             clinical_indications, sample_type, sensitivity, specificity,
             result_time, methodology, regulatory_approval,
             complementary_product_ids, recommended_profiles,
             contraindications, interpretation_guide,
             storage_conditions, shelf_life, technical_sheet_url, price_range)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        [
            wc_product_id, name, sku, diagnostic_category,
            clinical_indications || [], sample_type, sensitivity, specificity,
            result_time, methodology, regulatory_approval,
            complementary_product_ids || [], recommended_profiles || [],
            contraindications, interpretation_guide,
            storage_conditions, shelf_life, technical_sheet_url, price_range,
        ]
    );

    res.status(201).json(result.rows[0]);
});

// ─────────────────────────────────────────────
// PUT /api/medical-products/:id
// ─────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
    const fields = [
        'wc_product_id', 'name', 'sku', 'diagnostic_category',
        'clinical_indications', 'sample_type', 'sensitivity', 'specificity',
        'result_time', 'methodology', 'regulatory_approval',
        'complementary_product_ids', 'recommended_profiles',
        'contraindications', 'interpretation_guide',
        'storage_conditions', 'shelf_life', 'technical_sheet_url', 'price_range', 'is_active',
        'tipo_producto', 'url_tienda', 'marca',
        'precio_publico', 'precio_por_prueba', 'precio_sugerido_paciente', 'margen_estimado', 'presentaciones',
        'units_per_box',
        'analito', 'volumen_muestra', 'punto_corte', 'registro_sanitario',
        'clasificacion_clinica', 'proposito_clinico', 'especialidades', 'escenarios_uso',
        'perfil_paciente', 'frecuencia_uso', 'limitaciones', 'resultado_positivo', 'resultado_negativo',
        'pitch_medico', 'pitch_laboratorio', 'ventaja_vs_lab', 'roi_medico',
        'objeciones_medico', 'objeciones_laboratorio', 'porque_agregarlo_lab',
        'cross_sells', 'up_sells', 'palabras_clave', 'target_audience',
        'wc_last_sync', 'wc_variation_ids',
    ];

    const setClauses: string[] = [];
    const params: unknown[] = [];

    for (const field of fields) {
        if (req.body[field] !== undefined) {
            params.push(req.body[field]);
            setClauses.push(`${field} = $${params.length}`);
        }
    }

    if (setClauses.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
    }

    setClauses.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await db.query(
        `UPDATE medical_products SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
    );

    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
    }
    res.json(result.rows[0]);
});

// ─────────────────────────────────────────────
// DELETE /api/medical-products/:id
// ─────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
    const result = await db.query(
        `DELETE FROM medical_products WHERE id = $1 RETURNING id`,
        [req.params.id]
    );
    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
    }
    res.json({ ok: true, deleted: req.params.id });
});

// ─────────────────────────────────────────────
// POST /api/medical-products/:id/upload-sheet
// Upload and index a PDF technical sheet
// Body: raw PDF binary (Content-Type: application/pdf)
// ─────────────────────────────────────────────
router.post('/:id/upload-sheet', async (req: Request, res: Response) => {
    const productId = Number(req.params.id);

    // Verify product exists
    const product = await db.query(`SELECT id FROM medical_products WHERE id = $1`, [productId]);
    if (product.rows.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
    }

    // Get AI settings for embedding generation
    const settings = await db.query(
        `SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`
    );
    if (settings.rows.length === 0) {
        res.status(500).json({ error: 'AI settings not configured' });
        return;
    }

    const { provider, api_key_encrypted } = settings.rows[0];
    const filename = (req.headers['x-filename'] as string) || `sheet_${productId}.pdf`;

    // Collect the raw body
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', async () => {
        const pdfBuffer = Buffer.concat(chunks);

        if (pdfBuffer.length === 0) {
            res.status(400).json({ error: 'Empty PDF body' });
            return;
        }

        const result = await indexPDFForProduct(productId, pdfBuffer, filename, provider, api_key_encrypted);
        res.json(result);
    });
});

// ─────────────────────────────────────────────
// POST /api/medical-products/:id/generate-embedding
// Generate the product-level embedding
// ─────────────────────────────────────────────
router.post('/:id/generate-embedding', async (req: Request, res: Response) => {
    const productId = Number(req.params.id);

    const settings = await db.query(
        `SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`
    );
    if (settings.rows.length === 0) {
        res.status(500).json({ error: 'AI settings not configured' });
        return;
    }

    const { provider, api_key_encrypted } = settings.rows[0];

    try {
        await generateProductEmbedding(productId, provider, api_key_encrypted);
        res.json({ ok: true, product_id: productId });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// ─────────────────────────────────────────────
// Clinical Decision Rules CRUD
// ─────────────────────────────────────────────

router.get('/decision-rules', async (_req: Request, res: Response) => {
    const result = await db.query(
        `SELECT * FROM clinical_decision_rules ORDER BY priority DESC, name`
    );
    res.json(result.rows);
});

router.post('/decision-rules', async (req: Request, res: Response) => {
    const { name, description, trigger_keywords, recommended_product_ids, recommendation_reason, client_profile_filter, priority } = req.body;

    if (!name || !trigger_keywords || !recommended_product_ids || !recommendation_reason) {
        res.status(400).json({ error: 'name, trigger_keywords, recommended_product_ids, and recommendation_reason are required' });
        return;
    }

    const result = await db.query(
        `INSERT INTO clinical_decision_rules (name, description, trigger_keywords, recommended_product_ids, recommendation_reason, client_profile_filter, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [name, description, trigger_keywords, recommended_product_ids, recommendation_reason, client_profile_filter || null, priority || 0]
    );
    res.status(201).json(result.rows[0]);
});

// ─────────────────────────────────────────────
// POST /api/medical-products/sync-prices
// Trigger WooCommerce price sync manually
// ─────────────────────────────────────────────
router.post('/sync-prices', async (_req: Request, res: Response) => {
    try {
        const result = await syncWCPrices();
        res.json({
            success: true,
            synced: result.synced,
            updated: result.updated,
            errors: result.errors,
            changes: result.changes,
            unmatched_wc: result.unmatched_wc.length,
            unmatched_crm: result.unmatched_crm.length
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/medical-products/sync-products
// Import new products from WooCommerce that don't exist in CRM
// ─────────────────────────────────────────────
router.post('/sync-products', async (_req: Request, res: Response) => {
    try {
        const wcUrl = process.env.WC_URL || 'https://tst.amunet.com.mx';
        const wcKey = process.env.WC_KEY;
        const wcSecret = process.env.WC_SECRET;

        if (!wcKey || !wcSecret) {
            res.status(500).json({ error: 'WC_KEY and WC_SECRET not configured' });
            return;
        }

        const authHeader = 'Basic ' + Buffer.from(`${wcKey}:${wcSecret}`).toString('base64');

        // Fetch all WC products (paginated)
        const allWCProducts: any[] = [];
        let page = 1;
        while (true) {
            const url = new URL(`/wp-json/wc/v3/products`, wcUrl);
            url.searchParams.set('per_page', '100');
            url.searchParams.set('page', String(page));
            url.searchParams.set('status', 'publish');

            const resp = await fetch(url.toString(), {
                headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
            });
            if (!resp.ok) throw new Error(`WC API error: ${resp.status}`);
            const products = await resp.json();
            if (!products || products.length === 0) break;
            allWCProducts.push(...products);
            if (products.length < 100) break;
            page++;
        }

        // Get existing wc_product_ids in CRM
        const existing = await db.query(`SELECT wc_product_id FROM medical_products WHERE wc_product_id IS NOT NULL`);
        const existingIds = new Set(existing.rows.map((r: any) => r.wc_product_id));

        // Import new products
        let imported = 0;
        let skipped = 0;
        const importedNames: string[] = [];

        for (const wc of allWCProducts) {
            if (existingIds.has(wc.id)) {
                skipped++;
                continue;
            }

            // Determine category from WC categories
            const wcCats = (wc.categories || []).map((c: any) => c.name?.toLowerCase() || '');
            let category = 'otros';
            for (const cat of wcCats) {
                if (cat.includes('infeccios') || cat.includes('rapid')) category = 'infecciosas';
                else if (cat.includes('embarazo') || cat.includes('fertil')) category = 'embarazo';
                else if (cat.includes('droga')) category = 'drogas';
                else if (cat.includes('metabol') || cat.includes('diabet')) category = 'metabolicas';
                else if (cat.includes('cardiac') || cat.includes('cardio')) category = 'cardiologicas';
                else if (cat.includes('ets') || cat.includes('sexual')) category = 'ets';
                else if (cat.includes('respirat') || cat.includes('covid') || cat.includes('influenz')) category = 'respiratorias';
                else if (cat.includes('gastro') || cat.includes('h. pylori')) category = 'gastrointestinal';
                else if (cat.includes('oncol') || cat.includes('tumor')) category = 'oncologicas';
                else if (cat.includes('molecular') || cat.includes('pcr')) category = 'molecular';
                else if (cat.includes('equipo')) category = 'equipos';
                else if (cat.includes('consumib')) category = 'consumibles';
            }

            const price = parseFloat(wc.price) || null;

            // Parse units_per_box from product name or short_description
            let units_per_box: number | null = null;
            const searchText = `${wc.name} ${wc.short_description || ''}`;
            const unitsPatterns = [
                /caja\s+con\s+(\d+)\s+prueba/i,
                /(\d+)\s+pruebas?\s*\/\s*caja/i,
                /(\d+)\s+tests?\s*\/\s*box/i,
                /(\d+)\s+pzas?\b/i,
                /(\d+)\s+piezas?\b/i,
                /(\d+)\s+unidades?\b/i,
                /\bx\s*(\d+)\b/i,
                /pack\s+(?:of\s+)?(\d+)/i,
                /(\d+)\s+ct\b/i,
            ];
            for (const pattern of unitsPatterns) {
                const match = searchText.match(pattern);
                if (match) { units_per_box = parseInt(match[1], 10); break; }
            }

            // Fetch variations for variable products
            let presentaciones: any[] | null = null;
            let wc_variation_ids: number[] | null = null;
            if (wc.type === 'variable' && wc.variations?.length > 0) {
                try {
                    const varRes = await fetch(`${wcUrl}/wp-json/wc/v3/products/${wc.id}/variations?per_page=100`, {
                        headers: { Authorization: `Basic ${Buffer.from(`${wcKey}:${wcSecret}`).toString('base64')}` }
                    });
                    if (varRes.ok) {
                        const vars: any[] = await varRes.json();
                        presentaciones = vars.map((v: any) => {
                            const sizeAttr = v.attributes?.find((a: any) => /cantidad|presentacion|size|talla|unidad/i.test(a.name));
                            const sizeLabel = sizeAttr?.option || v.attributes?.[0]?.option || `Variante ${v.id}`;
                            return { size: sizeLabel, price: parseFloat(v.price) || 0, variation_id: v.id };
                        });
                        wc_variation_ids = vars.map((v: any) => v.id);
                    }
                } catch (_) { /* ignore variation fetch errors */ }
            }

            await db.query(`
                INSERT INTO medical_products (
                    wc_product_id, name, sku, diagnostic_category,
                    url_tienda, precio_publico, units_per_box, is_active, wc_last_sync,
                    clinical_indications, recommended_profiles, complementary_product_ids,
                    presentaciones, wc_variation_ids
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), '{}', '{}', '{}', $8, $9)
            `, [wc.id, wc.name, wc.sku || null, category, wc.permalink, price, units_per_box,
                presentaciones ? JSON.stringify(presentaciones) : null,
                wc_variation_ids]);

            imported++;
            importedNames.push(wc.name);
        }

        res.json({
            success: true,
            total_wc: allWCProducts.length,
            imported,
            skipped,
            imported_names: importedNames
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/medical-products/knowledge-gaps
// List unanswered questions for admin
// ─────────────────────────────────────────────
router.get('/knowledge-gaps', async (req: Request, res: Response) => {
    const { status } = req.query;
    let query = `
        SELECT kg.*,
               mp.name as product_name,
               c.display_name as customer_name
        FROM knowledge_gaps kg
        LEFT JOIN medical_products mp ON mp.id = kg.detected_product_id
        LEFT JOIN customers c ON c.id = kg.customer_id
    `;
    const params: unknown[] = [];
    if (status) {
        params.push(status);
        query += ` WHERE kg.status = $1`;
    }
    query += ` ORDER BY kg.frequency DESC, kg.created_at DESC`;
    const result = await db.query(query, params);
    res.json(result.rows);
});

// ─────────────────────────────────────────────
// PUT /api/medical-products/knowledge-gaps/:id
// Resolve a knowledge gap
// ─────────────────────────────────────────────
router.put('/knowledge-gaps/:id', async (req: Request, res: Response) => {
    const { status, admin_notes, resolved_answer, resolved_by } = req.body;
    const result = await db.query(
        `UPDATE knowledge_gaps
         SET status = COALESCE($1, status),
             admin_notes = COALESCE($2, admin_notes),
             resolved_answer = COALESCE($3, resolved_answer),
             resolved_by = COALESCE($4, resolved_by),
             resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [status, admin_notes, resolved_answer, resolved_by, req.params.id]
    );
    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Knowledge gap not found' });
        return;
    }
    res.json(result.rows[0]);
});

// ─────────────────────────────────────────────
// GET /api/medical-products/sync-log
// View price sync history
// ─────────────────────────────────────────────
router.get('/sync-log', async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await db.query(`
        SELECT sl.*, mp.name as product_name
        FROM wc_price_sync_log sl
        LEFT JOIN medical_products mp ON mp.id = sl.medical_product_id
        ORDER BY sl.synced_at DESC
        LIMIT $1
    `, [limit]);
    res.json(result.rows);
});

export default router;
