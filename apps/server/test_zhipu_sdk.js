const { ZhipuAI } = require("zhipuai");

async function main() {
    const ai = new ZhipuAI({
        apiKey: "b0401e89706d448daa1202aab95f6d1e.Fq1XKwshJhwooXaC"
    });

    try {
        console.log("Calling using official SDK...");
        const result = await ai.chat.completions.create({
            model: "glm-5",
            messages: [{ role: "user", content: "hola" }]
        });
        console.log("Success:", JSON.stringify(result, null, 2));
    } catch (e) {
        if (e.response) {
            console.error("SDK Error:", e.response.status, e.response.data);
        } else {
            console.error("SDK Error Message:", e.message);
        }
    }
}

main();
