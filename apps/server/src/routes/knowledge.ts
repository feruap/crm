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
router.post('/', async (req: Request, res: Response) => {    const { question, answer, metadata } = req.body;

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

// GET /api/knowledge/stats
router.get('/stats', async (_req: Request, res: Response) => {
    try {
        const [
            totalEntries,
            sourceBreakdown,
            embeddingStats,
            chunksCount,
            gapsCount,
            topUsed,
            recentSync
        ] = await Promise.all([
            db.query(`SELECT COUNT(*)::int as total FROM knowledge_base`),
            db.query(`SELECT COALESCE(metadata->>'source', 'manual') as source, COUNT(*)::int as count FROM knowledge_base GROUP BY source ORDER BY count DESC`),
            db.query(`SELECT COUNT(*)::int as total, COUNT(CASE WHEN embedding IS NOT NULL AND embedding != '[${new Array(1536).fill(0).join(',')}]'::vector THEN 1 END)::int as with_embedding FROM knowledge_base`),
            db.query(`SELECT COUNT(*)::int as total FROM medical_knowledge_chunks`).catch(() => ({ rows: [{ total: 0 }] })),
            db.query(`SELECT COUNT(*)::int as total, COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending FROM knowledge_gaps`).catch(() => ({ rows: [{ total: 0, pending: 0 }] })),
            db.query(`SELECT question, use_count, confidence_score FROM knowledge_base WHERE use_count > 0 ORDER BY use_count DESC LIMIT 10`),
            db.query(`SELECT MAX(created_at) as last_sync FROM knowledge_base WHERE metadata->>'source' IN ('medical', 'labs')`)
        ]);

        // Check if Gemini API key is configured
        const geminiEnv = !!process.env.GEMINI_API_KEY;
        const geminiDb = await db.query(`SELECT value FROM settings WHERE key = 'gemini_api_key' LIMIT 1`);
        const geminiConfigured = geminiEnv || !!geminiDb.rows[0]?.value;

        res.json({
            total_entries: totalEntries.rows[0]?.total || 0,
            sources: sourceBreakdown.rows,
            embeddings: {
                total: embeddingStats.rows[0]?.total || 0,
                with_real_embedding: embeddingStats.rows[0]?.with_embedding || 0,
                zero_vectors: (embeddingStats.rows[0]?.total || 0) - (embeddingStats.rows[0]?.with_embedding || 0),
            },
            medical_chunks: chunksCount.rows[0]?.total || 0,
            knowledge_gaps: {
                total: gapsCount.rows[0]?.total || 0,
                pending: gapsCount.rows[0]?.pending || 0,
            },
            top_used: topUsed.rows,
            last_md_sync: recentSync.rows[0]?.last_sync || null,
            gemini_configured: geminiConfigured,
        });
    } catch (err) {
        console.error('KB stats error:', err);
        res.status(500).json({ error: 'Failed to fetch KB stats' });
    }
});

// GET /api/knowledge/gaps
router.get('/gaps', async (req: Request, res: Response) => {
    try {
        const { status } = req.query;
        let query = `SELECT kg.*, c.name as customer_name
                     FROM knowledge_gaps kg
                     LEFT JOIN customers c ON c.id = kg.customer_id`;
        const params: any[] = [];
        if (status) {
            query += ` WHERE kg.status = $1`;
            params.push(status);
        }
        query += ` ORDER BY kg.frequency DESC, kg.created_at DESC LIMIT 50`;
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('KB gaps error:', err);
        res.status(500).json({ error: 'Failed to fetch knowledge gaps' });
    }
});

// POST /api/knowledge/gaps/:id/resolve
router.post('/gaps/:id/resolve', async (req: Request, res: Response) => {
    try {
        const { answer, admin_notes } = req.body;
        const gap = await db.query(`SELECT * FROM knowledge_gaps WHERE id = $1`, [req.params.id]);
        if (gap.rows.length === 0) { res.status(404).json({ error: 'Gap not found' }); return; }

        // Mark gap as resolved
        await db.query(
            `UPDATE knowledge_gaps SET status = 'resolved', resolved_answer = $1, admin_notes = $2, updated_at = NOW() WHERE id = $3`,
            [answer, admin_notes || '', req.params.id]
        );

        // Auto-create KB entry from the resolved gap
        if (answer) {
            const settings = await db.query(`SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
            const { provider, api_key_encrypted } = settings.rows[0] || {};
            const embedding = provider ? await generateEmbedding(gap.rows[0].question + ' ' + answer, provider, api_key_encrypted) : new Array(1536).fill(0);
            const vectorLiteral = `[${embedding.join(',')}]`;
            await db.query(
                `INSERT INTO knowledge_base (question, answer, embedding, metadata, confidence_score)
                 VALUES ($1, $2, $3::vector, $4, 1.0)`,
                [gap.rows[0].question, answer, vectorLiteral, JSON.stringify({ source: 'gap_resolution', gap_id: req.params.id })]
            );
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('KB gap resolve error:', err);
        res.status(500).json({ error: 'Failed to resolve gap' });
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

        const wcRes = await axios.get(`${wcUrl}/wp-json/wc/v3/products`, {
            auth: { username: wcKey!, password: wcSecret! },
            params: { per_page: 100 }
        });

        const products = wcRes.data;
        let syncedCount = 0;

        for (const p of products) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/knowledge/sync-md
// Parse MD knowledge base files → generate Q&A pairs → embed → insert into DB
// Body: { medical_md: string, labs_md: string }
// ═══════════════════════════════════════════════════════════════════════════════

interface ParsedProduct {
    name: string;
    url: string;
    category: string;
    tipo: string;
    source: string;
    precio: string;
    precioUnitario: string;
    precioSugerido: string;
    margen: string;
    presentaciones: string;
    analito: string;
    muestra: string;
    tiempo: string;
    sensibilidad: string;
    especificidad: string;
    pitchOracion: string;
    ventajaVsLab: string;
    roi: string;
    proposito: string;
    especialidades: string;
    escenarios: string;
    resultadoPositivo: string;
    resultadoNegativo: string;
    objeciones: { q: string; a: string }[];
    crossSells: string;
    upSells: string;
    keywords: string;
    porqueAgregarlo: string;
    clinico: string;
    pitch: string;
    comercial: string;
    tecnica: string;
}

function extractMDSection(text: string, heading: string): string {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`###?\\s*${escaped}[^\\n]*\\n([\\s\\S]*?)(?=\\n###|\\n##[^#]|$)`);
    const match = text.match(regex);
    return match ? match[1].trim() : '';
}

function parseMDProducts(content: string, source: string): ParsedProduct[] {
    const products: ParsedProduct[] = [];
    const sections = content.split(/\n## /);

    for (let i = 1; i < sections.length; i++) {
        const section = sections[i];
        const lines = section.split('\n');
        const productName = lines[0].trim();
        if (!productName || section.length < 100) continue;

        const extract = (pattern: RegExp): string => {
            const m = section.match(pattern);
            return m ? m[1].trim() : '';
        };

        const product: ParsedProduct = {
            name: productName,
            source,
            url: extract(/URL:\s*(https?:\/\/[^\s]+)/),
            category: extract(/Categoría:\s*(.+)/),
            tipo: extract(/Tipo de producto:\s*(.+)/),
            comercial: extractMDSection(section, 'Información Comercial'),
            tecnica: extractMDSection(section, 'Información Técnica') || extractMDSection(section, 'Datos Técnicos Clave'),
            clinico: extractMDSection(section, 'Uso Clínico'),
            pitch: extractMDSection(section, 'Argumento de Venta') || extractMDSection(section, 'Pitch de Venta'),
            crossSells: extractMDSection(section, 'Cross-sells'),
            upSells: extractMDSection(section, 'Up-sells'),
            keywords: extractMDSection(section, 'Palabras clave'),
            porqueAgregarlo: extractMDSection(section, '¿Por qué agregarlo'),
            precio: extract(/Precio público[^:]*:\s*(.+)/),
            precioUnitario: extract(/Precio por prueba individual:\s*(.+)/i) || extract(/Costo unitario:\s*(.+)/i),
            precioSugerido: extract(/Precio sugerido[^:]*:\s*(.+)/),
            margen: extract(/Margen estimado[^:]*:\s*(.+)/),
            presentaciones: extract(/Presentaciones[^:]*:\s*(.+)/),
            analito: extract(/Analito[^:]*:\s*(.+)/),
            muestra: extract(/Tipo de muestra:\s*(.+)/i) || extract(/Muestra:\s*(.+)/i),
            tiempo: extract(/Tiempo de resultado:\s*(.+)/i) || extract(/Tiempo:\s*(.+)/i),
            sensibilidad: extract(/Sensibilidad:\s*(.+)/),
            especificidad: extract(/Especificidad:\s*(.+)/),
            pitchOracion: extract(/Pitch en una oración:\s*(.+)/),
            ventajaVsLab: extract(/Ventaja competitiva vs laboratorio[^:]*:\s*(.+)/),
            roi: extract(/ROI para el médico:\s*(.+)/),
            proposito: extract(/Propósito clínico:\s*(.+(?:\n(?!-).+)*)/),
            especialidades: extract(/Especialidades médicas[^:]*:\s*(.+)/),
            escenarios: '',
            resultadoPositivo: extract(/Resultado positivo[^:]*:\s*(.+)/),
            resultadoNegativo: extract(/Resultado negativo[^:]*:\s*(.+)/),
            objeciones: [],
        };

        // Extract escenarios
        const escMatch = section.match(/Escenarios de uso:\s*([\s\S]*?)(?=\n- Perfil|\n- Frecuencia|\n###)/);
        if (escMatch) product.escenarios = escMatch[1].trim();

        // Extract objeciones from pitch section
        const objSection = product.pitch || '';
        const objRegex = /[""«]([^""»]+)[""»]\s*:\s*(.+?)(?=\n\s*-\s*[""«]|$|\n###|\n##)/gs;
        let objMatch;
        while ((objMatch = objRegex.exec(objSection)) !== null) {
            product.objeciones.push({ q: objMatch[1].trim(), a: objMatch[2].trim() });
        }

        products.push(product);
    }

    return products;
}

function generateKBEntries(product: ParsedProduct) {
    const entries: { question: string; answer: string; metadata: any }[] = [];
    const name = product.name;
    const meta = (type: string) => ({
        product_name: name,
        category: product.category,
        type,
        source: product.source,
        url: product.url,
    });

    // 1. ¿Qué es?
    let queEs = `${name} es ${product.tipo || 'una prueba rápida de Amunet'}. `;
    if (product.category) queEs += `Categoría: ${product.category}. `;
    if (product.proposito) queEs += product.proposito + ' ';
    if (product.analito) queEs += `Analito: ${product.analito}. `;
    if (product.muestra) queEs += `Muestra: ${product.muestra}. `;
    if (product.tiempo) queEs += `Resultado: ${product.tiempo}. `;
    if (product.sensibilidad) queEs += `Sensibilidad: ${product.sensibilidad}. `;
    if (product.especificidad) queEs += `Especificidad: ${product.especificidad}. `;
    if (product.url) queEs += `URL: ${product.url}`;
    entries.push({ question: `¿Qué es ${name}?`, answer: queEs.trim(), metadata: meta('descripcion') });

    // 2. ¿Cuánto cuesta?
    if (product.precio || product.precioUnitario) {
        let precio = `Precios de ${name}: `;
        if (product.precio) precio += `Precio público (sin IVA): ${product.precio}. `;
        if (product.presentaciones) precio += `Presentaciones: ${product.presentaciones}. `;
        if (product.precioUnitario) precio += `Precio por prueba: ${product.precioUnitario}. `;
        if (product.precioSugerido) precio += `Precio sugerido al paciente: ${product.precioSugerido}. `;
        if (product.margen) precio += `Margen estimado: ${product.margen}. `;
        if (product.url) precio += `Comprar: ${product.url}`;
        entries.push({ question: `¿Cuánto cuesta ${name}?`, answer: precio.trim(), metadata: meta('precio') });
    }

    // 3. ¿Para qué sirve?
    if (product.proposito || product.clinico) {
        let sirve = `${name} sirve para: `;
        if (product.proposito) sirve += product.proposito + ' ';
        if (product.especialidades) sirve += `Especialidades: ${product.especialidades}. `;
        if (product.escenarios) sirve += `Escenarios: ${product.escenarios.substring(0, 500)}. `;
        if (product.url) sirve += `Más info: ${product.url}`;
        entries.push({ question: `¿Para qué sirve ${name}?`, answer: sirve.trim(), metadata: meta('uso_clinico') });
    }

    // 4. ¿Cómo se interpreta?
    if (product.resultadoPositivo || product.resultadoNegativo) {
        let como = `Interpretación de ${name}: `;
        if (product.muestra) como += `Muestra: ${product.muestra}. `;
        if (product.tiempo) como += `Resultado en: ${product.tiempo}. `;
        if (product.resultadoPositivo) como += `Resultado positivo: ${product.resultadoPositivo}. `;
        if (product.resultadoNegativo) como += `Resultado negativo: ${product.resultadoNegativo}. `;
        entries.push({ question: `¿Cómo se usa ${name}? ¿Cómo interpreto los resultados?`, answer: como.trim(), metadata: meta('interpretacion') });
    }

    // 5. Pitch de venta
    if (product.pitchOracion || product.ventajaVsLab || product.roi) {
        let pitch = `Argumento de venta para ${name}: `;
        if (product.pitchOracion) pitch += product.pitchOracion + ' ';
        if (product.ventajaVsLab) pitch += `Ventaja vs laboratorio: ${product.ventajaVsLab}. `;
        if (product.roi) pitch += `ROI: ${product.roi}. `;
        if (product.url) pitch += `Link: ${product.url}`;
        entries.push({ question: `¿Por qué debería comprar ${name}? Argumento de venta.`, answer: pitch.trim(), metadata: meta('pitch_venta') });
    }

    // 6. Lab-specific pitch
    if (product.source === 'labs' && product.porqueAgregarlo) {
        entries.push({
            question: `¿Por qué agregar ${name} al menú del laboratorio?`,
            answer: product.porqueAgregarlo.substring(0, 2000),
            metadata: meta('pitch_laboratorio'),
        });
    }

    // 7. Objeciones
    for (const obj of product.objeciones) {
        entries.push({ question: obj.q, answer: obj.a, metadata: meta('objecion') });
    }

    // 8. Cross-sells
    if (product.crossSells) {
        entries.push({
            question: `¿Qué pruebas complementarias van con ${name}?`,
            answer: product.crossSells.substring(0, 2000),
            metadata: meta('cross_sell'),
        });
    }

    // 9. Keywords entry
    if (product.keywords) {
        entries.push({
            question: product.keywords.replace(/\n/g, ', ').substring(0, 500),
            answer: `${name}: ${product.pitchOracion || product.proposito || ''}. ${product.url || ''}`.trim(),
            metadata: meta('keywords'),
        });
    }

    return entries;
}

router.post('/sync-md', async (req: Request, res: Response) => {
    try {
        const { medical_md, labs_md } = req.body;
        if (!medical_md && !labs_md) {
            res.status(400).json({ error: 'Provide at least one MD file content (medical_md or labs_md)' });
            return;
        }

        // Get AI settings for embedding
        const settings = await db.query(
            `SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`
        );
        if (settings.rows.length === 0) throw new Error('AI not configured');
        const { provider, api_key_encrypted } = settings.rows[0];

        // Use Gemini key for embeddings (DeepSeek/Claude can't do embeddings)
        // Check: 1) env var, 2) settings table, 3) fallback to default provider
        let geminiKey = process.env.GEMINI_API_KEY || '';
        if (!geminiKey) {
            const gRow = await db.query(`SELECT value FROM settings WHERE key = 'gemini_api_key' LIMIT 1`);
            geminiKey = gRow.rows[0]?.value || '';
        }
        const embProvider = geminiKey ? 'gemini' : provider;
        const embKey = geminiKey || api_key_encrypted;

        // Parse products
        const medicalProducts = medical_md ? parseMDProducts(medical_md, 'medical') : [];
        const labProducts = labs_md ? parseMDProducts(labs_md, 'labs') : [];
        const allProducts = [...medicalProducts, ...labProducts];

        // Generate all entries
        let allEntries: { question: string; answer: string; metadata: any }[] = [];
        for (const prod of allProducts) {
            allEntries.push(...generateKBEntries(prod));
        }

        // Load existing products for URL matching
        const existingProducts = await db.query('SELECT id, name, url_tienda FROM medical_products');
        const productUrlMap = new Map<string, { id: number; name: string }>();
        for (const row of existingProducts.rows) {
            if (row.url_tienda) {
                const normalized = row.url_tienda.replace('tst.amunet.com.mx', 'www.amunet.com.mx').replace(/\/$/, '');
                productUrlMap.set(normalized, { id: row.id, name: row.name });
            }
        }

        // Clear only the sources being synced (not both) to allow incremental sync
        const sourcesToDelete: string[] = [];
        const filesToDelete: string[] = [];
        if (medical_md) {
            sourcesToDelete.push('medical');
            filesToDelete.push('amunet_knowledge_base_medicalv3.md');
        }
        if (labs_md) {
            sourcesToDelete.push('labs');
            filesToDelete.push('amunet_knowledge_base_labs.md');
        }
        if (sourcesToDelete.length > 0) {
            await db.query(`DELETE FROM knowledge_base WHERE metadata->>'source' = ANY($1)`, [sourcesToDelete]);
            await db.query(`DELETE FROM medical_knowledge_chunks WHERE source_filename = ANY($1)`, [filesToDelete]);
        }

        let kbInserted = 0;
        let chunkInserted = 0;
        let productUpdated = 0;
        let errors = 0;
        const log: string[] = [];

        // Insert entries with embeddings
        for (let i = 0; i < allEntries.length; i++) {
            const entry = allEntries[i];
            try {
                // Generate embedding
                const embText = (entry.question + ' ' + entry.answer).substring(0, 8000);
                let embVector: number[];
                try {
                    embVector = await generateEmbedding(embText, embProvider as any, embKey);
                } catch {
                    embVector = new Array(1536).fill(0);
                }
                const vectorLiteral = `[${embVector.join(',')}]`;

                // Insert knowledge_base
                await db.query(
                    `INSERT INTO knowledge_base (question, answer, embedding, metadata, confidence_score)
                     VALUES ($1, $2, $3::vector, $4, $5)`,
                    [entry.question, entry.answer, vectorLiteral, JSON.stringify(entry.metadata), 1.0]
                );
                kbInserted++;

                // Insert medical_knowledge_chunks
                const prodUrl = (entry.metadata.url || '').replace(/\/$/, '');
                const matchedProd = productUrlMap.get(prodUrl);

                await db.query(
                    `INSERT INTO medical_knowledge_chunks (medical_product_id, chunk_type, content, source_filename, embedding)
                     VALUES ($1, $2, $3, $4, $5::vector)`,
                    [
                        matchedProd?.id || null,
                        entry.metadata.type,
                        entry.answer.substring(0, 5000),
                        entry.metadata.source === 'labs' ? 'amunet_knowledge_base_labs.md' : 'amunet_knowledge_base_medicalv3.md',
                        vectorLiteral,
                    ]
                );
                chunkInserted++;

                // Rate limit: small pause every 5 entries
                if ((i + 1) % 5 === 0) {
                    await new Promise(r => setTimeout(r, 300));
                }
            } catch (err: any) {
                errors++;
                log.push(`Error [${entry.metadata.product_name}/${entry.metadata.type}]: ${err.message}`);
            }
        }

        // Update medical_products with parsed fields
        for (const prod of allProducts) {
            try {
                const prodUrl = (prod.url || '').replace(/\/$/, '');
                const matched = productUrlMap.get(prodUrl);
                if (!matched) continue;

                const sets: string[] = [];
                const vals: any[] = [];
                let idx = 1;

                const addField = (col: string, val: any) => {
                    if (val) { sets.push(`${col} = $${idx}`); vals.push(val); idx++; }
                };

                addField('pitch_venta', prod.pitchOracion);
                addField('pitch_medico', prod.pitchOracion);
                addField('proposito_clinico', prod.proposito);
                addField('especialidades', prod.especialidades);
                addField('escenarios_uso', prod.escenarios?.substring(0, 2000));
                addField('ventaja_vs_lab', prod.ventajaVsLab);
                addField('ventaja_competitiva', prod.ventajaVsLab);
                addField('roi_medico', prod.roi);
                addField('resultado_positivo', prod.resultadoPositivo);
                addField('resultado_negativo', prod.resultadoNegativo);
                addField('analito', prod.analito);
                addField('volumen_muestra', prod.muestra);
                addField('tipo_producto', prod.tipo);
                addField('result_time', prod.tiempo);

                if (prod.objeciones.length > 0) {
                    const objJson = JSON.stringify(prod.objeciones.map(o => ({ pregunta: o.q, respuesta: o.a })));
                    if (prod.source === 'labs') {
                        addField('objeciones_laboratorio', objJson);
                        addField('pitch_laboratorio', prod.pitchOracion);
                        addField('porque_agregarlo_lab', prod.porqueAgregarlo?.substring(0, 2000));
                    } else {
                        addField('objeciones_medico', objJson);
                    }
                }

                if (sets.length === 0) continue;

                sets.push('updated_at = NOW()');
                vals.push(matched.id);
                await db.query(
                    `UPDATE medical_products SET ${sets.join(', ')} WHERE id = $${idx}`,
                    vals
                );
                productUpdated++;

                // Generate product-level embedding
                try {
                    const prodText = `${prod.name} ${prod.category} ${prod.proposito || ''} ${prod.pitchOracion || ''} ${prod.keywords || ''}`;
                    const prodEmb = await generateEmbedding(prodText.substring(0, 8000), embProvider as any, embKey);
                    await db.query('UPDATE medical_products SET embedding = $1::vector WHERE id = $2', [`[${prodEmb.join(',')}]`, matched.id]);
                } catch { /* skip embedding errors */ }
            } catch (err: any) {
                errors++;
                log.push(`Product update error [${prod.name}]: ${err.message}`);
            }
        }

        res.json({
            success: true,
            products_parsed: allProducts.length,
            medical_products: medicalProducts.length,
            lab_products: labProducts.length,
            kb_entries_inserted: kbInserted,
            chunks_inserted: chunkInserted,
            products_updated: productUpdated,
            errors,
            log: log.slice(0, 20),
        });
    } catch (err: any) {
        console.error('sync-md error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;