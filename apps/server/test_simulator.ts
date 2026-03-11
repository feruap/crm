

async function testSimulator() {
    try {
        console.log("Fetching channels to get a simulator channel...");
        const chRes = await fetch('http://localhost:3001/api/channels');
        const channels = await chRes.json();
        const activeChannel = channels.find((c: any) => c.is_active);

        if (!activeChannel) {
            console.log("No active channels found.");
            return;
        }

        console.log(`Using channel ${activeChannel.name} (${activeChannel.id})`);

        const payload = {
            channel_id: activeChannel.id,
            customer_name: "Sim Test User",
            customer_phone: "+5212225055555",
            content: "hola"
        };

        console.log(`Sending message: ${payload.content}`);
        const res = await fetch('http://localhost:3001/api/simulator/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log("Response status:", res.status);
        const data = await res.json();
        console.log("Response data:", JSON.stringify(data, null, 2));

        console.log("Waiting 5 seconds for bot to process...");
        await new Promise(r => setTimeout(r, 5000));

        console.log("Fetching conversation history...");
        const histRes = await fetch(`http://localhost:3001/api/simulator/messages/${data.conversation_id}`);
        const histData = await histRes.json();

        console.log("=== Conversation History ===");
        histData.forEach((m: any) => {
            console.log(`[${m.handled_by === 'bot' ? 'BOT' : (m.direction === 'inbound' ? 'CLIENTE' : 'HUMANO')}]: ${m.content.replace(/\n/g, ' ')}`);
        });

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testSimulator();
