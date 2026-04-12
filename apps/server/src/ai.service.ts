import { db } from './db';
import crypto from 'crypto';

export type AIProvider = 'deepseek' | 'z_ai' | 'claude' | 'gemini';

// ─────────────────────────────────────────────
// Generate Z.ai JWT token from App Key
// Format: {appId}.{secret}
// ─────────────────────────────────────────────
function generateZaiJWT(apiKey: string): string {
    const [id, secret] = apiKey.split('.');
    if (!id || !secret) return apiKey; // fallback to raw key

    const base64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const now = Date.now();
    const header = { alg: 'HS256', sign_type: 'SIGN' };
    const payload = { api_key: id, exp: now + 3600 * 1000, timestamp: now };
    const unsigned = base64url(header) + '.' + base64url(payload);
    const sig = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
    return unsigned + '.' + sig;
}

const BOT_CONFIDENCE_THRESHOLD = 0.82;

// Simple in-memory cache for WooCommerce products
let wcProductsCache: any[] | null = null;
let wcProductsCacheTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes (reduced WC fetch frequency)

// ─────────────────────────────────────────────
// Semantic search against knowledge_base
// Returns the best matching answer and its confidence
// ─────────────────────────────────────────────
export interface KnowledgeHit {
    answer: string;
    question: string;
    confidence: number;
    knowledgeId: any;
    metadata: any;
}

export async function findBestAnswer(
    text: string,
    embedding: number[]
): Promise<KnowledgeHit | null> {
    const hits = await findTopKnowledgeHits(text, embedding, 1);
    return hits.length > 0 ? hits[0] : null;
}

/**
 * Return up to `limit` relevant KB entries (semantic + textual fallback).
 * Used to build richer context for the LLM with multiple product matches.
 */
export async function findTopKnowledgeHits(
    text: string,
    embedding: number[],
    limit: number = 3
): Promise<KnowledgeHit[]> {
    const isZeroVector = embedding.every(v => v === 0);
    const vectorLiteral = `[${embedding.join(',')}]`;

    // 1. Semantic search (only if not zero vector) — approved entries only
    let semanticResults: any[] = [];
    if (!isZeroVector) {
        const res = await db.query(
            `SELECT id, question, answer, metadata, 1 - (embedding <=> $1::vector) as confidence
             FROM knowledge_base
             WHERE status = 'approved' AND 1 - (embedding <=> $1::vector) > 0.35
             ORDER BY confidence DESC LIMIT $2`,
            [vectorLiteral, limit]
        );
        semanticResults = res.rows;
    }

    // 2. Textual search (fallback/complement) — approved entries only
    const needed = limit - semanticResults.length;
    let textResults: any[] = [];
    if (needed > 0) {
        const existingIds = semanticResults.map(r => r.id);
        const textRes = await db.query(
            `SELECT id, question, answer, metadata, 0.65 as confidence
             FROM knowledge_base
             WHERE status = 'approved' AND (question ILIKE $1 OR answer ILIKE $1)
             ${existingIds.length > 0 ? `AND id != ALL($3)` : ''}
             LIMIT $2`,
            existingIds.length > 0 ? [`%${text}%`, needed, existingIds] : [`%${text}%`, needed]
        );
        textResults = textRes.rows;
    }

    const combined = [...semanticResults, ...textResults];
    return combined.map(hit => ({
        answer: hit.answer,
        question: hit.question,
        confidence: hit.confidence || 0.5,
        knowledgeId: hit.id,
        metadata: hit.metadata || {}
    }));
}

// ─────────────────────────────────────────────
// Generate embedding via the configured AI provider
// ─────────────────────────────────────────────
// Helper: get Gemini API key from DB first, then env var fallback
async function getGeminiApiKey(): Promise<string | null> {
    try {
        const r = await db.query(`SELECT value FROM settings WHERE key = 'gemini_api_key' LIMIT 1`);
        if (r.rows[0]?.value) return r.rows[0].value;
    } catch { /* ignore */ }
    return process.env.GEMINI_API_KEY || null;
}

