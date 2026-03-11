import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const db = new Pool({
    host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function main() {
    const res = await db.query("SELECT id, direction, content, handled_by, created_at, customer_id FROM messages ORDER BY created_at DESC LIMIT 10");
    fs.writeFileSync('last_10.json', JSON.stringify(res.rows, null, 2), 'utf-8');
    db.end();
}
main().catch(console.error);
