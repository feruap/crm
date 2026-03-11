import { ZhipuAI } from "zhipuai";

async function main() {
    const ai = new ZhipuAI({
        apiKey: "b0401e89706d448daa1202aab95f6d1e.Fq1XKwshJhwooXaC"
    });

    try {
        console.log("Calling using official SDK...");
        const result = await ai.chat.completions.create({
            model: "glm-4",
            messages: [{ role: "user", content: "hola" }]
        });
        console.log("Success:", result);
    } catch (e: any) {
        console.error("SDK Error:", e.response?.data || e.message);
    }
}

main();
