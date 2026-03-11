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

async function testNewEndpointEmbeddingsOldUrl() {
    const apiKey = "183a3da87bbd4bbea3732ca88de8bb16.gbebMDkBzjOAwAAB";
    const url = "https://api.z.ai/api/coding/paas/v4/chat/completions";

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${generateZaiJWT(apiKey)}`, // TEST JWT
            },
            body: JSON.stringify({
                model: "glm-5",
                messages: [{ role: "user", content: "hola" }]
            })
        });

        console.log("Status JWT:", res.status);
    } catch (e) {
        console.error(e);
    }
}
testNewEndpointEmbeddingsOldUrl();
