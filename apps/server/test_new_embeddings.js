async function testNewEndpointEmbeddings() {
    const apiKey = "183a3da87bbd4bbea3732ca88de8bb16.gbebMDkBzjOAwAAB";
    const url = "https://api.z.ai/api/coding/paas/v4/embeddings";

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "embedding-3",
                input: "hola"
            })
        });

        console.log("Status:", res.status);
        if (res.ok) {
            console.log("Success embeddings!");
        } else {
            console.log("Error:", await res.text());
        }
    } catch (e) {
        console.error(e);
    }
}
testNewEndpointEmbeddings();
