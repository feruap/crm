import { Router, Request, Response } from 'express';
import { db } from '../db';
import { generateEmbedding } from '../ai.service';

const router = Router();

import axios from 'axios';
import * as cheerio from 'cheerio';

const ZERO_VECTOR = `[${new Array(1536).fill(0).join(',')}]`;

// GET /api/bot/knowledge
router.get('/', async (req: Request, res: Response) => {
    const { search } = req.query;
    let query = `SELECT id, question, answer, confidence_score, use_count,
                 source_conversation_id, created_at, metadata
          FROM knowledge_base`;
    const params: any[] = [];

    if (search) {
        query += ` WHERE question ILIKE $1 OR answer ILIKE $1`;
        params.push(`%${search}%`);
    }

    query += ` ORDER BY use_count DESC, created_at DESC LIMIT 100`;
    const result = await db.query(query, params);
    res.json(result.rows);
});

// POST /api/bot/knowledge/sync-wc
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
            // Clean HTML from description
            const cleanDesc = (p.short_description || p.description || '').replace(/<[^>]*>?/gm, '');
            const answer = `${p.name} ($${p.price}). Categoría: ${cats}. Desc: ${cleanDesc.slice(0, 300)}`;

            let embeddingLiteral = ZERO_VECTOR;
            try {
                const embedding = await generateEmbedding(p.name + ' ' + cats, provider, api_key_encrypted);
                embeddingLiteral = `[${embedding.join(',')}]`;
            } catch (err: any) {
                console.warn(`Failed embedding for ${p.name}:`, err.message);
            }

            await db.query(
                `INSERT INTO knowledge_base (question, answer, embedding, metadata, confidence_score)
                 VALUES ($1, $2, $3::vector, $4, $5)`,
                [question, answer, embeddingLiteral, JSON.stringify({ wc_id: p.id, type: 'product', price: p.price }), 0.95]
            );
            syncedCount++;
        }

        res.json({ ok: true, synced: syncedCount });
    } catch (err) {
        console.error('KB sync error:', err);
        res.status(500).json({ error: 'Failed to sync with WooCommerce' });
    }
});

// POST /api/bot/knowledge/scrape
router.post('/scrape', async (req: Request, res: Response) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL required' });

        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        $('script, style, noscript, iframe, img, svg').remove();

        let text = $('body').text().replace(/\s+/g, ' ').trim();
        if (text.length > 3000) text = text.substring(0, 3000); // chunk limit

        const question = `Contenido de: ${url}`;
        const answer = text;

        let embeddingLiteral = ZERO_VECTOR;
        const settings = await db.query(`SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`);

        if (settings.rows.length > 0) {
            const { provider, api_key_encrypted } = settings.rows[0];
            try {
                const embedding = await generateEmbedding(question + ' ' + answer, provider, api_key_encrypted);
                embeddingLiteral = `[${embedding.join(',')}]`;
            } catch (e: any) {
                console.warn('Embedding failed:', e.message);
            }
        }

        const result = await db.query(
            `INSERT INTO knowledge_base (question, answer, embedding, metadata, confidence_score)
             VALUES ($1, $2, $3::vector, $4, $5) RETURNING *`,
            [question, answer, embeddingLiteral, JSON.stringify({ source_url: url, type: 'scraped' }), 0.85]
        );

        res.json({ ok: true, entry: result.rows[0] });
    } catch (err: any) {
        console.error('KB scrape error:', err.message);
        res.status(500).json({ error: 'Failed to scrape URL' });
    }
});

// POST /api/bot/knowledge — manual entry
router.post('/', async (req: Request, res: Response) => {
    const { question, answer } = req.body;
    if (!question?.trim() || !answer?.trim()) {
        res.status(400).json({ error: 'question and answer are required' });
        return;
    }

    let embeddingLiteral = ZERO_VECTOR;
    try {
        const settings = await db.query(
            `SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`
        );
        if (settings.rows.length > 0) {
            const { provider, api_key_encrypted } = settings.rows[0];
            const emb = await generateEmbedding(question.trim(), provider, api_key_encrypted);
            embeddingLiteral = `[${emb.join(',')}]`;
        }
    } catch { /* silently skip if AI not configured */ }

    const result = await db.query(
        `INSERT INTO knowledge_base (question, answer, confidence_score, embedding)
         VALUES ($1, $2, 1.0, $3::vector)
         RETURNING id, question, answer, confidence_score, use_count, source_conversation_id, created_at`,
        [question.trim(), answer.trim(), embeddingLiteral]
    );
    res.status(201).json(result.rows[0]);
});

// PATCH /api/bot/knowledge/:id — update question and/or answer/metadata
router.patch('/:id', async (req: Request, res: Response) => {
    const { question, answer, metadata } = req.body;

    // First, fetch the current metadata if we are updating it, 
    // or just use jsonb_set in PSQL, but doing it in memory is easier here since we don't know if metadata is null
    let metadataUpdate = '';
    let params: any[] = [question ?? null, answer ?? null, req.params.id];

    if (metadata) {
        params.push(JSON.stringify(metadata));
        metadataUpdate = `, metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb`;
    }

    await db.query(
        `UPDATE knowledge_base
         SET question   = COALESCE($1, question),
             answer     = COALESCE($2, answer),
             updated_at = NOW()
             ${metadataUpdate}
         WHERE id = $3`,
        params
    );
    res.json({ ok: true });
});

// DELETE /api/bot/knowledge/:id
router.delete('/:id', async (req: Request, res: Response) => {
    await db.query(`DELETE FROM knowledge_base WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
});

export default router;
