import crypto from 'crypto';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

function generateZaiJWT(apiKey: string): string {
    const [id, secret] = apiKey.split('.');
    if (!id || !secret) return apiKey;
    const base64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const now = Date.now();
    const header = { alg: 'HS256', sign_type: 'SIGN' };
    const payload = { api_key: id, exp: now + 3600 * 1000, timestamp: now };
    const unsigned = base64url(header) + '.' + base64url(payload);
    const sig = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
    return unsigned + '.' + sig;
}

async function listModels() {
    const apiKey = process.env.ZAI_API_KEY!;
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/models', {
        headers: { Authorization: `Bearer ${generateZaiJWT(apiKey)}` }
    });
    if (!res.ok) console.log(res.status, await res.text());
    else {
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    }
}

listModels();
