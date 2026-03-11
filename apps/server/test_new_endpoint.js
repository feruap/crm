async function testNewEndpoint() {
    const apiKey = "183a3da87bbd4bbea3732ca88de8bb16.gbebMDkBzjOAwAAB";
    const url = "https://api.z.ai/api/coding/paas/v4/chat/completions";

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "glm-5",
                messages: [{ role: "user", content: "hola" }]
            })
        });

        console.log("Status:", res.status);
        if (res.ok) {
            const data = await res.json();
            console.log("Response:", data.choices[0].message.content);
        } else {
            console.log("Error:", await res.text());
        }
    } catch (e) {
        console.error(e);
    }
}
testNewEndpoint();
