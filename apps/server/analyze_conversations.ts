import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const db = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function main() {
    console.log("Fetching last 50 conversations to compare AI vs Human agents...\n");
    const res = await db.query(`
        SELECT 
            c.id, 
            cu.display_name as customer,
            (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND direction = 'inbound') as messages_from_client,
            (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND direction = 'outbound' AND handled_by = 'bot') as bot_responses,
            (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND direction = 'outbound' AND handled_by = 'human') as human_responses
        FROM conversations c
        JOIN customers cu ON cu.id = c.customer_id
        ORDER BY c.created_at DESC
        LIMIT 50
    `);

    let botHandled = 0;
    let humanHandled = 0;
    let mixedHandled = 0;

    let botAnswers = [];
    let humanAnswers = [];

    for (const row of res.rows) {
        if (row.bot_responses > 0 && row.human_responses === '0') botHandled++;
        if (row.bot_responses === '0' && row.human_responses > 0) humanHandled++;
        if (row.bot_responses > 0 && row.human_responses > 0) mixedHandled++;
    }

    console.log(`Of the last 50 conversations:`);
    console.log(`- Exclusively handled by Bot: ${botHandled}`);
    console.log(`- Exclusively handled by Human: ${humanHandled}`);
    console.log(`- Mixed handling: ${mixedHandled}\n`);

    // Fetch sample answers
    const sampleBots = await db.query(`
        SELECT content FROM messages 
        WHERE direction = 'outbound' AND handled_by = 'bot'
        ORDER BY created_at DESC LIMIT 5
    `);

    const sampleHumans = await db.query(`
        SELECT content FROM messages 
        WHERE direction = 'outbound' AND handled_by = 'human'
        ORDER BY created_at DESC LIMIT 5
    `);

    console.log("=== Comparativo Cualitativo ===");
    console.log("\nEjemplos de Agente IA (Últimas respuestas):");
    sampleBots.rows.forEach((r, i) => console.log(`[Bot] ${r.content.replace(/\n/g, ' ')}`));

    console.log("\nEjemplos de Agentes Humanos (Últimas respuestas):");
    sampleHumans.rows.forEach((r, i) => console.log(`[Human] ${r.content.replace(/\n/g, ' ')}`));

    // Identificar áreas de oportunidad para automatización
    // (We look for inbound messages that were answered by humans but could be automated)
    const candidates = await db.query(`
        SELECT m_in.content as question, m_out.content as answer
        FROM messages m_in
        JOIN messages m_out ON m_in.conversation_id = m_out.conversation_id AND m_in.created_at < m_out.created_at
        WHERE m_out.direction = 'outbound' AND m_out.handled_by = 'human' AND m_in.direction = 'inbound'
        ORDER BY m_out.created_at DESC LIMIT 5
    `);

    let out = "\n=== Conversaciones human-only que podrían automatizarse ===\n";
    candidates.rows.forEach((r, i) => {
        out += `Cliente: ${r.question.replace(/\n/g, ' ').substring(0, 100)}\n`;
        out += `Humano:  ${r.answer.replace(/\n/g, ' ').substring(0, 100)}\n\n`;
    });

    console.log(out);
    require('fs').writeFileSync('analysis_result.txt', `Of the last 50 convs: Bot: ${botHandled}, Human: ${humanHandled}, Mixed: ${mixedHandled}\n` + out, 'utf-8');

    db.end();
}

main().catch(console.error);
