async function testZaiRawAll() {
    const apiKey = "b0401e89706d448daa1202aab95f6d1e.Fq1XKwshJhwooXaC";

    const endpoints = [
        'https://api.z.ai/api/paas/v4/chat/completions',
        'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    ];

    // Z.ai official docs say: https://api.z.ai/v1 for standard openai. let's try /v1/chat/completions
    // "Z.AI is fully compatible with the official OpenAI SDK."
    endpoints.push('https://api.z.ai/v1/chat/completions');

    const models = ["glm-4", "glm-4-flash", "glm-5", "glm-5.0", "glm-4.7-flash"];

    for (const ep of endpoints) {
        console.log(`\n--- Endpoint: ${ep} ---`);
        for (const model of models) {
            try {
                const r1 = await fetch(ep, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({ model: model, messages: [{ role: "user", content: "hola" }] })
                });

                if (r1.ok) {
                    console.log(`[+] ${model} SUCCESS! Status: ${r1.status}`);
                    break; // If one succeeds we don't need to try the rest for this endpoint probably 
                } else {
                    const text = await r1.text();
                    console.log(`[-] ${model} failed (Status: ${r1.status}):`, text.substring(0, 50));
                }
            } catch (e) { console.error(`[!] ${model} error:`, e.message); }
        }
    }
}

testZaiRawAll();
