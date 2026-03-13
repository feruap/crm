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
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────
// Semantic search against knowledge_base
// Returns the best matching answer and its confidence
// ─────────────────────────────────────────────
export async function findBestAnswer(
    text: string,
    embedding: number[]
): Promise<{ answer: string; question: string; confidence: number; knowledgeId: any; metadata: any } | null> {
    const isZeroVector = embedding.every(v => v === 0);
    const vectorLiteral = `[${embedding.join(',')}]`;

    // 1. Semantic search (only if not zero vector)
    let semanticResult: any[] = [];
    if (!isZeroVector) {
        const res = await db.query(
            `SELECT id, question, answer, metadata, 1 - (embedding <=> $1::vector) as confidence
             FROM knowledge_base
             WHERE 1 - (embedding <=> $1::vector) > 0.4
             ORDER BY confidence DESC LIMIT 1`,
            [vectorLiteral]
        );
        semanticResult = res.rows;
    }

    // 2. Textual search (fallback/combination)
    const textRes = await db.query(
        `SELECT id, question, answer, metadata, 0.85 as confidence
         FROM knowledge_base
         WHERE question ILIKE $1 OR answer ILIKE $1
         LIMIT 1`,
        [`%${text}%`]
    );

    const hit = semanticResult[0] || textRes.rows[0];

    if (hit) {
        return {
            answer: hit.answer,
            question: hit.question,
            confidence: hit.confidence || 0.5,
            knowledgeId: hit.id,
            metadata: hit.metadata || {}
        };
    }

    return null;
}

// ─────────────────────────────────────────────
// Generate embedding via the configured AI provider
// ─────────────────────────────────────────────
export async function generateEmbedding(
    text: string,
    provider: AIProvider,
    apiKey: string
): Promise<number[]> {
    switch (provider) {
        case 'gemini':
            return generateGeminiEmbedding(text, apiKey);
        case 'deepseek':
            return generateOpenAICompatibleEmbedding(
                text, apiKey, 'https://api.deepseek.com/v1/embeddings', 'deepseek-embedding'
            );
        case 'claude':
            // Anthropic does not offer embeddings; use Gemini if key is available
            if (process.env.GEMINI_API_KEY) {
                return generateGeminiEmbedding(text, process.env.GEMINI_API_KEY);
            }
            return new Array(1536).fill(0);
        case 'z_ai':
            // Z.ai/Zhipu does not have a working embedding model — skip API call
            return new Array(1536).fill(0);
        default:
            return new Array(1536).fill(0);
    }
}

async function generateZaiEmbedding(text: string, apiKey: string): Promise<number[]> {
    try {
        const res = await fetch('https://open.bigmodel.cn/api/paas/v4/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${generateZaiJWT(apiKey)}`,
            },
            body: JSON.stringify({
                model: 'text_embedding',
                input: text,
            }),
        });
        if (!res.ok) {
            const txt = await res.text();
            console.error(`Z.ai Embedding failed: ${res.status} ${txt}`);
            return new Array(1536).fill(0);
        }
        const data: any = await res.json();
        return data.data[0].embedding;
    } catch (e) {
        console.error("Z.ai embedding connection failed:", e);
        return new Array(1536).fill(0);
    }
}

async function generateGeminiEmbedding(text: string, apiKey: string): Promise<number[]> {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: { parts: [{ text }] },
            }),
        }
    );
    if (!res.ok) throw new Error(`Gemini embedding failed: ${res.status}`);
    const data: any = await res.json();
    // text-embedding-004 returns 768 dims; pad/truncate to 1536 for pgvector schema
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

    // 1. Fetch excluded categories from DB
    const settingsRes = await db.query(`SELECT excluded_categories FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
    const excludedCategories = settingsRes.rows[0]?.excluded_categories || ['cortesias'];

    // 2. Fetch and filter catalog
    const catalog = await getCatalogForAI(excludedCategories);

    // 3. Inject catalog and instruction for Order Tracking into system prompt
    let finalSystemPrompt = systemPrompt;

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

    // Inject Agent ID for attribution
    const agentId = process.env.WC_AGENT_ID || '9201153';
    finalSystemPrompt += `\n\n=== INFORMACIÓN DEL AGENTE ===\n`;
    finalSystemPrompt += `Tu ID de Agente SalesKing es: ${agentId}.\n`;
    finalSystemPrompt += `Cuando el cliente decida comprar un producto, menciónale que le puedes generar un link de pago o que puede usar tu código de afiliado si compra directamente.\n`;

    if (catalog.length > 0) {
        finalSystemPrompt += `\n\n=== CATÁLOGO DE PRODUCTOS DISPONIBLES ===\n`;
        finalSystemPrompt += `Tienes acceso al siguiente inventario:\n`;
        catalog.forEach((p: any) => {
            finalSystemPrompt += `- ${p.name} (Precio: $${p.price})\n`;
        });

        finalSystemPrompt += `\n REGLAS DE ORO PARA VENTAS (MUY IMPORTANTE):\n`;
        finalSystemPrompt += `1. NUNCA respondas con una lista de viñetas robótica de todo el catálogo.\n`;
        finalSystemPrompt += `2. Compórtate como un asesor médico/técnico humano y persuasivo.\n`;
        finalSystemPrompt += `3. Si el cliente pregunta de forma general ("¿qué pruebas rápidas tienes?"), NO le enlistes todo. Mejor ofrécele 1 o máximo 2 opciones destacadas, descríbele brevemente el beneficio principal y hazle una pregunta descubridora (e.g., "¿Lo necesitas para uso personal o para tu consultorio?").\n`;
        finalSystemPrompt += `4. Mantén la conversación casual, cálida y de pocas líneas. Eres un humano, no un bot dispensador de links.\n`;
        finalSystemPrompt += `5. Solo si el cliente ya está seguro o muestra alta intención de compra, ofrécele generarle el link de pago o usar tu código de afiliado (ID: ${agentId}).\n`;
        finalSystemPrompt += `6. Nunca hables de productos que no estén en la lista anterior.\n`;
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
        const res = await fetch(url, {
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
         WHERE conversation_id = $1 AND content IS NOT NULL
         ORDER BY created_at ASC`,
        [conversationId]
    );

    if (messages.rows.length < 2) return;

    const rows = messages.rows;
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

            await db.query(
                `INSERT INTO knowledge_base (question, answer, source_conversation_id, embedding)
                 VALUES ($1, $2, $3, $4::vector)
                 ON CONFLICT DO NOTHING`,
                [question, answer, conversationId, embeddingLiteral]
            );
        }
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

        return filterCatalog(wcProductsCache, excludedCategories);
    } catch (err) {
        console.error('Failed to fetch WC catalog for AI:', err);
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

