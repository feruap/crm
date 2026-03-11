async function testZaiRawAll() {
    const apiKey = "b0401e89706d448daa1202aab95f6d1e.Fq1XKwshJhwooXaC";

    const ep = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

    // Only test models that might have free tier and the ones user asked for
    const models = ["glm-4-flash", "glm-5", "glm-5.0", "glm-4.7-flash"];

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
            } else {
                const text = await r1.text();
                // strip out chinese characters so it doesnt mess up powershell logs
                console.log(`[-] ${model} failed (Status: ${r1.status}): ` + text.replace(/[\u4e00-\u9fa5]/g, ''));
            }
        } catch (e) { console.error(`[!] ${model} error:`, e.message); }
    }
}

testZaiRawAll();