// Helper: cascade through available embedding providers; throws if all fail
async function embeddingWithFallback(text: string, preferredProvider: AIProvider, preferredKey: string): Promise<number[]> {
    // 1. Gemini (best quality, 768→1536 padded)
    const gKey = await getGeminiApiKey();
    if (gKey) return generateGeminiEmbedding(text, gKey);

    // 2. Z.ai / Zhipu (if ZAI_API_KEY env var is set)
    const zaiKey = process.env.ZAI_API_KEY;
    if (zaiKey) return generateZaiEmbedding(text, zaiKey);

    // 3. If preferred provider itself can embed (z_ai passed as preferred)
    if (preferredProvider === 'z_ai' && preferredKey) return generateZaiEmbedding(text, preferredKey);

    throw new Error(`No embedding provider available. Set GEMINI_API_KEY or ZAI_API_KEY.`);
}

export async function generateEmbedding(
    text: string,
    provider: AIProvider,
    apiKey: string
): Promise<number[]> {
    switch (provider) {
        case 'gemini':
            return generateGeminiEmbedding(text, apiKey);
        case 'deepseek':
        case 'claude':
            // DeepSeek and Anthropic have no embedding API; delegate to available provider
            return embeddingWithFallback(text, provider, apiKey);
        case 'z_ai':
            // Z.ai/Zhipu — use their embedding API; fall back if it fails
            try {
                return await generateZaiEmbedding(text, apiKey);
            } catch {
                return embeddingWithFallback(text, provider, apiKey);
            }
        default:
            return embeddingWithFallback(text, provider, apiKey);
    }
}

async function generateZaiEmbedding(text: string, apiKey: string): Promise<number[]> {
    // Must throw on failure so callers can cascade to the next provider
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${generateZaiJWT(apiKey)}`,
        },
        body: JSON.stringify({ model: 'text_embedding', input: text }),
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Z.ai Embedding failed: ${res.status} ${txt}`);
    }
    const data: any = await res.json();
    return data.data[0].embedding;
}

async function generateGeminiEmbedding(text: string, apiKey: string): Promise<number[]> {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'models/gemini-embedding-001',
                content: { parts: [{ text }] },
            }),
        }
    );
    if (!res.ok) throw new Error(`Gemini embedding failed: ${res.status}`);
    const data: any = await res.json();
    // gemini-embedding-001 returns 768 dims; pad/truncate to 1536 for pgvector schema
    const values: number[] = data.embedding.values;
    return values.concat(new Array(Math.max(0, 1536 - values.length)).fill(0)).slice(0, 1536);
}

async function generateOpenAICompatibleEmbedding(
    text: string,
    apiKey: string,
    url: string,
    model: string
): Promise<number[]> {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: text }),
    });
    if (!res.ok) throw new Error(`Embedding failed (${model}): ${res.status}`);
    const data: any = await res.json();
    return data.data[0].embedding;
}

