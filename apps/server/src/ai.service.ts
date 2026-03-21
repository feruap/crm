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
    limit: number = 3
): Promise<string | null> {
    const vectorLiteral = `[${embedding.join(',')}]`;

    const result = await db.query(
        `SELECT mkc.content, mkc.chunk_type, mp.name AS product_name,
                1 - (mkc.embedding <=> $1::vector) AS similarity
         FROM medical_knowledge_chunks mkc
         JOIN medical_products mp ON mp.id = mkc.medical_product_id
         WHERE mkc.embedding IS NOT NULL
         ORDER BY mkc.embedding <=> $1::vector
         LIMIT $2`,
        [vectorLiteral, limit]
    );

    if (result.rows.length === 0) return null;

    const relevantChunks = result.rows.filter((r: { similarity: number }) => r.similarity > 0.3);
    if (relevantChunks.length === 0) return null;

    return relevantChunks.map((c: { product_name: string; chunk_type: string; content: string }) =>
        `[${c.product_name} — ${c.chunk_type}]: ${c.content}`
    ).join('\n\n');
}

// ─────────────────────────────────────────────
// Generate embedding via the configured AI provider
// ─────────────────────────────────────────────
export async function generateEmbedding(
    text: string,
    provider: AIProvider,
    apiKey: string
): Promise<number[]> {
    // Each provider has its own embedding endpoint.
    // For now returns a zero vector as placeholder until real API keys are wired.
    // Replace each case with the actual SDK call.
    switch (provider) {
        case 'claude':
            // Anthropic does not currently expose embeddings; use voyage-ai or openai
            return new Array(1536).fill(0);
        case 'gemini':
            // POST https://generativelanguage.googleapis.com/v1/models/embedding-001:embedContent
            return new Array(1536).fill(0);
        case 'deepseek':
            // DeepSeek: POST https://api.deepseek.com/v1/embeddings
            return new Array(1536).fill(0);
        case 'z_ai':
            return new Array(1536).fill(0);
        default:
            return new Array(1536).fill(0);
    }
}

// ─────────────────────────────────────────────
// Generate a chat response from the AI provider
// ─────────────────────────────────────────────
export async function getAIResponse(
    provider: AIProvider,
    systemPrompt: string,
    userMessage: string,
    apiKey: string
): Promise<string> {
    // Replace each case with the real SDK/HTTP call once API keys are available
    switch (provider) {
        case 'deepseek':
            return `[DeepSeek] ${userMessage}`;
        case 'z_ai':
            return `[Z.ai] ${userMessage}`;
        case 'claude':
            return `[Claude] ${userMessage}`;
        case 'gemini':
            return `[Gemini] ${userMessage}`;
        default:
            throw new Error(`Provider not supported: ${provider}`);
    }
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

    // 3. Get medical context from indexed PDFs
    const medicalContext = await findMedicalContext(embedding);

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
        knowledgeContext: medicalContext || undefined,
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
