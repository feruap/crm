import { db } from './db';
import { buildMedicalPrompt } from './prompts/medical-advisor';
import { getRecommendations, getCustomerProfile, Recommendation } from './services/recommendation-engine';

export type AIProvider = 'deepseek' | 'z_ai' | 'claude' | 'gemini';

const BOT_CONFIDENCE_THRESHOLD = 0.82;

// ─────────────────────────────────────────────
// Semantic search against knowledge_base
// Returns the best matching answer and its confidence
// ─────────────────────────────────────────────
export async function findBestAnswer(
    question: string,
    embedding: number[]
): Promise<{ answer: string; confidence: number; knowledgeId: string } | null> {
    const vectorLiteral = `[${embedding.join(',')}]`;

    const result = await db.query(
        `SELECT id, answer, confidence_score,
                1 - (embedding <=> $1::vector) AS similarity
         FROM knowledge_base
         ORDER BY embedding <=> $1::vector
         LIMIT 1`,
        [vectorLiteral]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const confidence = row.similarity * row.confidence_score;

    if (confidence < BOT_CONFIDENCE_THRESHOLD) return null;

    return {
        answer: row.answer,
        confidence,
        knowledgeId: row.id,
    };
}

// ─────────────────────────────────────────────
// Semantic search against medical knowledge chunks
// Returns relevant chunks from PDF technical sheets
// ─────────────────────────────────────────────
export async function findMedicalContext(
    embedding: number[],
    limit: number = 3,
    audienceType?: 'medico' | 'laboratorio',
    originalQuery?: string
): Promise<{ context: string | null; products: any[]; hasGap: boolean }> {
    let relevantChunks: any[] = [];
    let relevantProducts: any[] = [];

    // Check if embeddings are real (not all zeros)
    const hasRealEmbedding = embedding.some(v => v !== 0);

    if (hasRealEmbedding) {
        const vectorLiteral = `[${embedding.join(',')}]`;

        // Search knowledge chunks (existing RAG)
        try {
            const chunkResult = await db.query(
                `SELECT mkc.content, mkc.chunk_type, mp.name AS product_name,
                        1 - (mkc.embedding <=> $1::vector) AS similarity
                 FROM medical_knowledge_chunks mkc
                 JOIN medical_products mp ON mp.id = mkc.medical_product_id
                 WHERE mkc.embedding IS NOT NULL
                 ORDER BY mkc.embedding <=> $1::vector
                 LIMIT $2`,
                [vectorLiteral, limit]
            );
            relevantChunks = chunkResult.rows.filter((r: any) => r.similarity > 0.3);
        } catch (err) {
            console.warn('[RAG] medical_knowledge_chunks query failed, skipping');
        }

        // Also search product-level embeddings for rich KB data
        try {
            const productResult = await db.query(
                `SELECT id, name, diagnostic_category, analito, result_time,
                        sensitivity, specificity, precio_publico, presentaciones,
                        pitch_medico, pitch_laboratorio, ventaja_vs_lab, roi_medico,
                        porque_agregarlo_lab, objeciones_medico, objeciones_laboratorio,
                        cross_sells, proposito_clinico, escenarios_uso, url_tienda,
                        target_audience,
                        1 - (embedding <=> $1::vector) AS similarity
                 FROM medical_products
                 WHERE is_active = TRUE AND embedding IS NOT NULL
                 ORDER BY embedding <=> $1::vector
                 LIMIT $2`,
                [vectorLiteral, limit]
            );
            relevantProducts = productResult.rows.filter((r: any) => r.similarity > 0.3);
        } catch (err) {
            console.warn('[RAG] product embedding query failed, skipping');
        }
    }

    // ── KEYWORD FALLBACK: If no embeddings found, use text search ──
    if (relevantProducts.length === 0) {
        console.log('[RAG] No embedding matches, using keyword fallback');
        try {
            // Use the original query (or embedding text) to find products via keyword matching
            const queryText = originalQuery || '';
            const queryLower = queryText.toLowerCase();

            // Fetch all active products with KB data
            const allProducts = await db.query(
                `SELECT id, name, diagnostic_category, analito, result_time,
                        sensitivity, specificity, precio_publico, presentaciones,
                        pitch_medico, pitch_laboratorio, ventaja_vs_lab, roi_medico,
                        porque_agregarlo_lab, objeciones_medico, objeciones_laboratorio,
                        proposito_clinico, escenarios_uso, url_tienda,
                        target_audience, palabras_clave, clinical_indications, sample_type
                 FROM medical_products
                 WHERE is_active = TRUE
                   AND (pitch_medico IS NOT NULL OR pitch_laboratorio IS NOT NULL)`
            );

            // Score each product by keyword overlap
            const scored = allProducts.rows.map((p: any) => {
                let score = 0;
                const searchableText = [
                    p.name, p.diagnostic_category, p.analito,
                    p.proposito_clinico, p.clinical_indications,
                    p.target_audience,
                    ...(Array.isArray(p.palabras_clave) ? p.palabras_clave : []),
                ].filter(Boolean).join(' ').toLowerCase();

                // Check keyword matches
                const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);
                for (const word of queryWords) {
                    if (searchableText.includes(word)) score += 1;
                }

                // Boost for specific medical terms
                const medTerms = ['infarto', 'cardíac', 'troponin', 'bnp', 'dímero', 'hba1c', 'diabetes',
                    'covid', 'influenza', 'strep', 'neumococo', 'mycoplasma', 'embarazo', 'ets', 'vih',
                    'sífilis', 'hepatitis', 'pecho', 'corazón', 'respirator', 'pulmon'];
                for (const term of medTerms) {
                    if (queryLower.includes(term) && searchableText.includes(term)) score += 3;
                }

                return { ...p, similarity: score };
            });

            // Sort by score descending and take top matches
            scored.sort((a: any, b: any) => b.similarity - a.similarity);
            relevantProducts = scored.filter((p: any) => p.similarity > 0).slice(0, limit);

            console.log(`[RAG Keyword] Found ${relevantProducts.length} products: ${relevantProducts.map((p: any) => p.name).join(', ')}`);
        } catch (err) {
            console.error('[RAG Keyword] Fallback error:', err);
        }
    }

    // Determine if we have a knowledge gap
    const hasGap = relevantChunks.length === 0 && relevantProducts.length === 0;

    if (hasGap) {
        return { context: null, products: [], hasGap: true };
    }

    // Build context string — audience-aware
    const parts: string[] = [];

    for (const p of relevantProducts) {
        let entry = `## ${p.name} (${p.diagnostic_category})`;
        if (p.analito) entry += `\nAnalito: ${p.analito}`;
        if (p.result_time) entry += `\nTiempo de resultado: ${p.result_time}`;
        if (p.sensitivity) entry += `\nSensibilidad: ${p.sensitivity}%`;
        if (p.specificity) entry += `\nEspecificidad: ${p.specificity}%`;
        if (p.proposito_clinico) entry += `\nPropósito clínico: ${p.proposito_clinico}`;

        // Audience-specific pitch
        if (audienceType === 'laboratorio' && p.pitch_laboratorio) {
            entry += `\n\n**Pitch para laboratorio:** ${p.pitch_laboratorio}`;
            if (p.porque_agregarlo_lab) entry += `\n**Por qué agregarlo:** ${p.porque_agregarlo_lab}`;
            if (p.objeciones_laboratorio && p.objeciones_laboratorio.length > 0) {
                entry += `\n**Objeciones frecuentes:**`;
                for (const obj of p.objeciones_laboratorio) {
                    entry += `\n  - "${obj.pregunta}": ${obj.respuesta}`;
                }
            }
        } else if (p.pitch_medico) {
            entry += `\n\n**Pitch para médico:** ${p.pitch_medico}`;
            if (p.ventaja_vs_lab) entry += `\n**Ventaja vs laboratorio:** ${p.ventaja_vs_lab}`;
            if (p.roi_medico) entry += `\n**ROI:** ${p.roi_medico}`;
            if (p.objeciones_medico && p.objeciones_medico.length > 0) {
                entry += `\n**Objeciones frecuentes:**`;
                for (const obj of p.objeciones_medico) {
                    entry += `\n  - "${obj.pregunta}": ${obj.respuesta}`;
                }
            }
        }

        // Pricing info
        if (p.precio_publico) entry += `\nPrecio desde: $${p.precio_publico} MXN`;
        if (p.presentaciones && p.presentaciones.length > 0) {
            entry += `\nPresentaciones: ${p.presentaciones.map((pr: any) => `Caja con ${pr.cantidad} ($${pr.precio})`).join(', ')}`;
        }

        // Cross-sells
        if (p.cross_sells && p.cross_sells.length > 0) {
            entry += `\nPruebas complementarias: ${p.cross_sells.map((cs: any) => cs.name).join(', ')}`;
        }

        if (p.url_tienda) entry += `\nURL: ${p.url_tienda}`;

        parts.push(entry);
    }

    // Add chunk context
    for (const c of relevantChunks) {
        parts.push(`[${c.product_name} — ${c.chunk_type}]: ${c.content}`);
    }

    return {
        context: parts.join('\n\n') || null,
        products: relevantProducts,
        hasGap
    };
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
        case 'gemini': {
            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'models/text-embedding-004',
                        content: { parts: [{ text }] },
                    }),
                }
            );
            if (!resp.ok) {
                const err = await resp.text();
                throw new Error(`Gemini embedding error ${resp.status}: ${err.substring(0, 200)}`);
            }
            const data: any = await resp.json();
            return data.embedding.values as number[];
        }

        case 'deepseek': {
            // DeepSeek uses an OpenAI-compatible embeddings endpoint
            const resp = await fetch('https://api.deepseek.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ model: 'text-embedding-ada-002', input: text }),
            });
            if (!resp.ok) {
                const err = await resp.text();
                throw new Error(`DeepSeek embedding error ${resp.status}: ${err.substring(0, 200)}`);
            }
            const data: any = await resp.json();
            return data.data[0].embedding as number[];
        }

        case 'z_ai': {
            const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ model: 'embedding-3', input: text }),
            });
            if (!resp.ok) {
                const err = await resp.text();
                throw new Error(`Z.ai embedding error ${resp.status}: ${err.substring(0, 200)}`);
            }
            const data: any = await resp.json();
            return data.data[0].embedding as number[];
        }

        case 'claude':
            // Anthropic does not expose an embeddings API; use gemini or deepseek provider instead
            throw new Error('Claude provider does not support embeddings. Configure gemini or deepseek for RAG.');

        default:
            throw new Error(`Unknown provider for embeddings: ${provider}`);
    }
}

