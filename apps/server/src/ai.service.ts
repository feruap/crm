import { db } from './db';

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
// Learn from a resolved conversation
// Called automatically when a conversation is marked 'resolved'
// ─────────────────────────────────────────────
export async function learnFromConversation(
    conversationId: string,
    provider: AIProvider,
    apiKey: string
): Promise<void> {
    // Fetch all messages in the conversation
    const messages = await db.query(
        `SELECT direction, content FROM messages
         WHERE conversation_id = $1 AND content IS NOT NULL
         ORDER BY created_at ASC`,
        [conversationId]
    );

    if (messages.rows.length < 2) return;

    // Pair inbound (question) with next outbound handled by human (answer)
    const rows = messages.rows;
    for (let i = 0; i < rows.length - 1; i++) {
        if (rows[i].direction === 'inbound' && rows[i + 1].direction === 'outbound') {
            const question = rows[i].content as string;
            const answer = rows[i + 1].content as string;

            if (question.length < 5 || answer.length < 5) continue;

            const embedding = await generateEmbedding(question, provider, apiKey);
            const vectorLiteral = `[${embedding.join(',')}]`;

            // Upsert: if the same question already exists, increment use_count
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
