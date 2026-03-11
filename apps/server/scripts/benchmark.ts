import fs from 'fs';
import path from 'path';
import { db } from '../src/db';
import { getAIResponse } from '../src/ai.service';

async function runBenchmark() {
    console.log("Starting Conversations Benchmark...");
    try {
        const ticketsPath = path.join(__dirname, '../tickets.json');
        if (!fs.existsSync(ticketsPath)) {
            console.error("tickets.json not found. Please ensure test-myalice.js ran successfully.");
            process.exit(1);
        }

        const ticketsData = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
        const tickets = ticketsData.dataSource || [];

        console.log(`Loaded ${tickets.length} tickets.`);

        // Grab settings for AI
        console.log("Fetching AI settings from DB...");
        const settingsRes = await db.query(`SELECT provider, api_key_encrypted, model, system_prompt FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
        if (settingsRes.rows.length === 0) {
            console.error("AI Settings not configured in DB.");
            process.exit(1);
        }
        const { provider, api_key_encrypted, model, system_prompt } = settingsRes.rows[0];
        console.log(`Using AI Provider: ${provider}`);

        let markdownReport = `# Reporte de Benchmarking (Agente Humano vs Bot RAG)\n\n`;
        markdownReport += `Este reporte compara la respuesta real dada por un agente frente a la respuesta generada por el Bot utilizando la Base de Conocimiento RAG y Catálogo actual.\n\n`;

        let count = 0;

        for (const ticket of tickets) {
            const customerMessage = ticket.customer_last_message_text;
            let humanResponse = ticket.initial_response_text || ticket.card_text;

            if (!customerMessage || !humanResponse) continue;

            if (humanResponse.startsWith("Agent: ")) humanResponse = humanResponse.replace("Agent: ", "");
            if (humanResponse.startsWith("Bot: ")) continue;

            if (customerMessage.trim().length < 5) continue;

            count++;
            console.log(`Evaluating Ticket #${ticket.id} (${count}/10)...`);

            // Generate Bot response
            let botResponse = "";
            try {
                const { generateEmbedding } = require('../src/ai.service');
                const embedding = await generateEmbedding(customerMessage, provider, api_key_encrypted);
                const kbRes = await db.query(
                    `SELECT id, answer FROM knowledge_base ORDER BY embedding <-> $1::vector LIMIT 2`,
                    [`[${embedding.join(',')}]`]
                );

                let knowledgeContext = kbRes.rows.map((r: any) => r.answer).join('\n---\n');

                botResponse = await getAIResponse(
                    provider,
                    system_prompt,
                    customerMessage,
                    api_key_encrypted,
                    model,
                    ticket.customer_id?.toString(),
                    knowledgeContext,
                    ticket.conversation_id
                );
            } catch (e: any) {
                console.error(`Error processing ticket #${ticket.id}:`, e);
                botResponse = `[Error: ${e.message}]`;
            }

            markdownReport += `## Ticket #${ticket.id} (${ticket.customer_full_name})\n`;
            markdownReport += `**Mensaje del Cliente:**\n> ${customerMessage}\n\n`;
            markdownReport += `**Respuesta del Agente Humano:**\n> ${humanResponse}\n\n`;
            markdownReport += `**Respuesta Sugerida por el Bot:**\n> ${botResponse}\n\n`;
            markdownReport += `---\n\n`;

            if (count >= 10) break;
        }

        markdownReport += `\n**Total evaluados:** ${count}\n`;

        fs.writeFileSync(path.join(__dirname, '../benchmark_report.md'), markdownReport);
        console.log("Benchmark complete. Wrote to apps/server/benchmark_report.md");
        process.exit(0);

    } catch (e) {
        console.error("CRITICAL Benchmark error:", e);
        process.exit(1);
    }
}

runBenchmark();
