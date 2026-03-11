async function testGuide() {
    const rawKey = "b0401e89706d448daa1202aab95f6d1e.Fq1XKwshJhwooXaC";

    // Exactly as the guide says
    try {
        const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${rawKey}`
            },
            body: JSON.stringify({
                model: "glm-5",
                messages: [{ role: "user", content: "hola" }]
            })
        });
        console.log("Status:", response.status);
        if (!response.ok) {
            console.log("Error text:", await response.text());
        } else {
            console.log("Success:", await response.text());
        }
    } catch (e) {
        console.error(e);
    }
}
testGuide();
