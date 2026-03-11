import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const db = new Pool({
    host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});
async function main() {
    const res = await db.query("SELECT id, direction, content, handled_by, created_at FROM messages ORDER BY id DESC LIMIT 5");
    console.log(JSON.stringify(res.rows, null, 2));
    db.end();
}
main().catch(console.error);
