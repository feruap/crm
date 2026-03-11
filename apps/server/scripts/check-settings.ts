import { db } from '../src/db';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkSettings() {
    const res = await db.query('SELECT * FROM ai_settings WHERE is_default = TRUE LIMIT 1');
    if (res.rows.length === 0) {
        console.log('No default settings found.');
        process.exit(1);
    }
    const row = res.rows[0];
    console.log('Provider:', row.provider);
    console.log('Model:', row.model_name);
    console.log('DB Key (last 4):', row.api_key_encrypted?.slice(-4));
    console.log('ENV Key (last 4):', process.env.ZAI_API_KEY?.slice(-4));
    process.exit(0);
}

checkSettings().catch(console.error);
