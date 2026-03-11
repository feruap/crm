import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const db = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function main() {
    console.log('Clearing old automations...');
    await db.query('DELETE FROM automations');

    const rules = [
        {
            name: "Escenario A: Con Atribución / Flujo Ventas",
            trigger_type: "new_conversation",
            conditions: { has_attribution: true, active_order_days: 0 },
            actions: {
                type: "sales_bot",
                prompt: `* ATRIBUCIÓN DETECTADA: El cliente viene de una campaña publicitaria externa. Tienes que dar la información acerca del producto que refiere la campaña, generar el flujo de ventas, e incluir sugerencias de cross-selling y up-selling. Tu objetivo principal es llevar al cliente al cierre (Checkout) con un tono comercial impecable, sin importar si toma unos días.`
            },
            is_active: true
        },
        {
            name: "Escenario B: Sin Atribución / Menú Principal",
            trigger_type: "new_conversation",
            conditions: { has_attribution: false, active_order_days: 0 },
            actions: {
                type: "menu_options",
                prompt: `* FLUJO PRINCIPAL: El cliente NO viene de una campaña y NO tiene pedidos recientes.
Preséntale OBLIGATORIAMENTE las siguientes tres opciones como un menú interactivo usando botones rápidos (o texto enumerado):
1. Ventas: Si elige ventas, ofrécele comprar lo último que compró, una promoción nueva, o enlazarlo con un agente humano.
2. Envíos: Si elige envíos, rastrea la información de su último pedido y si no puede, ofrécele un agente humano.
3. Información Técnica: Si elige esto, dale información guiada, resúmenes, y manuales de the productos usando el lenguaje específico y nivel profesional acorde al cliente. Usa un lenguaje ameno e incluye sugerencias.

Debes empezar saludando y ofreciendo inmediatamente estas opciones.`
            },
            is_active: true
        }
    ];

    for (const rule of rules) {
        await db.query(
            `INSERT INTO automations (name, trigger_type, conditions, actions, is_active)
             VALUES ($1, $2, $3, $4, $5)`,
            [rule.name, rule.trigger_type, JSON.stringify(rule.conditions), JSON.stringify(rule.actions), rule.is_active]
        );
        console.log(`Inserted rule: ${rule.name}`);
    }

    db.end();
}

main().catch(console.error);
