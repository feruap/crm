

async function testZaiDirect() {
    const apiKey = "b0401e89706d448daa1202aab95f6d1e.Fq1XKwshJhwooXaC"; // from env

    // Test 1: Zhipu style with raw key
    try {
        console.log("Testing Zhipu with raw key...");
        const r1 = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model: 'glm-4', messages: [{ role: "user", content: "hola" }] })
        });
        console.log("R1 status:", r1.status);
        if (!r1.ok) console.log(await r1.text());
    } catch (e) { console.error(e); }

    // Test 2: api.z.ai with raw key
    try {
        console.log("\nTesting api.z.ai with raw key...");
        const r2 = await fetch('https://api.z.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model: 'glm-4', messages: [{ role: "user", content: "hola" }] })
        });
        console.log("R2 status:", r2.status);
        if (!r2.ok) console.log(await r2.text());
    } catch (e) { console.error(e); }
}

testZaiDirect();
