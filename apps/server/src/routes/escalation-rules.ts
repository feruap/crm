/**
 * Escalation Rules Routes
 *
 * CRUD for escalation rules + customer segments + handoff history.
 *
 * GET    /api/escalation-rules              — List all rules
 * POST   /api/escalation-rules              — Create rule
 * PUT    /api/escalation-rules/:id          — Update rule
 * DELETE /api/escalation-rules/:id          — Delete rule
 * GET    /api/escalation-rules/handoff-log  — Recent handoff events
 * GET    /api/escalation-rules/segments     — Customer segments overview
 * POST   /api/escalation-rules/recalculate  — Recalculate all segments
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { recalculateCustomerSegments } from '../services/purchase-history-engine';

const router = Router();

// ─────────────────────────────────────────────
// Rules CRUD
// ─────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response) => {
    try {
        const result = await db.query(
            `SELECT er.*,
                    (SELECT COUNT(*) FROM handoff_events he WHERE he.escalation_rule_id = er.id) AS times_triggered
             FROM escalation_rules er
             ORDER BY er.priority DESC, er.name`
        );
        res.json(result.rows);
    } catch (err: unknown) {
        console.error('[escalation-rules] Error loading rules:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        // If table doesn't exist, return empty array instead of error
        if (message.includes('does not exist') || message.includes('relation')) {
            res.json([]);
        } else {
            res.status(500).json({ error: 'Error cargando reglas de escalación', detail: message });
        }
    }
});

router.post('/', async (req: Request, res: Response) => {
    const { name, description, condition_type, condition_config, target_type, target_id, target_role, priority, generate_summary, escalation_message } = req.body;

    if (!name || !condition_type) {
        res.status(400).json({ error: 'name and condition_type are required' });
        return;
    }

    const result = await db.query(
        `INSERT INTO escalation_rules (name, description, condition_type, condition_config, target_type, target_id, target_role, priority, generate_summary, escalation_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [name, description, condition_type, JSON.stringify(condition_config || {}), target_type || 'any_available', target_id, target_role, priority || 0, generate_summary !== false, escalation_message || null]
    );
    res.status(201).json(result.rows[0]);
});

router.put('/:id', async (req: Request, res: Response) => {
    const { name, description, condition_type, condition_config, target_type, target_id, target_role, priority, generate_summary, is_active, escalation_message } = req.body;

    const result = await db.query(
        `UPDATE escalation_rules SET
             name = COALESCE($1, name),
             description = COALESCE($2, description),
             condition_type = COALESCE($3, condition_type),
             condition_config = COALESCE($4, condition_config),
             target_type = COALESCE($5, target_type),
             target_id = $6,
             target_role = $7,
             priority = COALESCE($8, priority),
             generate_summary = COALESCE($9, generate_summary),
             is_active = COALESCE($10, is_active),
             escalation_message = $11
         WHERE id = $12
         RETURNING *`,
        [name, description, condition_type, condition_config ? JSON.stringify(condition_config) : null, target_type, target_id, target_role, priority, generate_summary, is_active, escalation_message !== undefined ? escalation_message : null, req.params.id]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Rule not found' });
        return;
    }
    res.json(result.rows[0]);
});

router.delete('/:id', async (req: Request, res: Response) => {
    const result = await db.query(`DELETE FROM escalation_rules WHERE id = $1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Rule not found' });
        return;
    }
    res.json({ ok: true });
});

// ─────────────────────────────────────────────
// Handoff Log
// ─────────────────────────────────────────────

router.get('/handoff-log', async (req: Request, res: Response) => {
    try {
        const { limit = '50' } = req.query;

        const result = await db.query(
            `SELECT he.*,
                    c.display_name AS customer_name,
                    a.name AS agent_name,
                    er.name AS rule_name
             FROM handoff_events he
             LEFT JOIN conversations conv ON conv.id = he.conversation_id
             LEFT JOIN customers c ON c.id = conv.customer_id
             LEFT JOIN agents a ON a.id = he.to_agent_id
             LEFT JOIN escalation_rules er ON er.id = he.escalation_rule_id
             ORDER BY he.created_at DESC
             LIMIT $1`,
            [Number(limit)]
        );
        res.json(result.rows);
    } catch (err: unknown) {
        console.error('[escalation-rules] Error loading handoff log:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.includes('does not exist') || message.includes('relation')) {
            res.json([]);
        } else {
            res.status(500).json({ error: 'Error cargando historial de handoff', detail: message });
        }
    }
});

// ─────────────────────────────────────────────
// Customer Segments
// ─────────────────────────────────────────────

router.get('/segments', async (req: Request, res: Response) => {
    try {
        const { segment_type } = req.query;

        let query = `
            SELECT cs.segment_type, cs.segment_value, COUNT(*) AS customer_count,
                   AVG((cs.metadata->>'lifetime_spend')::numeric) AS avg_lifetime_spend
            FROM customer_segments cs
        `;
        const params: unknown[] = [];

        if (segment_type) {
            params.push(segment_type);
            query += ` WHERE cs.segment_type = $${params.length}`;
        }

        query += ` GROUP BY cs.segment_type, cs.segment_value ORDER BY cs.segment_type, customer_count DESC`;

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err: unknown) {
        console.error('[escalation-rules] Error loading segments:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.includes('does not exist') || message.includes('relation')) {
            res.json([]);
        } else {
            res.status(500).json({ error: 'Error cargando segmentos', detail: message });
        }
    }
});

router.post('/recalculate', async (_req: Request, res: Response) => {
    const result = await recalculateCustomerSegments();
    res.json(result);
});

export default router;
