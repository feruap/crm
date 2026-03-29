import { Worker, Job } from 'bullmq';
import { connection } from '../queues';
import { db } from '../db';
import { getAIResponse, generateEmbedding, findBestAnswer, recordKnowledgeUse } from '../ai.service';
import { emitNewMessage, emitConversationUpdated, getIO } from '../socket';
import { AIJobData } from '../queues/aiResponseQueue';
import { deliverMessage } from '../services/message-sender';

const worker = new Worker<AIJobData>('ai-response', async (job: Job<AIJobData>) => {
    const { conversationId, channelId, customerId, messageText } = job.data;

    // Get AI settings
    const settings = await db.query(
        `SELECT provider, api_key_encrypted, system_prompt, model_name
         FROM ai_settings WHERE is_default = TRUE LIMIT 1`
    );
    if (settings.rows.length === 0) return;

    const { provider: aiProvider, api_key_encrypted, system_prompt: rawPrompt, model_name } = settings.rows[0];

    // Inject channel brand name into system prompt
    const chBrand = await db.query(`SELECT brand_name, name FROM channels WHERE id = $1`, [channelId]);
    const brandName = chBrand.rows[0]?.brand_name || chBrand.rows[0]?.name || 'Amunet';
    const system_prompt = rawPrompt ? rawPrompt.replace(/Amunet/gi, brandName) : rawPrompt;

    // RAG lookup
    const embedding = await generateEmbedding(messageText, aiProvider, api_key_encrypted);
    const knowledgeHit = await findBestAnswer(messageText, embedding);

    let botReply: string;
    let confidence: number;
    let knowledgeContext: string | undefined;

    if (knowledgeHit && knowledgeHit.confidence > 0.90) {
        botReply = knowledgeHit.answer;
        confidence = knowledgeHit.confidence;
        await recordKnowledgeUse(knowledgeHit.knowledgeId as any);
    } else {
        if (knowledgeHit && knowledgeHit.confidence > 0.30) {
            knowledgeContext = `Información relacionada encontrada:\n- Contexto: ${knowledgeHit.question}\n- Respuesta base: ${knowledgeHit.answer}`;
            await recordKnowledgeUse(knowledgeHit.knowledgeId as any);
        }
        let finalSystemPrompt = system_prompt || '';
        if (brandName && brandName !== 'Amunet') {
            finalSystemPrompt = `Eres el asistente de ${brandName}. ` + finalSystemPrompt;
        }
        botReply = await getAIResponse(
            aiProvider as any,
            finalSystemPrompt,
            messageText,
            api_key_encrypted,
            model_name,
            customerId,
            knowledgeContext,
            conversationId
        );
        confidence = knowledgeHit ? knowledgeHit.confidence : 0.5;
    }

    // Check escalation rules
    const msgCountRes = await db.query(
        `SELECT COUNT(*) FROM messages WHERE conversation_id = $1 AND direction = 'inbound'`,
        [conversationId]
    );
    const inboundCount = parseInt(msgCountRes.rows[0].count, 10);

    let escalated = false;
    try {
        const r = await db.query(`SELECT value FROM settings WHERE key = 'escalation_rules'`);
        if (r.rows[0]?.value) {
            const rules = JSON.parse(r.rows[0].value);
            const lower = messageText.toLowerCase();
            if (
                (rules.low_confidence && confidence < (rules.confidence_threshold || 0.5)) ||
                (rules.customer_requests_human && (rules.human_keywords || []).some((k: string) => lower.includes(k))) ||
                (rules.max_messages && inboundCount >= (rules.max_message_count || 5))
            ) {
                escalated = true;
                botReply = `Te conecto con un asesor especializado. Un momento por favor. 🙂`;
                await db.query(
                    `UPDATE conversations SET status = 'waiting', assigned_agent_id = NULL, updated_at = NOW() WHERE id = $1`,
                    [conversationId]
                );
            }
        }
    } catch (_) { /* escalation rules are optional */ }

    // Insert bot reply message
    const result = await db.query(
        `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by, bot_confidence)
         VALUES ($1, $2, $3, 'outbound', $4, $5, $6) RETURNING *`,
        [conversationId, channelId, customerId, botReply, escalated ? 'escalation' : 'bot', confidence]
    );

    const insertedMessage = result.rows[0];
    emitNewMessage(conversationId, insertedMessage);
    emitConversationUpdated(conversationId, {
        last_message: botReply,
        last_message_at: insertedMessage.created_at,
    });
    getIO().emit('conversation_list_updated', { conversation_id: conversationId });

    // Deliver via channel API
    try {
        await deliverMessage(insertedMessage.id, conversationId, customerId, channelId, botReply);
    } catch (sendErr: any) {
        console.error('[AIWorker] Channel send error:', sendErr.message);
    }
}, { connection: connection as any });

worker.on('completed', (job) => {
    console.log(`[AIWorker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`[AIWorker] Job ${job?.id} failed:`, err.message);
});

export default worker;
