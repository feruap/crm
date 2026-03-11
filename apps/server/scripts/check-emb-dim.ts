import { generateEmbedding } from '../src/ai.service';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkEmbedding() {
    try {
        const apiKey = process.env.ZAI_API_KEY!;
        const emb = await generateEmbedding('test description', 'z_ai', apiKey);
        console.log('Dimension:', emb.length);
    } catch (e: any) {
        console.error(e.message);
    }
}

checkEmbedding();
