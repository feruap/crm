import { getAIResponse } from './src/ai.service';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    const prompt = "Eres Fernando Ruiz, especialista de Amunet. Te enfocas en asesorar y vender equipos médicos a clínicas de latam. Vender con naturalidad.";
    const userMsg = "soy cardiologo que pruebas tienes";
    console.log("Asking AI...");
    try {
        const response = await getAIResponse("z_ai", prompt, userMsg, process.env.ZAI_API_KEY!);
        console.log("------------------- AI RESPONSE -----------------------");
        console.log(response);
        console.log("-------------------------------------------------------");
    } catch (e) {
        console.error(e);
    }
}
run();
