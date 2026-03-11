import crypto from 'crypto';

export function generateZaiJWT(apiKey: string): string {
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

const ENDPOINTS = [
    'https://api.z.ai/v1/chat/completions',
    'https://open.bigmodel.cn/api/paas/v4/chat/completions',
];

async function test(model: string, endpoint: string, useJwt: boolean) {
    try {
        const apiKey = "b0401e89706d448daa1202aab95f6d1e.Fq1XKwshJhwooXaC";
        const authKey = useJwt ? generateZaiJWT(apiKey) : apiKey;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: "hola" }]
            }),
        });
        if (!res.ok) {
            const txt = await res.text();
            console.log(`[${endpoint}] [${useJwt ? 'JWT' : 'RAW'}] ${model} failed: ${res.status} ${txt}`);
        } else {
            console.log(`[${endpoint}] [${useJwt ? 'JWT' : 'RAW'}] ${model} succeeded!`);
        }
    } catch (e) {
        console.log(e);
    }
}

async function run() {
    for (const ep of ENDPOINTS) {
        for (const jwt of [true, false]) {
            await test("glm-4", ep, jwt);
            await test("glm-4-flash", ep, jwt);
            await test("glm-5", ep, jwt);
        }
    }
}

run();