// ─────────────────────────────────────────────
// Generate a chat response from the AI provider
// ─────────────────────────────────────────────
export async function getAIResponse(
    provider: AIProvider,
    systemPrompt: string,
    userMessage: string,
    apiKey: string,
    model: string = '',
    customerId?: string,
    knowledgeContext?: string,
    conversationId?: string
): Promise<string> {
    // 0. Fetch customer phone for automatic tracking if possible
    let customerPhone: string | null = null;
    if (customerId) {
        const idRes = await db.query(
            `SELECT provider_id FROM external_identities 
             WHERE customer_id = $1 AND provider = 'whatsapp' LIMIT 1`,
            [customerId]
        );
        if (idRes.rows.length > 0) {
            customerPhone = idRes.rows[0].provider_id.replace('+', '');
        }
    }

    // 0b. Fetch customer name for personalized greeting
    let customerName: string | null = null;
    if (customerId) {
        const nameRes = await db.query(`SELECT display_name FROM customers WHERE id = $1`, [customerId]);
        customerName = nameRes.rows[0]?.display_name || null;
    }

    // 1. Fetch excluded categories from DB
    const settingsRes = await db.query(`SELECT excluded_categories FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
    const excludedCategories = settingsRes.rows[0]?.excluded_categories || ['cortesias'];

    // 2. Fetch and filter catalog
    const catalog = await getCatalogForAI(excludedCategories);

    // 3. Inject catalog and instruction for Order Tracking into system prompt
    let finalSystemPrompt = systemPrompt;

    // Instrucciones de estilo conversacional para WhatsApp
    finalSystemPrompt += `\n\n=== REGLAS DE COMUNICACIÓN (OBLIGATORIO - SIGUE ESTAS REGLAS AL PIE DE LA LETRA) ===
1. MÁXIMO 2 líneas por mensaje. Si necesitas más, manda otro mensaje aparte.
2. Desde el SEGUNDO mensaje ya debes ofrecer productos concretos con precio. No hagas más de 1 pregunta antes de ofrecer algo.
3. Formato de opciones OBLIGATORIO (sin negritas, sin asteriscos):
1. Nombre del producto - $precio/caja
2. Nombre del producto - $precio/caja
4. Después de las opciones, UNA pregunta corta en línea aparte: "¿Cuál le interesa?" o "¿Le envío cotización?"
5. NUNCA uses ** ni negritas. NUNCA hagas párrafos de más de 2 líneas.
6. Responde como un vendedor experto por WhatsApp: corto, directo, cálido.
7. CROSS-SELL: Cuando el cliente confirme interés en un producto, sugiere UN producto complementario del catalogo. Usa la información de cross-sells de la base de conocimiento si está disponible. No inventes productos que no existan en el catalogo.
8. OBJECIONES: Si el cliente duda, usa los argumentos clínicos de la base de conocimiento (sensibilidad, especificidad, certificaciones) para dar confianza. Sé breve.
9. ESCALACIÓN: Cuando el cliente confirme que quiere comprar, hacer un pedido o pedir cotización formal, responde: "Con gusto, te conecto con un asesor para procesar tu pedido." NO intentes generar links de pago ni tomar pedidos directamente.
10. PRECIOS: Solo menciona precios que aparezcan en el catálogo de abajo. Si no tienes el precio, di "te confirmo el precio con un asesor".`;

    // Inject customer name for personalized responses
    if (customerName) {
        finalSystemPrompt += `\n\n=== INFORMACIÓN DEL CLIENTE ===\nEl cliente se llama: ${customerName}. Dirígete a él/ella por su nombre de forma natural y cálida.`;
    }

    if (knowledgeContext) {
        finalSystemPrompt += `\n\n=== CONOCIMIENTO PREVIO RELEVANTE ===\n${knowledgeContext}\nUsa este conocimiento si es relevante para la duda del cliente.`;
    }

    if (customerId && customerPhone && conversationId) {
        const automatedFlowCtx = await getAutomatedFlowInfo(customerId, customerPhone, conversationId);
        if (automatedFlowCtx) {
            finalSystemPrompt += automatedFlowCtx;
        }
    }

    // Always check for campaign-specific instructions (wrapped in try/catch for safety)
    if (customerId && conversationId) {
        try {
            const attrRes = await db.query(
                `SELECT c.name, c.ai_instructions FROM attributions a 
                 JOIN campaigns c ON a.campaign_id = c.id
                 WHERE a.customer_id = $1 AND a.conversation_id = $2 LIMIT 1`,
                [customerId, conversationId]
            );
            if (attrRes.rows.length > 0 && attrRes.rows[0].ai_instructions) {
                finalSystemPrompt += `\n\n=== INSTRUCCIONES ESPECÍFICAS DE LA CAMPAÑA (${attrRes.rows[0].name}) ===\n${attrRes.rows[0].ai_instructions}\nAplica estas instrucciones y reglas en toda tu interacción con este cliente.`;
            }
        } catch (campaignErr) {
            console.warn('Campaign attribution query failed (non-critical):', (campaignErr as any).message);
        }
    }

    finalSystemPrompt += `\n\n=== CAPACIDAD: RASTREO DE PEDIDOS ===\n`;
    finalSystemPrompt += `Si el cliente pregunta por su pedido, paquete o número de guía:\n`;
    finalSystemPrompt += `1. Si NO se ha inyectado información de rastreo más abajo, solicita amablemente su Número de Pedido (ID) o su correo electrónico.\n`;
    finalSystemPrompt += `2. Si ya aparece "INFORMACIÓN DE RASTREO ENCONTRADA" abajo, úsala directamente para informar al cliente sin pedir más datos.\n`;

    // Note: SalesKing agent attribution is handled by the human agent when creating orders in WooCommerce, not by the bot.

    if (catalog.length > 0) {
        finalSystemPrompt += `\n\n=== CATÁLOGO DE PRODUCTOS DISPONIBLES ===\n`;
        finalSystemPrompt += `Tienes acceso al siguiente inventario:\n`;
        catalog.forEach((p: any) => {
            if (p.presentaciones && Array.isArray(p.presentaciones) && p.presentaciones.length > 1) {
                const sizes = p.presentaciones.map((v: any) => `${v.size} ($${v.price})`).join(', ');
                finalSystemPrompt += `- ${p.name} — Disponible en: ${sizes}\n`;
            } else {
                const unitsLabel = p.units_per_box ? ` — Caja con ${p.units_per_box} pruebas` : '';
                finalSystemPrompt += `- ${p.name} (Precio: $${p.price}${unitsLabel})\n`;
            }
        });

        finalSystemPrompt += `\nRECUERDA: Ofrece 2-3 productos relevantes con precio. Máximo 2 líneas por mensaje. Solo menciona productos del catálogo anterior. Cuando el cliente quiera comprar, escálalo a un asesor.\n`;
    }

    // 4. Intent Detection for Tracking (Heuristic/Hardcoded for now as Z.ai doesn't support complex tool calling easily here)
    const lowerMsg = userMessage.toLowerCase();
    const trackingKeywords = ['guía', 'guia', 'rastrear', 'paquete', 'pedido', 'estatus', 'status', 'donde esta', 'dónde está'];
    const hasTrackingIntent = trackingKeywords.some(kw => lowerMsg.includes(kw));

    // Check if there's an ID or Email in the message
    const orderIdMatch = userMessage.match(/#?(\d{4,8})/); // Simple ID match (4-8 digits)
    const emailMatch = userMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

    let trackingQuery: string | null = orderIdMatch ? orderIdMatch[1] : (emailMatch ? emailMatch[0] : null);

    // If no ID/Email but has intent and we have a phone, try phone lookup
    if (hasTrackingIntent && !trackingQuery && customerPhone) {
        trackingQuery = customerPhone;
    }

    if (hasTrackingIntent && trackingQuery) {
        const trackingInfo = await getOrderTracking(trackingQuery);
        // Inject tracking info into the prompt for the AI to "read" and format
        finalSystemPrompt += `\n\n=== INFORMACIÓN DE RASTREO ENCONTRADA ===\n${trackingInfo}\n\nUsa esta información para responder al cliente de forma natural siguiendo tu estilo de ventas.`;
    }

    // Inject conversation history into system prompt for continuity
    if (conversationId) {
        try {
            const histRes = await db.query(
                'SELECT direction, content FROM messages WHERE conversation_id = $1 AND content IS NOT NULL ORDER BY created_at DESC LIMIT 10',
                [conversationId]
            );
            if (histRes.rows.length > 0) {
                const histLines = histRes.rows.reverse().map((m: any) =>
                    (m.direction === 'inbound' ? 'Cliente: ' : 'Tu: ') + m.content
                ).join('\n');
                finalSystemPrompt += '\n\n=== HISTORIAL DE ESTA CONVERSACION ===\n' + histLines + '\n=== FIN HISTORIAL ===\nContinua la conversacion de forma coherente con lo anterior.';
            }
        } catch (e) { /* non-critical */ }
    }

    console.log(`🧠 AI Request: provider=${provider}, model=${model}`);
    switch (provider) {
        case 'deepseek':
            return getOpenAICompatibleResponse(finalSystemPrompt, userMessage, apiKey, model || 'deepseek-chat', 'https://api.deepseek.com/v1/chat/completions');
        case 'claude':
            return getClaudeResponse(finalSystemPrompt, userMessage, apiKey);
        case 'gemini':
            return getGeminiResponse(finalSystemPrompt, userMessage, apiKey);
        case 'z_ai': {
            // Zhipu API key format: AppId.AppSecret → needs JWT
            const zaiModel = model || 'glm-5';
            const hasSecret = apiKey.includes('.');
            const authToken = hasSecret ? generateZaiJWT(apiKey) : apiKey;
            console.log(`🔑 Z.ai: model=${zaiModel}, key_len=${apiKey.length}, hasSecret=${hasSecret}, jwt=${authToken.substring(0, 20)}...`);
            // Try api.z.ai first, then open.bigmodel.cn as fallback
            try {
                return await getOpenAICompatibleResponse(finalSystemPrompt, userMessage, authToken, zaiModel, 'https://api.z.ai/api/paas/v4/chat/completions', 1, 1.0, 4096);
            } catch (e1: any) {
                console.log(`⚠️ api.z.ai failed: ${e1.message}. Trying open.bigmodel.cn...`);
                // Regenerate JWT since timestamp may have shifted
                const authToken2 = hasSecret ? generateZaiJWT(apiKey) : apiKey;
                return getOpenAICompatibleResponse(finalSystemPrompt, userMessage, authToken2, zaiModel, 'https://open.bigmodel.cn/api/paas/v4/chat/completions', 2, 1.0, 4096);
            }
        }
        default:
            throw new Error(`Provider not supported: ${provider}`);
    }
}


async function getOpenAICompatibleResponse(
    systemPrompt: string,
    userMessage: string,
    apiKey: string,
    model: string,
    url: string,
    maxRetries: number = 3,
    temperature: number = 0.7,
    maxTokens: number = 1500
): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
            const waitSec = (attempt + 1) * 2; // 4s, 6s
            console.log(`⏳ Rate limit hit, waiting ${waitSec}s before retry ${attempt + 1}/${maxRetries}...`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
        }
        console.log(`🔑 API call (attempt ${attempt + 1}): model=${model}, url=${url.split('/').pop()}, temp=${temperature}`);
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage },
                    ],
                    temperature: temperature,
                    max_tokens: maxTokens,
                }),
            });
        } catch (fetchErr: any) {
            console.error(`🔴 Network error (attempt ${attempt + 1}): ${fetchErr.message}`);
            if (attempt < maxRetries - 1) continue; // retry on network errors
            throw fetchErr;
        }
        if (res.ok) {
            const data: any = await res.json();
            console.log(`✅ AI response received (attempt ${attempt + 1})`);
            return data.choices[0].message.content;
        }
        let errText = '';
        try { errText = await res.text(); } catch (e) { }
        // Retry on 429 (rate limit)
        if (res.status === 429 && attempt < maxRetries - 1) {
            console.log(`⚠️ Rate limited (429): ${errText}`);
            continue;
        }
        throw new Error(`AI chat failed: ${res.status} ${errText}`);
    }
    throw new Error('AI chat failed: max retries exceeded');
}

async function getClaudeResponse(
    systemPrompt: string,
    userMessage: string,
    apiKey: string
): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1500,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
        }),
    });
    if (!res.ok) throw new Error(`Claude chat failed: ${res.status}`);
    const data: any = await res.json();
    return data.content[0].text;
}

async function getGeminiResponse(
    systemPrompt: string,
    userMessage: string,
    apiKey: string
): Promise<string> {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: 'user', parts: [{ text: userMessage }] }],
                generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
            }),
        }
    );
    if (!res.ok) throw new Error(`Gemini chat failed: ${res.status}`);
    const data: any = await res.json();
    return data.candidates[0].content.parts[0].text;
}

// ─────────────────────────────────────────────
// Learn from a resolved conversation
// Called automatically when a conversation is marked 'resolved'
// ─────────────────────────────────────────────
export async function learnFromConversation(
    conversationId: string,
    provider: AIProvider,
    apiKey: string
): Promise<void> {
    const messages = await db.query(
        `SELECT direction, content FROM messages
         WHERE conversation_id = $1 AND content IS NOT NULL AND handled_by = 'human'
         ORDER BY created_at ASC`,
        [conversationId]
    );

    if (messages.rows.length < 2) return;

    const rows = messages.rows;
    let newPendingCount = 0;

    for (let i = 0; i < rows.length - 1; i++) {
        if (rows[i].direction === 'inbound' && rows[i + 1].direction === 'outbound') {
            const question = rows[i].content as string;
            const answer = rows[i + 1].content as string;

            if (question.length < 5 || answer.length < 5) continue;

            let embeddingLiteral = `[${new Array(1536).fill(0).join(',')}]`;
            try {
                const embedding = await generateEmbedding(question, provider, apiKey);
                embeddingLiteral = `[${embedding.join(',')}]`;
            } catch { /* skip embedding if AI not available */ }

            const result = await db.query(
                `INSERT INTO knowledge_base (question, answer, source_conversation_id, embedding, status)
                 VALUES ($1, $2, $3, $4::vector, 'pending_review')
                 ON CONFLICT DO NOTHING
                 RETURNING id`,
                [question, answer, conversationId, embeddingLiteral]
            );
            if (result.rows.length > 0) newPendingCount++;
        }
    }

    // Notify supervisors/admins via Socket.IO if new entries need review
    if (newPendingCount > 0) {
        try {
            const { getIO } = await import('./socket');
            getIO().emit('kb_pending_review', {
                conversationId,
                count: newPendingCount,
                message: `${newPendingCount} nueva(s) entrada(s) de KB pendiente(s) de revisión`,
            });
        } catch { /* socket may not be initialized yet */ }
    }
}

// ─────────────────────────────────────────────
// Increment use_count when a knowledge entry is used
// ─────────────────────────────────────────────
export async function recordKnowledgeUse(knowledgeId: string): Promise<void> {
    await db.query(
        `UPDATE knowledge_base SET use_count = use_count + 1 WHERE id = $1`,
        [knowledgeId]
    );
}

// ─────────────────────────────────────────────
// Fetch WooCommerce Catalog for AI
// ─────────────────────────────────────────────
function wcAuth() {
    const wcKey = process.env.WC_KEY;
    const wcSecret = process.env.WC_SECRET;
    if (!wcKey || !wcSecret) return null;
    return Buffer.from(`${wcKey}:${wcSecret}`).toString('base64');
}

export async function getCatalogForAI(excludedCategories: string[]): Promise<any[]> {
    const auth = wcAuth();
    if (!auth || !process.env.WC_URL) return [];

    const now = Date.now();
    if (wcProductsCache && (now - wcProductsCacheTime < CACHE_TTL_MS)) {
        return filterCatalog(wcProductsCache, excludedCategories);
    }

    try {
        const response = await fetch(
            `${process.env.WC_URL}/wp-json/wc/v3/products?per_page=100&status=publish`,
            { headers: { Authorization: `Basic ${auth}` } }
        );

        if (!response.ok) return [];

        const raw: any[] = await response.json() as any[];

        wcProductsCache = raw.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            categories: p.categories?.map((c: any) => c.name.toLowerCase()) ?? [],
        }));
        wcProductsCacheTime = now;

        // Augment with units_per_box from medical_products table
        try {
            const wcIds = wcProductsCache.map((p: any) => p.id);
            if (wcIds.length > 0) {
                const mpRes = await db.query(
                    `SELECT wc_product_id, units_per_box, presentaciones FROM medical_products WHERE wc_product_id = ANY($1)`,
                    [wcIds]
                );
                const mpMap: Record<number, any> = {};
                for (const row of mpRes.rows) mpMap[row.wc_product_id] = row;
                wcProductsCache = wcProductsCache.map((p: any) => ({
                    ...p,
                    units_per_box: mpMap[p.id]?.units_per_box ?? null,
                    presentaciones: mpMap[p.id]?.presentaciones ?? null,
                }));
            }
        } catch (e) { /* units_per_box augment is non-critical */ }

        return filterCatalog(wcProductsCache, excludedCategories);
    } catch (err) {
        console.error('Failed to fetch WC catalog for AI:', err);
        // Fallback: return stale cache instead of empty — bot keeps working
        if (wcProductsCache) {
            console.log('[Catalog] Using stale cache as fallback');
            return filterCatalog(wcProductsCache, excludedCategories);
        }
        return [];
    }
}

function filterCatalog(products: any[], excludedCategoriesRaw: string[]): any[] {
    if (!excludedCategoriesRaw || excludedCategoriesRaw.length === 0) return products;

    // Normalize excluded categories to lowercase
    const excluded = excludedCategoriesRaw.map(c => c.toLowerCase().trim());

    return products.filter(p => {
        // If any of the product's categories match any of the excluded categories (partial match or exact)
        const hasExcludedCategory = p.categories.some((cat: string) =>
            excluded.some(ex => cat.includes(ex))
        );
        return !hasExcludedCategory;
    });
}

/**
 * Analyzes customer context to build an automated RAG prompt instruction.
 * Checks for past conversation continuity, recent active WooCommerce orders, and campaign attribution.
 */
export async function getAutomatedFlowInfo(customerId: string, customerPhone: string, conversationId: string): Promise<string | null> {
    try {
        // Enforce continuity: Only run automation rules on the first few messages
        const msgRes = await db.query(
            `SELECT COUNT(*) as exact_count FROM messages WHERE conversation_id = $1`,
            [conversationId]
        );
        if (parseInt(msgRes.rows[0].exact_count, 10) > 2) {
            return null; // Conversation is already started, keep continuity.
        }

        // Fetch active automations from DB
        const autoRes = await db.query(`SELECT * FROM automations WHERE is_active = true ORDER BY id ASC`);
        const automations = autoRes.rows;

        let flowDirectives = '\n\n=== REGLAS STARTUP DE AUTOMATIZACIÓN DE FLUJO ===\n';
        let matchedRules = 0;

        // 1. Check attribution (campaigns)
        const attrRes = await db.query(
            `SELECT c.name, c.metadata FROM attributions a 
             JOIN campaigns c ON a.campaign_id = c.id
             WHERE a.customer_id = $1 AND a.conversation_id = $2 LIMIT 1`,
            [customerId, conversationId]
        );

        let hasAttribution = attrRes.rows.length > 0;
        let campaignData = hasAttribution ? attrRes.rows[0] : null;

        if (hasAttribution) {
            // Find rule for attribution
            const attrRule = automations.find(r => r.conditions?.has_attribution === true);
            const prompt = attrRule?.actions?.prompt || `* ATRIBUCIÓN DETECTADA: El cliente viene de una campaña (Campaña: ${campaignData.name}). Inicia un FLUJO DE VENTAS. Da información sobre el producto de la campaña y luego intentar hacer cross-selling (venta cruzada) o up-selling. Mantén un tono comercial persuaviso.\n`;

            flowDirectives += prompt + `\n(Campaña detectada: ${campaignData.name})\n`;
            matchedRules++;
        }

        // 2. No attribution: check WooCommerce order & fallback to Menu Buttons
        if (!hasAttribution) {
            let activeOrder = null;
            let daysConfigured = 5; // Default

            // Find rule for active orders, to get configured days (if any)
            const orderRule = automations.find(r => r.conditions?.has_attribution === false && r.conditions?.active_order_days > 0);
            if (orderRule) {
                daysConfigured = orderRule.conditions.active_order_days;
            }

            // Try WooCommerce API directly to find orders
            const auth = wcAuth();
            if (auth && process.env.WC_URL && customerPhone) {
                try {
                    const localPhone = customerPhone.length > 10 ? customerPhone.slice(-10) : customerPhone;
                    const url = `${process.env.WC_URL}/wp-json/wc/v3/orders?search=${encodeURIComponent(localPhone)}&per_page=5`;
                    const wcRes = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
                    if (wcRes.ok) {
                        const orders: any[] = await wcRes.json() as any[];
                        const now = new Date();
                        const recentOrder = orders.find(o => {
                            if (o.status !== 'processing' && o.status !== 'completed') return false;
                            const createdDate = new Date(o.date_created);
                            const diffDays = (now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24);
                            return diffDays <= daysConfigured;
                        });

                        if (recentOrder) {
                            activeOrder = recentOrder;
                        }
                    }
                } catch (wcErr) {
                    console.error('WC check active order error:', wcErr);
                }
            }

            if (activeOrder && orderRule) {
                const prompt = orderRule.actions?.prompt || `* PEDIDO ACTIVO: El cliente tiene un pedido reciente (ID: ${activeOrder.id}, Estado: ${activeOrder.status}, Fecha: ${activeOrder.date_created}). Manten un hilo de conversacion sobre su pedido y preguntale si tiene alguna duda sobre el estado de su envío o productos.\n`;
                flowDirectives += prompt + `\n`;
                matchedRules++;
            } else {
                // Default options Flow (No attribution, no recent order)
                const fallbackRule = automations.find(r => r.conditions?.has_attribution === false && (r.conditions?.active_order_days === 0 || !r.conditions?.active_order_days));

                const prompt = fallbackRule?.actions?.prompt || `* FLUJO PRINCIPAL: El cliente NO viene de una campaña y NO tiene pedidos recientes.
Preséntale OBLIGATORIAMENTE un menú con: 
1. Ventas (promociones, última compra), 
2. Envíos (rastreo), 
3. Información Técnica (manuales, videos adaptados).
Debes empezar saludando y ofreciendo inmediatamente estas opciones.\n`;

                flowDirectives += prompt + `\n`;
                matchedRules++;
            }
        }

        return matchedRules > 0 ? flowDirectives : null;

    } catch (err) {
        console.error('getAutomatedFlowInfo error:', err);
        return null;
    }
}

/**
 * Fetches order details from WooCommerce by Order ID or Email
 */
export async function getOrderTracking(query: string): Promise<string> {
    const auth = wcAuth();
    if (!auth || !process.env.WC_URL) return 'Servicio de rastreo no configurado.';

    try {
        let url = `${process.env.WC_URL}/wp-json/wc/v3/orders`;

        // If query is an email
        if (query.includes('@')) {
            url += `?customer=${encodeURIComponent(query)}`;
        }
        // If query is a standard ID (3-5 digits)
        else if (/^\d{3,5}$/.test(query)) {
            url += `/${query}`;
        }
        // If query looks like a phone number (8+ digits)
        else if (/^\d{8,15}$/.test(query)) {
            url += `?search=${encodeURIComponent(query)}`;
        }
        else {
            return "Por favor, proporciona un número de pedido o tu correo electrónico para rastrear tu paquete.";
        }

        const response = await fetch(url, {
            headers: { Authorization: `Basic ${auth}` }
        });

        if (!response.ok) {
            if (response.status === 404) return "No encontramos ningún pedido con esa información.";
            return "Hubo un error al consultar el sistema de pedidos. Por favor intenta más tarde.";
        }

        const data: any = await response.json();

        // Handle list (email query) vs single object (ID query)
        const order = Array.isArray(data) ? data[0] : data;
        if (!order) return "No encontramos pedidos recientes vinculados a esa cuenta.";

        const statusMap: Record<string, string> = {
            'pending': 'Pendiente de pago',
            'processing': 'En preparación / Procesando',
            'on-hold': 'En espera',
            'completed': 'Completado / Enviado',
            'cancelled': 'Cancelado',
            'refunded': 'Reembolsado',
            'failed': 'Fallido'
        };

        const status = statusMap[order.status] || order.status;
        let tracking = 'Aún no asignado';

        // 1. Try common tracking number keys
        const simpleTracking = order.meta_data?.find((m: any) =>
            m.key === '_tracking_number' ||
            m.key === 'shipping_tracking_number'
        );

        if (simpleTracking) {
            tracking = simpleTracking.value;
        } else {
            // 2. Try the official WooCommerce Shipment Tracking plugin format (also used by AST)
            const astTracking = order.meta_data?.find((m: any) => m.key === '_wc_shipment_tracking_items');
            if (astTracking && Array.isArray(astTracking.value) && astTracking.value.length > 0) {
                const item = astTracking.value[0];
                tracking = `${item.tracking_number} (${item.tracking_provider || 'Paquetería'})`;
            }
        }

        return `Pedido #${order.id}\nEstado: ${status}\nNúmero de guía: ${tracking}\nFecha: ${new Date(order.date_created).toLocaleDateString()}`;
    } catch (err) {
        console.error('Failed to fetch order tracking:', err);
        return "Error de conexión con el sistema de mensajería.";
    }
}

