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

const router = Router();

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

export default router;
