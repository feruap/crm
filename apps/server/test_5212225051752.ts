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

async function testWhatsapp(phone: string, text: string) {
    const safePhone = phone.replace('+', '');
    console.log(`\n=== Enviando Mensaje simulado: "${text}" ===`);
    const payload = {
        object: "whatsapp_business_account",
        entry: [{
            id: "123456789",
            changes: [{
                value: {
                    messaging_product: "whatsapp",
                    metadata: { display_phone_number: "2225051752", phone_number_id: "123" },
                    contacts: [{ profile: { name: "Test User" }, wa_id: safePhone }],
                    messages: [{
                        from: safePhone,
                        id: "wamid_" + Date.now(),
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        type: "text",
                        text: { body: text }
                    }]
                },
                field: "messages"
            }]
        }]
    };

    const res = await fetch('http://localhost:3001/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    console.log(`Webhook HTTP status: ${res.status}`);

    console.log("Esperando respuesta del Bot IA (10 segundos)...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    const finalRes = await db.query(`
        SELECT * 
        FROM messages 
        WHERE customer_id = (SELECT id FROM customers WHERE wa_id = $1 LIMIT 1)
        ORDER BY id ASC
    `, [safePhone]);

    console.log(`\n=== Historial de Conversación para ${phone} ===`);
    for (const msg of finalRes.rows) {
        console.log(`[${msg.sender_type === 'bot' || msg.direction === 'outbound' ? 'BOT' : 'CLIENTE'}]: ${msg.content.substring(0, 500)}`);
    }

    db.end();
}

testWhatsapp("+5212225051752", "Hola! Vengo a probar el sistema").catch(console.error);
