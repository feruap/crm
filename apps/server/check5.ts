import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();
const db = new Pool({
    host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});
async function main() {
    const res = await db.query("SELECT * FROM messages WHERE content ILIKE '%hola amigo%' ORDER BY id DESC LIMIT 5");
    fs.writeFileSync('hola_amigo.json', JSON.stringify(res.rows, null, 2), 'utf-8');
    db.end();
}
main().catch(console.error);
