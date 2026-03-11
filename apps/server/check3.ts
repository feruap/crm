import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const db = new Pool({
    host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});
async function main() {
    const res = await db.query("SELECT content FROM messages ORDER BY created_at DESC LIMIT 2");
    console.log("LAST MESSAGES:", res.rows);
    db.end();
}
main().catch(console.error);
