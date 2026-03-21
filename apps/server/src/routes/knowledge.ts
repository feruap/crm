import { Router, Request, Response } from 'express';
import { db } from '../db';
import { generateEmbedding } from '../ai.service';
import axios from 'axios';

const router = Router();

// GET /api/knowledge
router.get('/', async (req: Request, res: Response) => {
    try {
        const { search, type } = req.query;
        let query = `SELECT id, question, answer, confidence_score, use_count, metadata, created_at, updated_at FROM knowledge_base`;
        const conditions: string[] = [];
        const params: any[] = [];

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(question ILIKE $${params.length} OR answer ILIKE $${params.length})`);
        }
        if (type) {
            params.push(type);
            conditions.push(`metadata->>'type' = $${params.length}`);
        }

        if (conditions.length > 0) query += ` WHERE ` + conditions.join(' AND ');
        query += ` ORDER BY created_at DESC LIMIT 200`;
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('KB fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch knowledge base' });
    }
});

// POST /api/knowledge
router.post('/', async (req: Request, res: Response) => {
    const { question, answer, metadata } = req.body;

    if (!question || !answer) {
        res.status(400).json({ error: 'Question and answer required' });
        return;
    }

    try {
        const settings = await db.query(`SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
        if (settings.rows.length === 0) throw new Error('AI not configured');
        const { provider, api_key_encrypted } = settings.rows[0];

        const embedding = await generateEmbedding(question, provider, api_key_encrypted);
        const vectorLiteral = `[${embedding.join(',')}]`;

        const result = await db.query(
            `INSERT INTO knowledge_base (question, answer, embedding, metadata, confidence_score)
             VALUES ($1, $2, $3::vector, $4, $5) RETURNING id`,
            [question, answer, vectorLiteral, JSON.stringify(metadata || {}), 1.0]
        );

        res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
        console.error('KB create error:', err);
        res.status(500).json({ error: 'Failed to create entry' });
    }
});

