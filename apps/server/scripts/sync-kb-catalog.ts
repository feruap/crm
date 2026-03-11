import { db } from '../src/db';
import { generateEmbedding } from '../src/ai.service';
import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ZERO_VECTOR = `[${new Array(1536).fill(0).join(',')}]`;

async function syncCatalog() {
    try {
        const wcUrl = process.env.WC_URL;
        const wcKey = process.env.WC_KEY;
        const wcSecret = process.env.WC_SECRET;

        const settings = await db.query(`SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
        if (settings.rows.length === 0) throw new Error('AI not configured');
        const { provider, api_key_encrypted } = settings.rows[0];

        console.log('Fetching products from WooCommerce...');
        const wcRes = await axios.get(`${wcUrl}/wp-json/wc/v3/products`, {
            auth: { username: wcKey!, password: wcSecret! },
            params: { per_page: 100 }
        });

        const products = wcRes.data;
        console.log(`Found ${products.length} products. Syncing...`);
        let syncedCount = 0;

        for (const p of products) {
            const exists = await db.query(`SELECT id FROM knowledge_base WHERE metadata->>'wc_id' = $1`, [p.id.toString()]);
            if (exists.rows.length > 0) {
                console.log(`Skipping existing: ${p.name}`);
                continue;
            }

            const question = `¿Qué es ${p.name}?`;
            const cats = p.categories.map((c: any) => c.name).join(', ');
            const cleanDesc = (p.short_description || p.description || '').replace(/<[^>]*>?/gm, '');
            const answer = `${p.name} ($${p.price}). Categoría: ${cats}. Desc: ${cleanDesc.slice(0, 300)}`;

            let embeddingLiteral = ZERO_VECTOR;
            try {
                const embedding = await generateEmbedding(p.name + ' ' + cats, provider as any, api_key_encrypted);
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
            console.log(`Synced (${syncedCount}/${products.length}): ${p.name}`);
        }

        console.log('Sincronización completa.');
    } catch (err: any) {
        console.error('KB sync error:', err.message);
    } finally {
        process.exit(0);
    }
}

syncCatalog();
