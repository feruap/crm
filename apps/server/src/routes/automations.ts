import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
    try {
        const result = await db.query('SELECT * FROM automations ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req: Request, res: Response) => {
    const { name, trigger_type, conditions, actions, is_active } = req.body;
    try {
        const result = await db.query(
            `INSERT INTO automations (name, trigger_type, conditions, actions, is_active)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, trigger_type, JSON.stringify(conditions), JSON.stringify(actions), is_active]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    const { name, trigger_type, conditions, actions, is_active } = req.body;
    try {
        const result = await db.query(
            `UPDATE automations
             SET name = $1, trigger_type = $2, conditions = $3, actions = $4, is_active = $5, updated_at = NOW()
             WHERE id = $6 RETURNING *`,
            [name, trigger_type, JSON.stringify(conditions), JSON.stringify(actions), is_active, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    try {
        const result = await db.query(`DELETE FROM automations WHERE id = $1 RETURNING id`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ message: 'Deleted' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
