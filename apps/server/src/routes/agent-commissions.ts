/**
 * Agent Commissions Routes
 *
 * GET  /api/agent-commissions/:agentId           — Commission summary for an agent
 * GET  /api/agent-commissions/:agentId/history    — Monthly commission history
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { getAgentCommissions } from '../services/woocommerce';

const router = Router();

// ─────────────────────────────────────────────
// GET /api/agent-commissions/:agentId — Commission summary
// ─────────────────────────────────────────────
router.get('/:agentId', async (req: Request, res: Response) => {
    try {
        // Get the agent's WC user ID from our agents table
        const agent = await db.query(
            `SELECT id, name, email FROM agents WHERE id = $1`,
            [req.params.agentId]
        );

        if (agent.rows.length === 0) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }

        // Get CRM-side metrics
        const crmMetrics = await db.query(
            `SELECT
                COUNT(DISTINCT conv.id) FILTER (WHERE conv.status = 'resolved') AS resolved_conversations,
                COUNT(DISTINCT conv.id) FILTER (WHERE conv.status IN ('open', 'pending')) AS active_conversations,
                COUNT(DISTINCT he.id) AS handoffs_received,
                (SELECT COUNT(*) FROM orders o
                 JOIN conversations c ON c.customer_id = o.customer_id
                 WHERE c.assigned_agent_id = $1
                   AND o.order_date >= DATE_TRUNC('month', NOW())
                ) AS orders_this_month,
                (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o
                 JOIN conversations c ON c.customer_id = o.customer_id
                 WHERE c.assigned_agent_id = $1
                   AND o.order_date >= DATE_TRUNC('month', NOW())
                ) AS revenue_this_month
             FROM conversations conv
             LEFT JOIN handoff_events he ON he.to_agent_id = $1
             WHERE conv.assigned_agent_id = $1`,
            [req.params.agentId]
        );

        // Try to get SalesKing commissions (needs WC user mapping)
        let commissions = { earnings_total: 0, earnings_pending: 0, earnings_paid: 0, orders_count: 0 };

        // Look up WC user ID from agent email
        const agentEmail = agent.rows[0].email;
        try {
            // Try to find WC customer/user by email
            const wcUserIdAttr = await db.query(
                `SELECT value FROM customer_attributes
                 WHERE customer_id = (SELECT id FROM customers WHERE display_name = $1 LIMIT 1)
                   AND key = 'wc_user_id'
                 LIMIT 1`,
                [agent.rows[0].name]
            );

            if (wcUserIdAttr.rows.length > 0) {
                commissions = await getAgentCommissions(Number(wcUserIdAttr.rows[0].value));
            }
        } catch {
            // SalesKing data unavailable — use CRM-only metrics
        }

        res.json({
            agent: agent.rows[0],
            crm_metrics: crmMetrics.rows[0] || {},
            commissions,
        });
    } catch (err) {
        console.error('[Agent Commissions] Error:', err);
        res.status(500).json({ error: 'Error fetching commission data' });
    }
});

// ─────────────────────────────────────────────
// GET /api/agent-commissions/:agentId/history — Monthly history
// ─────────────────────────────────────────────
router.get('/:agentId/history', async (req: Request, res: Response) => {
    const { months = '6' } = req.query;

    try {
        const result = await db.query(
            `SELECT
                DATE_TRUNC('month', o.order_date) AS month,
                COUNT(DISTINCT o.id) AS orders,
                COALESCE(SUM(o.total_amount), 0) AS revenue,
                COUNT(DISTINCT conv.id) AS conversations_handled
             FROM orders o
             JOIN conversations conv ON conv.customer_id = o.customer_id
                AND conv.assigned_agent_id = $1
             WHERE o.order_date >= NOW() - INTERVAL '1 month' * $2
             GROUP BY DATE_TRUNC('month', o.order_date)
             ORDER BY month DESC`,
            [req.params.agentId, Number(months)]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('[Agent Commissions] History error:', err);
        res.status(500).json({ error: 'Error fetching commission history' });
    }
});

export default router;
