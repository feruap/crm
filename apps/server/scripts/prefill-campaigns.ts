import { db } from '../src/db';

async function main() {
    console.log('Obteniendo campañas...');
    const result = await db.query(`SELECT id, name, platform FROM campaigns`);
    const campaigns = result.rows;

    console.log(`Encontradas ${campaigns.length} campañas.`);

    for (const c of campaigns) {
        let aiInstructions = '';
        if (c.platform === 'google') {
            aiInstructions = `
# Campaña: ${c.name}
Eres un asistente de ventas para la campaña "${c.name}" en Google Ads.
Tu objetivo principal es asistir al usuario que hizo clic en nuestro anuncio de Google.
Debes ofrecer información clara sobre nuestros productos médicos y pruebas rápidas.
Si preguntan por el precio, infórmales de manera cordial y ofrece un descuento especial por venir de la campaña de Google.
`;
        } else if (c.platform === 'facebook' || c.platform === 'instagram') {
            aiInstructions = `
# Campaña: ${c.name}
Eres un asistente de ventas para la campaña "${c.name}" en Meta Ads (${c.platform}).
Tu objetivo principal es asistir al usuario que vio nuestro anuncio en redes sociales.
Aprovecha que los usuarios de redes buscan respuestas rápidas, ofréceles el catálogo y pregúntales directamente qué tipo de prueba médica necesitan.
`;
        } else {
            aiInstructions = `
# Campaña: ${c.name}
Eres un asistente de ventas para la campaña "${c.name}".
Responde todas las inquietudes del cliente y guíalo hacia una compra exitosa de nuestros insumos médicos.
`;
        }

        await db.query(
            `UPDATE campaigns SET ai_instructions = $1 WHERE id = $2`,
            [aiInstructions, c.id]
        );
        console.log(`Actualizada campaña ${c.id}: ${c.name}`);
    }

    console.log('Prellenado completado exitosamente.');
    process.exit(0);
}

main().catch(err => {
    console.error('Error prellenando campañas:', err);
    process.exit(1);
});