/**
 * Find relevant medical context from knowledge chunks using embedding similarity.
 * Used by the smart bot engine for RAG-based medical advisory responses.
 */
export async function findMedicalContext(
    embedding: number[],
    limit: number,
    audienceType: string,
    messageText: string
): Promise<{ context: string | null; products: Array<{ name: string }>; hasGap: boolean }> {
    try {
        const isZeroVector = embedding.every(v => v === 0);
        let chunks: any[] = [];

        if (!isZeroVector) {
            const vectorLiteral = `[${embedding.join(',')}]`;
            const res = await db.query(
                `SELECT mkc.content, mkc.chunk_type, mp.name AS product_name,
                        1 - (mkc.embedding <=> $1::vector) AS similarity
                 FROM medical_knowledge_chunks mkc
                 JOIN medical_products mp ON mp.id = mkc.medical_product_id
                 WHERE mkc.embedding IS NOT NULL
                   AND 1 - (mkc.embedding <=> $1::vector) > 0.35
                 ORDER BY mkc.embedding <=> $1::vector
                 LIMIT $2`,
                [vectorLiteral, limit]
            );
            chunks = res.rows;
        }

        // Keyword fallback if no semantic results
        if (chunks.length === 0 && messageText) {
            const words = messageText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            if (words.length > 0) {
                const res = await db.query(
                    `SELECT mkc.content, mkc.chunk_type, mp.name AS product_name
                     FROM medical_knowledge_chunks mkc
                     JOIN medical_products mp ON mp.id = mkc.medical_product_id
                     WHERE LOWER(mkc.content) LIKE ANY($1::text[])
                     LIMIT $2`,
                    [words.map(w => `%${w}%`), limit]
                );
                chunks = res.rows;
            }
        }

        if (chunks.length === 0) {
            return { context: null, products: [], hasGap: true };
        }

        const context = chunks.map((c: any) => c.content).join('\n\n');
        const products = [...new Map(chunks.map((c: any) => [c.product_name, { name: c.product_name }])).values()];

        return { context, products, hasGap: false };
    } catch (err) {
        console.error('[findMedicalContext error]', err);
        return { context: null, products: [], hasGap: true };
    }
}

