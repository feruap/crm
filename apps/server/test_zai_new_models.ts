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

async function test(model: string) {
    try {
        const apiKey = "b0401e89706d448daa1202aab95f6d1e.Fq1XKwshJhwooXaC";
        const res = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${generateZaiJWT(apiKey)}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: "hola" }]
            }),
        });
        if (!res.ok) {
            const txt = await res.text();
            console.log(`${model} failed: ${res.status} ${txt}`);
        } else {
            console.log(`${model} succeeded!`);
            const data = await res.json();
            console.log("Output: ", data.choices[0].message.content);
        }
    } catch (e) {
        console.log(e);
    }
}

async function run() {
    await test("glm-4.7-flash");
    await test("glm-4.7");
    await test("GLM-4.7-Flash");
    await test("glm-4.5-air");
    await test("glm-4-air");
}

run();
