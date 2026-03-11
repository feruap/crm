import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// GET /api/events
router.get('/', async (req: Request, res: Response) => {
    const { agent_id, start, end, customer_id } = req.query;

    let query = `
        SELECT e.*, cu.display_name as customer_name, a.name as agent_name
        FROM events e
        LEFT JOIN customers cu ON cu.id = e.customer_id
        LEFT JOIN agents a ON a.id = e.agent_id
        WHERE 1=1
    `;
    const params: any[] = [];

    if (agent_id) {
        params.push(agent_id);
        query += ` AND e.agent_id = $${params.length}`;
    }
    if (customer_id) {
        params.push(customer_id);
        query += ` AND e.customer_id = $${params.length}`;
    }
    if (start) {
        params.push(start);
        query += ` AND e.start_at >= $${params.length}`;
    }
    if (end) {
        params.push(end);
        query += ` AND e.start_at <= $${params.length}`;
    }

    query += ` ORDER BY e.start_at ASC`;

    const result = await db.query(query, params);
    res.json(result.rows);
});

// POST /api/events
router.post('/', async (req: Request, res: Response) => {
    const { title, start_at, end_at, customer_id, conversation_id, event_type, notes, all_day = false } = req.body;
    const agentId = req.agent?.agentId;

    if (!title || !start_at) {
        res.status(400).json({ error: 'Title and start_at are required' });
        return;
    }

    const result = await db.query(
        `INSERT INTO events (title, description, agent_id, customer_id, conversation_id, start_at, end_at, all_day, event_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [title, notes, agentId, customer_id, conversation_id, start_at, end_at, all_day, event_type, notes]
    );

    res.status(201).json(result.rows[0]);
});

// PUT /api/events/:id
router.put('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, start_at, end_at, customer_id, event_type, notes, status, all_day } = req.body;

    const result = await db.query(
        `UPDATE events 
         SET title = COALESCE($1, title),
             start_at = COALESCE($2, start_at),
             end_at = COALESCE($3, end_at),
             customer_id = COALESCE($4, customer_id),
             event_type = COALESCE($5, event_type),
             notes = COALESCE($6, notes),
             status = COALESCE($7, status),
             all_day = COALESCE($8, all_day)
         WHERE id = $9
         RETURNING *`,
        [title, start_at, end_at, customer_id, event_type, notes, status, all_day, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
});

// DELETE /api/events/:id
router.delete('/:id', async (req: Request, res: Response) => {
    await db.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
});

// GET /api/event-templates
router.get('/templates', async (req: Request, res: Response) => {
    const result = await db.query('SELECT * FROM event_templates ORDER BY title ASC');
    res.json(result.rows);
});

// POST /api/event-templates
router.post('/templates', async (req: Request, res: Response) => {
    const { title, description, duration_minutes, event_type } = req.body;
    const agentId = req.agent?.agentId;

    const result = await db.query(
        `INSERT INTO event_templates (title, description, duration_minutes, event_type, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [title, description, duration_minutes, event_type, agentId]
    );

    res.status(201).json(result.rows[0]);
});

// POST /api/events/from-template/:templateId
router.post('/from-template/:templateId', async (req: Request, res: Response) => {
    const { templateId } = req.params;
    const { start_at, customer_id, conversation_id } = req.body;
    const agentId = req.agent?.agentId;

    const template = await db.query('SELECT * FROM event_templates WHERE id = $1', [templateId]);
    if (template.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    const t = template.rows[0];
    const startDate = new Date(start_at);
    const endDate = new Date(startDate.getTime() + t.duration_minutes * 60000);

    const result = await db.query(
        `INSERT INTO events (title, description, agent_id, customer_id, conversation_id, start_at, end_at, event_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [t.title, t.description, agentId, customer_id, conversation_id, start_at, endDate, t.event_type]
    );

    res.status(201).json(result.rows[0]);
});

export default router;
