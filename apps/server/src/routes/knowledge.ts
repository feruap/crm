import { Router, Request, Response } from 'express';
import { db } from '../db';
import { generateEmbedding } from '../ai.service';
import axios from 'axios';

const router = Router();

// GET /api/knowledge
router.get('/', async (req: Request, res: Response) => {
    try {
        const { search } = req.query;
        let query = `SELECT id, question, answer, confidence_score, use_count, metadata, created_at FROM knowledge_base`;
        const params: any[] = [];

        if (search) {
            query += ` WHERE question ILIKE $1 OR answer ILIKE $1`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY created_at DESC LIMIT 100`;
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

// DELETE /api/knowledge/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await db.query(`DELETE FROM knowledge_base WHERE id = $1`, [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// POST /api/knowledge/sync-wc
router.post('/sync-wc', async (req: Request, res: Response) => {
    try {
        const wcUrl = process.env.WC_URL;
        const wcKey = process.env.WC_KEY;
        const wcSecret = process.env.WC_SECRET;

        const settings = await db.query(`SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
        if (settings.rows.length === 0) throw new Error('AI not configured');
        const { provider, api_key_encrypted } = settings.rows[0];

        // Fetch products
        const wcRes = await axios.get(`${wcUrl}/wp-json/wc/v3/products`, {
            auth: { username: wcKey!, password: wcSecret! },
            params: { per_page: 100 }
        });

        const products = wcRes.data;
        let syncedCount = 0;

        for (const p of products) {
            // Check if already exists (using metadata or name)
            const exists = await db.query(`SELECT id FROM knowledge_base WHERE metadata->>'wc_id' = $1`, [p.id.toString()]);
            if (exists.rows.length > 0) continue;

            const question = `¿Qué es ${p.name}?`;
            const cats = p.categories.map((c: any) => c.name).join(', ');
            const answer = `${p.name} ($${p.price}). Categoría: ${cats}. Desc: ${p.short_description || p.description || 'Producto de Amunet.'}`;

            const embedding = await generateEmbedding(p.name + ' ' + cats, provider, api_key_encrypted);
            const vectorLiteral = `[${embedding.join(',')}]`;

            await db.query(
                `INSERT INTO knowledge_base (question, answer, embedding, metadata, confidence_score)
                 VALUES ($1, $2, $3::vector, $4, $5)`,
                [question, answer, vectorLiteral, JSON.stringify({ wc_id: p.id, type: 'product', price: p.price }), 0.95]
            );
            syncedCount++;
        }

        res.json({ ok: true, synced: syncedCount });
    } catch (err) {
        console.error('KB sync error:', err);
        res.status(500).json({ error: 'Failed to sync with WooCommerce' });
    }
});

export default router;
