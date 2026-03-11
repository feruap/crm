import { db } from './src/db';

async function seedAutomations() {
    try {
        console.log('Cleaning existing test automations...');
        await db.query('TRUNCATE TABLE automations RESTART IDENTITY');

        console.log('Seeding requested automations...');

        // 1. Atribución
        await db.query(`
            INSERT INTO automations (name, trigger_type, conditions, actions, is_active)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            '1. Cliente de Campaña (Ventas)',
            'new_conversation',
            JSON.stringify({ has_attribution: true, active_order_days: 0 }),
            JSON.stringify({
                type: 'sales_bot',
                options: []
            }),
            true
        ]);

        // 2. Pedido Reciente
        await db.query(`
            INSERT INTO automations (name, trigger_type, conditions, actions, is_active)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            '2. Pedido Reciente (< 5 días)',
            'new_conversation',
            JSON.stringify({ has_attribution: false, active_order_days: 5 }),
            JSON.stringify({
                type: 'support_bot',
                options: []
            }),
            true
        ]);

        // 3. Flujo Principal (Menú default)
        await db.query(`
            INSERT INTO automations (name, trigger_type, conditions, actions, is_active)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            '3. Flujo Principal (Sin Atribución)',
            'new_conversation',
            JSON.stringify({ has_attribution: false, active_order_days: 0 }),
            JSON.stringify({
                type: 'menu_options',
                options: ['Ventas', 'Envíos', 'Información Técnica']
            }),
            true
        ]);

        console.log('✅ Automations seeded successfully!');
    } catch (err) {
        console.error('Failed to seed automations:', err);
    } finally {
        process.exit(0);
    }
}

seedAutomations();
