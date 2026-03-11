import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
import { handleBotResponse } from './src/routes/webhooks';

async function testBot() {
    console.log("Simulando que el cliente dice 'hola amigo'...");
    try {
        await handleBotResponse(
            "447b9115-ce2c-4cf1-8e2f-c520f1319888",
            "da3baec8-2895-46aa-ab9f-3ce643666fec",
            "10028dda-fd95-4226-b3a3-c82f4e8ae8b7",
            "hola amigo");
        console.log("Bot invocado.");
    } catch (e) {
        console.error("Error global:", e);
    }
}
testBot();
