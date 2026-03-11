async function testZaiDocs() {
    const rawKey = "b0401e89706d448daa1202aab95f6d1e.Fq1XKwshJhwooXaC";

    // Official z.ai docs say: Endpoint: https://api.z.ai/api/paas/v4 
    // Auth: Bearer RAW_KEY

    // Test completions endpoint
    try {
        console.log("Testing z.ai /chat/completions with RAW key...");
        const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${rawKey}`,
            },
            body: JSON.stringify({
                model: 'glm-5', // what the user wants
                messages: [{ role: "user", content: "hola" }]
            })
        });

        console.log("Status:", response.status);
        if (!response.ok) {
            console.log("Error text:", await response.text());
        } else {
            console.log("Success:", await response.json());
        }
    } catch (e) {
        console.error("Fetch Exception:", e);
    }
}

testZaiDocs();
