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
    const finalRes = await db.query(`
        SELECT content 
        FROM messages 
        WHERE customer_id = (SELECT id FROM customers WHERE wa_id = '5212225051752' LIMIT 1)
        ORDER BY created_at DESC LIMIT 2
    `);

    console.log("LAST 2 MESSAGES:");
    for (const row of finalRes.rows) {
        console.log(row.content);
    }
    db.end();
}
main().catch(console.error);
