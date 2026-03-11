import { db } from '../src/db';
import * as dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';

dotenv.config({ path: path.join(__dirname, '../.env') });

const WEBHOOK_URL = 'http://localhost:3001/api/webhooks/whatsapp';

// Generar 40 mensajes sintéticos variados
const SYNTHETIC_MESSAGES = [
    // Intención Comercial Básica
    "Hola, me interesa comprar un doppler fetal, ¿qué precio tiene?",
    "¿Tienes el monitor de signos vitales disponible?",
    "Quisiera saber más sobre los electrodos pediátricos",
    "¿Tienen promociones en estetoscopios Littmann?",
    "Me interesa equipo de ultrasonido portátil",
    "¿Venden básculas para recién nacidos?",
    "Precio de oxímetros de pulso por favor",
    "Busco equipo médico para clínica nueva",
    "¿Tienen camas de hospital manuales en stock?",
    "Quiero comprar equipo de diagnóstico básico",

    // Intención de Rastreo de Paquetes (Order Tracking)
    "Hola, ¿dónde está mi paquete? el pedido es el 2450",
    "Quiero saber el estatus de mi orden",
    "¿Cuándo llega mi doppler? Mi número de pedido es 2451",
    "Mi pedido 2452 aún no llega, ¿tienen mi número de guía?",
    "¿Me pueden pasar la guía de mi pedido? Soy juan@test.com",
    "Necesito rastrear mi paquete, no me ha llegado el correo.",
    "¿Por qué paquetería enviaron mi pedido 2453?",
    "Me gustaría saber el estado de mi envío",
    "¿Mi historial de compras en WooCommerce?",
    "Ayuda con el envío de mi pedido 2455",

    // Intención Restringida (Categorías excluidas / Cortesías)
    "¿Me pueden dar un producto de cortesía?",
    "Ví un curso médico gratis, ¿me lo comparten?",
    "Quiero comprar una oferta que estaba en la zona de cortesias",
    "¿Aún tienen cursos de uso de equipo médico?",
    "¿Me regalas una muestra gratis del gel ultrasonido?",
    "Busco acceso al área de cortesías",
    "¿Cómo aplico para los productos excluidos?",
    "Quiero el curso de cardiología básica",
    "¿Venden clases particulares de uso de doppler?",
    "Me interesa la capacitación técnica gratuita",

    // Intención Médica / Fallos (Para futuro RAG Knowledge Base)
    "Mi doppler fetal me da error, solo escucho estática",
    "¿Qué recomiendan usar con el equipo de ultrasonido, algún gel especial?",
    "La pantalla de mi monitor de signos parpadea",
    "¿Tienen el manual de usuario del equipo de rayos X?",
    "No puedo conectar el sensor de oximetría pediátrica",
    "El manguito de presión arterial está fugando aire",
    "¿Cómo se calibra la báscula de bebé?",
    "Requiero soporte técnico para mi electrocardiógrafo",
    "¿Cada cuánto se deben cambiar los filtros del concentrador?",
    "Errores comunes con los nebulizadores"
];

async function ensureWhatsAppChannel() {
    console.log('Verificando canal de WhatsApp para pruebas...');
    const res = await db.query('SELECT id FROM channels WHERE provider = $1 AND is_active = $2 LIMIT 1', ['whatsapp', true]);

    if (res.rows.length === 0) {
        console.log('Creando canal provisional de WhatsApp (sin webhook_secret) para evitar error de validación...');
        await db.query('INSERT INTO channels (name, provider, is_active, provider_config) VALUES ($1, $2, $3, $4)',
            ['Test WhatsApp', 'whatsapp', true, JSON.stringify({})]
        );
        console.log('Canal de prueba creado exitosamente.');
    } else {
        // Asegurar que no tenga webhook_secret para no bloquear los posts de prueba
        await db.query('UPDATE channels SET webhook_secret = NULL WHERE id = $1', [res.rows[0].id]);
        console.log('Canal de prueba configurado (webhook_secret anulado).');
    }
}

async function sendWebhookMessage(phone: string, name: string, message: string) {
    const payload = {
        object: "whatsapp_business_account",
        entry: [{
            id: "TEST_ACC_ID",
            changes: [{
                value: {
                    messaging_product: "whatsapp",
                    metadata: { display_phone_number: "15551234567", phone_number_id: "TEST_PHONE_ID" },
                    contacts: [{ profile: { name } }],
                    messages: [{
                        from: phone,
                        id: 'wamid.TEST_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        text: { body: message },
                        type: "text"
                    }]
                },
                field: "messages"
            }]
        }]
    };

    try {
        const response = await axios.post(WEBHOOK_URL, payload);
        return response.status === 200;
    } catch (err: any) {
        console.error('❌ Error enviando webhook para ' + phone + ':', err.message);
        return false;
    }
}

async function verifyBotReply(customerId: string): Promise<string | null> {
    // Esperar un momento a que el bot responda
    await new Promise(resolve => setTimeout(resolve, 12000));

    const res = await db.query(
        'SELECT m.content, m.handled_by ' +
        'FROM messages m ' +
        'WHERE m.customer_id = $1 AND m.direction = $2 ' +
        'ORDER BY m.created_at DESC ' +
        'LIMIT 1',
        [customerId, 'outbound']
    );

    if (res.rows.length > 0 && res.rows[0].handled_by === 'bot') {
        return res.rows[0].content;
    }
    return null;
}

// Para obtener el CustomerID
async function getCustomerId(phone: string): Promise<string | null> {
    const res = await db.query('SELECT customer_id FROM external_identities WHERE provider_id = $1 LIMIT 1', [phone]);
    return res.rows.length > 0 ? res.rows[0].customer_id : null;
}

async function runSimulation() {
    await ensureWhatsAppChannel();
    console.log('\n🚀 Iniciando simulación E2E de Fase 1 con ' + SYNTHETIC_MESSAGES.length + ' conversaciones...\n');

    let successCount = 0;

    for (let i = 0; i < SYNTHETIC_MESSAGES.length; i++) {
        const text = SYNTHETIC_MESSAGES[i];
        const phone = '521550000' + String(i).padStart(3, '0'); // Numeros incrementales p. ej. 521550000001
        const name = 'Simulador Usuario ' + (i + 1);

        console.log('\n[' + (i + 1) + '/' + SYNTHETIC_MESSAGES.length + '] Inyectando mensaje de ' + name + ': "' + text + '"');

        // 1. Enviar el webhook
        const sent = await sendWebhookMessage(phone, name, text);
        if (!sent) {
            console.log('Falló el envío del Webhook');
            continue;
        }

        // 2. Comprobar en Base de datos el accionar
        console.log('⏳ Esperando procesamiento de IA...');
        // Damos un par de segundos de margen antes de buscar (el bot suele tomar 3-5s según ZAI)
        await new Promise(resolve => setTimeout(resolve, 2000));
        const customerId = await getCustomerId(phone);

        if (!customerId) {
            console.log('❌ Error: Cliente no resuelto en DB.');
            continue;
        }

        const botReply = await verifyBotReply(customerId);
        if (botReply) {
            console.log('✅ Bot respondió exitosamente:\n"' + botReply.slice(0, 100) + '..."');
            successCount++;
        } else {
            console.log('⚠️ Advertencia: No se detectó respuesta del bot o posible Timeout para cliente ' + customerId + '.');
        }
    }

    console.log('\n🏆 Resumen de Simulación Fase 1: ' + successCount + ' / ' + SYNTHETIC_MESSAGES.length + ' conversaciones exitosas.');
    process.exit(0);
}

runSimulation().catch(console.error);