// PATCH /api/knowledge/:id — update answer, metadata (upsells, cross-sells, custom info)
router.patch('/:id', async (req: Request, res: Response) => {
    const { answer, metadata } = req.body;
    try {
        const fields: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (answer !== undefined) {
            fields.push(`answer = $${idx++}`);
            params.push(answer);

            // Re-generate embedding when answer changes
            try {
                const settings = await db.query(`SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
                if (settings.rows.length > 0) {
                    const { provider, api_key_encrypted } = settings.rows[0];
                    const existing = await db.query(`SELECT question FROM knowledge_base WHERE id = $1`, [req.params.id]);
                    if (existing.rows.length > 0) {
                        const embedding = await generateEmbedding(existing.rows[0].question + ' ' + answer, provider, api_key_encrypted);
                        const vectorLiteral = `[${embedding.join(',')}]`;
                        fields.push(`embedding = $${idx++}::vector`);
                        params.push(vectorLiteral);
                    }
                }
            } catch (embErr) {
                console.warn('[KB PATCH] Embedding update failed, saving without:', embErr);
            }
        }
        if (metadata !== undefined) {
            fields.push(`metadata = $${idx++}`);
            params.push(JSON.stringify(metadata));
        }

        if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

        fields.push(`updated_at = NOW()`);
        params.push(req.params.id);
        await db.query(`UPDATE knowledge_base SET ${fields.join(', ')} WHERE id = $${idx}`, params);
        res.json({ ok: true });
    } catch (err) {
        console.error('KB update error:', err);
        res.status(500).json({ error: 'Failed to update' });
    }
});

// DELETE /api/knowledge/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await db.query(`DELETE FROM knowledge_base WHERE id = $1`, [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// POST /api/knowledge/sync-wc — Sync ALL WooCommerce products with upsells & cross-sells
router.post('/sync-wc', async (req: Request, res: Response) => {
    try {
        const wcUrl = process.env.WC_URL;
        const wcKey = process.env.WC_KEY;
        const wcSecret = process.env.WC_SECRET;

        if (!wcUrl || !wcKey || !wcSecret) {
            res.status(400).json({ error: 'WC_URL, WC_KEY, WC_SECRET env vars required' });
            return;
        }

        const settings = await db.query(`SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
        if (settings.rows.length === 0) throw new Error('AI not configured');
        const { provider, api_key_encrypted } = settings.rows[0];

        // Fetch ALL products (paginated)
        let page = 1;
        let allProducts: any[] = [];
        while (true) {
            const wcRes = await axios.get(`${wcUrl}/wp-json/wc/v3/products`, {
                auth: { username: wcKey, password: wcSecret },
                params: { per_page: 100, page, status: 'publish' }
            });
            allProducts = allProducts.concat(wcRes.data);
            if (wcRes.data.length < 100) break;
            page++;
        }

        // Build product name lookup for upsell/cross-sell resolution
        const productMap = new Map(allProducts.map((p: any) => [p.id, p.name]));

        let syncedCount = 0;
        let updatedCount = 0;

        for (const p of allProducts) {
            const cats = (p.categories || []).map((c: any) => c.name).join(', ');
            const tags = (p.tags || []).map((t: any) => t.name).join(', ');
            const upsellNames = (p.upsell_ids || []).map((id: number) => productMap.get(id) || `ID:${id}`);
            const crossSellNames = (p.cross_sell_ids || []).map((id: number) => productMap.get(id) || `ID:${id}`);
            const imageUrl = p.images?.[0]?.src || '';

            const question = `¿Qué es ${p.name}?`;
            const desc = (p.short_description || p.description || '').replace(/<[^>]*>/g, '').trim();
            const answer = `${p.name} ($${p.price} MXN). Categoría: ${cats}. ${desc}${
                upsellNames.length > 0 ? ` Upsells: ${upsellNames.join(', ')}.` : ''
            }${crossSellNames.length > 0 ? ` Cross-sells: ${crossSellNames.join(', ')}.` : ''}`;

            const meta = {
                type: 'product',
                wc_id: p.id,
                sku: p.sku || '',
                price: p.price,
                regular_price: p.regular_price,
                sale_price: p.sale_price,
                categories: cats,
                tags,
                image_url: imageUrl,
                upsell_ids: p.upsell_ids || [],
                upsell_names: upsellNames,
                cross_sell_ids: p.cross_sell_ids || [],
                cross_sell_names: crossSellNames,
                stock_status: p.stock_status,
                custom_info: '', // editable by user in CRM
            };

            // Check if already exists
            const exists = await db.query(`SELECT id, metadata FROM knowledge_base WHERE metadata->>'wc_id' = $1`, [p.id.toString()]);

            if (exists.rows.length > 0) {
                // Update existing — preserve custom_info the user may have edited
                const existingMeta = exists.rows[0].metadata || {};
                meta.custom_info = existingMeta.custom_info || '';

                await db.query(
                    `UPDATE knowledge_base SET question = $1, answer = $2, metadata = $3, updated_at = NOW() WHERE id = $4`,
                    [question, answer, JSON.stringify(meta), exists.rows[0].id]
                );
                updatedCount++;
            } else {
                // Insert new
                let vectorLiteral = null;
                try {
                    const embedding = await generateEmbedding(p.name + ' ' + cats + ' ' + desc, provider, api_key_encrypted);
                    vectorLiteral = `[${embedding.join(',')}]`;
                } catch (embErr) {
                    console.warn(`[KB Sync] Embedding failed for ${p.name}, inserting without vector`);
                }

                await db.query(
                    `INSERT INTO knowledge_base (question, answer, embedding, metadata, confidence_score)
                     VALUES ($1, $2, ${vectorLiteral ? '$3::vector' : 'NULL'}, $${vectorLiteral ? 4 : 3}, 0.95)`,
                    vectorLiteral
                        ? [question, answer, vectorLiteral, JSON.stringify(meta)]
                        : [question, answer, JSON.stringify(meta)]
                );
                syncedCount++;
            }
        }

        res.json({ ok: true, synced: syncedCount, updated: updatedCount, total: allProducts.length });
    } catch (err: any) {
        console.error('KB sync error:', err);
        res.status(500).json({ error: 'Failed to sync with WooCommerce', details: err.message });
    }
});

export default router;
