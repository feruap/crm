import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { emitAlert } from '../socket';

const router = Router();
router.use(requireAuth);

// GET /api/alerts  — generated in real-time from DB queries
router.get('/', async (_req: Request, res: Response) => {
    const alerts: object[] = [];

    // 1. Conversations waiting > 15 min without agent response
    const waiting = await db.query(`
        SELECT c.id AS conversation_id, cu.display_name AS customer_name,
               a.name AS agent_name,
               EXTRACT(EPOCH FROM (NOW() - MAX(m.created_at))) / 60 AS waiting_minutes,
               (SELECT content FROM messages WHERE conversation_id = c.id
                ORDER BY created_at DESC LIMIT 1) AS last_message
        FROM conversations c
        JOIN customers cu ON cu.id = c.customer_id
        LEFT JOIN agents a ON a.id = c.assigned_agent_id
        JOIN messages m ON m.conversation_id = c.id AND m.direction = 'inbound'
        WHERE c.status = 'open'
        GROUP BY c.id, cu.display_name, a.name
        HAVING EXTRACT(EPOCH FROM (NOW() - MAX(m.created_at))) / 60 > 15
        ORDER BY waiting_minutes DESC
        LIMIT 10
    `);
    for (const row of waiting.rows) {
        alerts.push({
            id: `wait_${row.conversation_id}`,
            type: 'danger',
            category: 'waiting',
            text: `${row.customer_name} lleva ${Math.round(row.waiting_minutes)} min sin respuesta`,
            action: 'Ver conversación',
            conversation_id: row.conversation_id,
            agent_name: row.agent_name,
            last_message: row.last_message,
        });
    }

    // 2. Customers who haven't bought in 30+ days but were active
    const dormant = await db.query(`
        SELECT cu.id, cu.display_name,
               MAX(o.order_date) AS last_purchase,
               EXTRACT(DAY FROM NOW() - MAX(o.order_date)) AS days_since,
               COUNT(o.id) AS total_orders,
               a.name AS agent_name
        FROM customers cu
        JOIN orders o ON o.customer_id = cu.id
        LEFT JOIN conversations conv ON conv.customer_id = cu.id
        LEFT JOIN agents a ON a.id = conv.assigned_agent_id
        WHERE o.status = 'completed'
        GROUP BY cu.id, cu.display_name, a.name
        HAVING COUNT(o.id) >= 2
           AND EXTRACT(DAY FROM NOW() - MAX(o.order_date)) BETWEEN 25 AND 90
        ORDER BY days_since ASC
        LIMIT 10
    `);
    for (const row of dormant.rows) {
        alerts.push({
            id: `dormant_${row.id}`,
            type: 'warning',
            category: 'dormant',
            text: `${row.display_name} no ha comprado en ${Math.round(row.days_since)} días — tenía ${row.total_orders} órdenes`,
            action: 'Contactar ahora',
            customer_id: row.id,
            agent_name: row.agent_name,
        });
    }

    // 3. Customers with increasing ticket (upsell opportunity)
    const upsell = await db.query(`
        SELECT cu.id, cu.display_name,
               ROUND(AVG(o.total_amount)::numeric, 2) AS avg_ticket,
               MAX(o.total_amount) AS last_ticket,
               a.name AS agent_name
        FROM customers cu
        JOIN orders o ON o.customer_id = cu.id
        LEFT JOIN conversations conv ON conv.customer_id = cu.id
        LEFT JOIN agents a ON a.id = conv.assigned_agent_id
        WHERE o.status = 'completed'
        GROUP BY cu.id, cu.display_name, a.name
        HAVING COUNT(o.id) >= 3
           AND MAX(o.total_amount) > AVG(o.total_amount) * 1.3
        ORDER BY last_ticket DESC
        LIMIT 5
    `);
    for (const row of upsell.rows) {
        alerts.push({
            id: `upsell_${row.id}`,
            type: 'opportunity',
            category: 'upsell',
            text: `${row.display_name} está aumentando su ticket — último: $${row.last_ticket}, promedio: $${row.avg_ticket}`,
            action: 'Ofrecer upsell',
            customer_id: row.id,
            agent_name: row.agent_name,
        });
    }

    // 4. High-value open conversations (potential close)
    const hotLeads = await db.query(`
        SELECT c.id AS conversation_id, cu.display_name AS customer_name,
               SUM(o.total_amount) AS historical_value,
               a.name AS agent_name
        FROM conversations c
        JOIN customers cu ON cu.id = c.customer_id
        LEFT JOIN agents a ON a.id = c.assigned_agent_id
        LEFT JOIN orders o ON o.customer_id = cu.id
        WHERE c.status = 'open'
        GROUP BY c.id, cu.display_name, a.name
        HAVING SUM(o.total_amount) > 2000
        ORDER BY historical_value DESC
        LIMIT 5
    `);
    for (const row of hotLeads.rows) {
        alerts.push({
            id: `hot_${row.conversation_id}`,
            type: 'opportunity',
            category: 'hot_lead',
            text: `${row.customer_name} tiene historial de $${row.historical_value} — conversación abierta ahora`,
            action: 'Atender ahora',
            conversation_id: row.conversation_id,
            agent_name: row.agent_name,
        });
    }

    res.json(alerts);
});

// POST /api/alerts/run-cron  — manually trigger the alert cron (for testing)
router.post('/run-cron', requireAuth, async (_req: Request, res: Response) => {
    await runAlertsCron();
    res.json({ ok: true });
});

// ─── Cron job (call this from index.ts with node-cron) ───────────────────────
export async function runAlertsCron(): Promise<void> {
    try {
        // Find conversations waiting > 15 min and emit socket alerts
        const waiting = await db.query(`
            SELECT c.id, cu.display_name
            FROM conversations c
            JOIN customers cu ON cu.id = c.customer_id
            JOIN messages m ON m.conversation_id = c.id AND m.direction = 'inbound'
            WHERE c.status = 'open'
            GROUP BY c.id, cu.display_name
            HAVING EXTRACT(EPOCH FROM (NOW() - MAX(m.created_at))) / 60 > 15
        `);

        for (const row of waiting.rows) {
            emitAlert({
                type: 'danger',
                category: 'waiting',
                text: `${row.display_name} lleva más de 15 min sin respuesta`,
                conversation_id: row.id,
            });
        }
    } catch (err) {
        console.error('Alerts cron error:', err);
    }
}

export default router;
