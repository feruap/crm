import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const db = new Pool({
    host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});
async function main() {
    const res = await db.query("SELECT column_name as c FROM information_schema.columns WHERE table_name = 'messages'");
    console.log("COLUMNS IN MESSAGES TABLE:", res.rows.map(r => r.c).join(', '));
    db.end();
}
main().catch(console.error);
