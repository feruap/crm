import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// GET /api/analytics/summary
router.get('/summary', async (req: Request, res: Response) => {
    const { from, to } = req.query;

    const fromDate = from || '1970-01-01';
    const toDate = to || '2100-01-01';

    const summary = await db.query(`
        SELECT 
            (SELECT COUNT(*) FROM conversations WHERE created_at BETWEEN $1 AND $2) as new_conversations,
            (SELECT COUNT(*) FROM conversations WHERE status = 'resolved' AND updated_at BETWEEN $1 AND $2) as resolved,
            (SELECT COUNT(*) FROM messages WHERE direction = 'outbound' AND created_at BETWEEN $1 AND $2) as messages_sent,
            (SELECT COUNT(*) FROM messages WHERE direction = 'inbound' AND created_at BETWEEN $1 AND $2) as messages_received,
            (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at))/60), 0)
             FROM messages m1
             JOIN messages m2 ON m1.conversation_id = m2.conversation_id
             WHERE m1.direction = 'inbound' AND m2.direction = 'outbound' 
               AND m2.created_at > m1.created_at
               AND m2.created_at BETWEEN $1 AND $2) as avg_response_time_minutes,
            (SELECT COUNT(*) FROM conversations WHERE is_stagnant = TRUE) as stagnant_count
    `, [fromDate, toDate]);

    const labels = await db.query(`
        SELECT conversation_label, COUNT(*) as count
        FROM conversations
        WHERE conversation_label IS NOT NULL
        GROUP BY conversation_label
        ORDER BY count DESC
    `);

    res.json({
        new_conversations: parseInt(summary.rows[0].new_conversations),
        resolved: parseInt(summary.rows[0].resolved),
        messages_sent: parseInt(summary.rows[0].messages_sent),
        messages_received: parseInt(summary.rows[0].messages_received),
        avg_response_time_minutes: parseFloat(summary.rows[0].avg_response_time_minutes),
        stagnant_count: parseInt(summary.rows[0].stagnant_count),
        label_breakdown: labels.rows.map(r => ({ label: r.conversation_label, count: parseInt(r.count) }))
    });
});

// GET /api/analytics/by-agent
router.get('/by-agent', async (req: Request, res: Response) => {
    const { from, to } = req.query;
    const fromDate = from || '1970-01-01';
    const toDate = to || '2100-01-01';

    const result = await db.query(`
        SELECT 
            a.id as agent_id, a.name,
            COUNT(DISTINCT c.id) FILTER (WHERE c.created_at BETWEEN $1 AND $2) as new_conversations,
            COUNT(m.id) FILTER (WHERE m.direction = 'outbound' AND m.created_at BETWEEN $1 AND $2) as messages_sent,
            COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'resolved' AND c.updated_at BETWEEN $1 AND $2) as resolved,
            COUNT(DISTINCT c.id) FILTER (WHERE c.is_starred = TRUE) as starred
        FROM agents a
        LEFT JOIN conversations c ON c.assigned_agent_id = a.id
        LEFT JOIN messages m ON m.conversation_id = c.id
        GROUP BY a.id, a.name
    `, [fromDate, toDate]);

    res.json(result.rows.map(r => ({
        ...r,
        new_conversations: parseInt(r.new_conversations),
        messages_sent: parseInt(r.messages_sent),
        resolved: parseInt(r.resolved),
        starred: parseInt(r.starred)
    })));
});

export default router;
