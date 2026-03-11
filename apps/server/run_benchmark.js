const { db } = require('./dist/db');
const { getAIResponse, generateEmbedding } = require('./dist/ai.service');
const fs = require('fs');
const path = require('path');

async function runBenchmark() {
    console.log("Starting Conversations Benchmark (Fixed IDs)...");
    try {
        const ticketsPath = path.join(__dirname, 'tickets.json');
        if (!fs.existsSync(ticketsPath)) {
            console.error("tickets.json not found.");
            process.exit(1);
        }

        const ticketsData = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
        const tickets = ticketsData.dataSource || [];

        console.log(`Loaded ${tickets.length} tickets.`);

        const settingsRes = await db.query(`SELECT provider, api_key_encrypted, model_name as model, system_prompt FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
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
            let customerMessage = ticket.customer_last_message_text;
            let humanResponse = ticket.initial_response_text || ticket.card_text;

            if (!customerMessage || !humanResponse) continue;

            // CLEANUP: If it has the "Initiated conversation from Referral" header, extract just the message part
            if (customerMessage.includes("Message:")) {
                const parts = customerMessage.split("Message:");
                customerMessage = parts[parts.length - 1].trim();
            }

            if (humanResponse.startsWith("Agent: ")) humanResponse = humanResponse.replace("Agent: ", "");
            if (humanResponse.startsWith("Bot: ")) continue;

            // Skip very short or generic messages for benchmark quality
            if (customerMessage.trim().length < 3 || customerMessage === "N/A") continue;

            count++;
            console.log(`Evaluating Ticket #${ticket.id} (${count}/10)...`);

            let botResponse = "";
            try {
                // 1. Get embedding for the cleaned message
                const embedding = await generateEmbedding(customerMessage, provider, api_key_encrypted);

                // 2. Fetch context (RAG)
                const kbRes = await db.query(
                    `SELECT id, answer FROM knowledge_base ORDER BY embedding <-> $1::vector LIMIT 2`,
                    [`[${embedding.join(',')}]`]
                );

                const knowledgeContext = kbRes.rows.map(r => r.answer).join('\n---\n');

                // 3. Get AI Response (We pass undefined for IDs to avoid UUID errors since these are external tickets)
                botResponse = await getAIResponse(
                    provider,
                    system_prompt,
                    customerMessage,
                    api_key_encrypted,
                    model,
                    undefined, // customerId
                    knowledgeContext,
                    undefined  // conversationId
                );
            } catch (e) {
                console.error(`Error processing ticket #${ticket.id}:`, e.message);
                botResponse = `[Error: ${e.message}]`;
            }

            markdownReport += `## Ticket #${ticket.id} (${ticket.customer_full_name || 'Cliente'})\n`;
            markdownReport += `**Mensaje del Cliente:**\n> ${customerMessage}\n\n`;
            markdownReport += `**Respuesta del Agente Humano:**\n> ${humanResponse}\n\n`;
            markdownReport += `**Respuesta Sugerida por el Bot:**\n> ${botResponse}\n\n`;
            markdownReport += `---\n\n`;

            if (count >= 10) break;
        }

        markdownReport += `\n**Total evaluados:** ${count}\n`;

        fs.writeFileSync('benchmark_report.md', markdownReport);
        console.log("Benchmark complete. Wrote to apps/server/benchmark_report.md");
        process.exit(0);

    } catch (e) {
        console.error("CRITICAL Benchmark error:", e);
        process.exit(1);
    }
}

runBenchmark();
