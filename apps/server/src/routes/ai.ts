import { Router, Request, Response } from 'express';
import { db } from '../db';
import { getAIResponse, AIProvider } from '../ai.service';

const router = Router();

// POST /api/ai/suggest
router.post('/suggest', async (req: Request, res: Response) => {
    const { conversation_id, draft, tone } = req.body;

    if (!conversation_id || !tone) {
        res.status(400).json({ error: 'conversation_id and tone are required' });
        return;
    }

    try {
        // 1. Get default AI settings
        const settingsResult = await db.query(
            `SELECT provider, api_key_encrypted, model_name FROM ai_settings WHERE is_default = TRUE LIMIT 1`
        );
        if (settingsResult.rows.length === 0) {
            res.status(503).json({ error: 'AI not configured' });
            return;
        }
        const { provider, api_key_encrypted, model_name } = settingsResult.rows[0];

        // 2. Get last 10 messages for context
        const messagesResult = await db.query(
            `SELECT direction, content FROM messages 
             WHERE conversation_id = $1 
             ORDER BY created_at DESC LIMIT 10`,
            [conversation_id]
        );
        const context = messagesResult.rows
            .reverse()
            .map(m => `${m.direction === 'inbound' ? 'Cliente' : 'Asistente'}: ${m.content}`)
            .join('\n');

        // 3. Prepare prompt
        const systemPrompt = `Eres un asistente de ventas. Reescribe el siguiente borrador en tono ${tone}. 
Responde SOLO con el mensaje reescrito, sin explicaciones. 
Contexto de la conversación:\n${context}`;

        const userMessage = draft || 'Genera una respuesta apropiada para continuar la conversación.';

        // 4. Get AI response
        const suggestion = await getAIResponse(provider as AIProvider, systemPrompt, userMessage, api_key_encrypted);

        res.json({ suggestion });
    } catch (err) {
        console.error('AI Suggestion error:', err);
        res.status(500).json({ error: 'Failed to generate suggestion' });
    }
});

export default router;