// ─────────────────────────────────────────────
// Generate a chat response from the AI provider
// Delegates to real HTTP API calls (same logic as smart-bot-engine.ts generateAIResponse)
// ─────────────────────────────────────────────
export async function getAIResponse(
    provider: AIProvider,
    systemPrompt: string,
    userMessage: string,
    apiKey: string
): Promise<string> {
    if (provider === 'deepseek') {
        const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
                temperature: 0.7,
                max_tokens: 300,
            }),
        });
        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`DeepSeek API error ${resp.status}: ${err.substring(0, 200)}`);
        }
        const data: any = await resp.json();
        return data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';
    }

    if (provider === 'z_ai') {
        const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'glm-4-flash',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
                temperature: 0.7,
                max_tokens: 300,
            }),
        });
        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Z.ai API error ${resp.status}: ${err.substring(0, 200)}`);
        }
        const data: any = await resp.json();
        return data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';
    }

    if (provider === 'gemini') {
        const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ parts: [{ text: userMessage }] }],
                    generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
                }),
            }
        );
        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Gemini API error ${resp.status}: ${err.substring(0, 200)}`);
        }
        const data: any = await resp.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No pude generar una respuesta.';
    }

    if (provider === 'claude') {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 300,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
            }),
        });
        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Claude API error ${resp.status}: ${err.substring(0, 200)}`);
        }
        const data: any = await resp.json();
        return data.content?.[0]?.text || 'No pude generar una respuesta.';
    }

    throw new Error(`Provider not supported: ${provider}`);
}

// ─────────────────────────────────────────────
// Medical-enhanced bot response
// Combines: knowledge base → medical context → recommendations → AI generation
// ─────────────────────────────────────────────
export async function getMedicalBotResponse(
    conversationId: string,
    customerId: string,
    messageText: string,
    provider: AIProvider,
    apiKey: string,
    baseSystemPrompt: string
): Promise<{ reply: string; confidence: number; botAction: string; recommendations: Recommendation[] }> {
    // 1. Generate embedding for the message
    const embedding = await generateEmbedding(messageText, provider, apiKey);

    // 2. Check general knowledge base first
    const knowledgeHit = await findBestAnswer(messageText, embedding);
    if (knowledgeHit) {
        await recordKnowledgeUse(knowledgeHit.knowledgeId);
        return {
            reply: knowledgeHit.answer,
            confidence: knowledgeHit.confidence,
            botAction: 'knowledge_base',
            recommendations: [],
        };
    }

    // 3. Get medical context from indexed PDFs (with keyword fallback)
    const medicalContext = await findMedicalContext(embedding, 3, undefined, messageText);

    // 4. Get AI-computed recommendations
    const recommendations = await getRecommendations(messageText, customerId, provider, apiKey);

    // 5. Get customer profile for personalization
    const customerProfile = await getCustomerProfile(customerId);

    // 6. Get product catalog for context
    const catalog = await db.query(
        `SELECT name, diagnostic_category AS category, clinical_indications AS indications,
                sensitivity, specificity, result_time, sample_type, methodology
         FROM medical_products WHERE is_active = TRUE
         ORDER BY diagnostic_category, name`
    );

    // 7. Build the full medical system prompt
    const medicalPrompt = buildMedicalPrompt({
        productCatalog: catalog.rows,
        customerProfile,
        recommendations,
        knowledgeContext: medicalContext?.context || undefined,
    });

    // 8. Generate response with full medical context
    const reply = await getAIResponse(provider, medicalPrompt, messageText, apiKey);

    return {
        reply,
        confidence: recommendations.length > 0 ? 0.8 : 0.5,
        botAction: recommendations.length > 0 ? 'medical_recommendation' : 'ai_generated',
        recommendations,
    };
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

            const embedding = await generateEmbedding(question, provider, apiKey);
            const vectorLiteral = `[${embedding.join(',')}]`;

            await db.query(
                `INSERT INTO knowledge_base (question, answer, source_conversation_id, embedding)
                 VALUES ($1, $2, $3, $4::vector)
                 ON CONFLICT DO NOTHING`,
                [question, answer, conversationId, vectorLiteral]
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
