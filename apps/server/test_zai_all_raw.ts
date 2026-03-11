async function testZaiRawAll() {
    const apiKey = "b0401e89706d448daa1202aab95f6d1e.Fq1XKwshJhwooXaC";

    const models = ["glm-4", "glm-4-flash", "glm-4-air", "glm-4-plus"];
    for (const model of models) {
        try {
            const r1 = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ model: model, messages: [{ role: "user", content: "hola" }] })
            });
            console.log(`[RAW] ${model} status:`, r1.status);
            if (!r1.ok) console.log(await r1.text());
            else console.log("Success!");
        } catch (e) { console.error(e); }
    }
}

testZaiRawAll();
