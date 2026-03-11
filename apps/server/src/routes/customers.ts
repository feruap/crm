import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import os from 'os';

const upload = multer({ dest: os.tmpdir() });

const router = Router();
router.use(requireAuth);

// GET /api/customers — list with pagination & filters
router.get('/', async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const label = req.query.label as string;

    let query = `
        SELECT cu.*, 
               (SELECT count(*) FROM conversations conv WHERE conv.customer_id = cu.id) as conversation_count,
               (SELECT conversation_label FROM conversations conv WHERE conv.customer_id = cu.id ORDER BY updated_at DESC LIMIT 1) as last_label
        FROM customers cu
        WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
        params.push(`%${search}%`);
        query += ` AND (cu.display_name ILIKE $${params.length} OR EXISTS (SELECT 1 FROM external_identities ei WHERE ei.customer_id = cu.id AND ei.provider_id ILIKE $${params.length}))`;
    }

    if (label) {
        params.push(label);
        query += ` AND EXISTS (SELECT 1 FROM conversations conv WHERE conv.customer_id = cu.id AND conv.conversation_label = $${params.length})`;
    }

    // Count total
    const countResult = await db.query(`SELECT count(*) FROM (${query}) as sub`, params);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    query += ` ORDER BY cu.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
        data: result.rows,
        total,
        page,
        limit
    });
});

// GET /api/customers/:id  — full 360 profile
router.get('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    const [customerQ, identitiesQ, ordersQ, attrsQ, convsQ, insightQ, attributionQ] = await Promise.all([
        db.query(`SELECT * FROM customers WHERE id = $1`, [id]),

        db.query(`SELECT provider, provider_id, metadata FROM external_identities WHERE customer_id = $1`, [id]),

        db.query(`
            SELECT o.*, a.campaign_id,
                   c.name AS campaign_name, c.platform AS campaign_platform
            FROM orders o
            LEFT JOIN attributions a ON a.order_id = o.id
            LEFT JOIN campaigns c ON c.id = a.campaign_id
            WHERE o.customer_id = $1
            ORDER BY o.order_date DESC`, [id]),

        db.query(`SELECT key, value, attribute_type FROM customer_attributes WHERE customer_id = $1`, [id]),

        db.query(`
            SELECT conv.id, conv.status, conv.created_at, conv.updated_at,
                   ch.name AS channel_name, ch.provider AS channel_provider,
                   ag.name AS agent_name,
                   (SELECT content FROM messages m WHERE m.conversation_id = conv.id
                    ORDER BY m.created_at DESC LIMIT 1) AS last_message
            FROM conversations conv
            LEFT JOIN channels ch ON ch.id = conv.channel_id
            LEFT JOIN agents ag ON ag.id = conv.assigned_agent_id
            WHERE conv.customer_id = $1
            ORDER BY conv.updated_at DESC
            LIMIT 10`, [id]),

        db.query(`SELECT * FROM ai_insights WHERE customer_id = $1 ORDER BY updated_at DESC LIMIT 1`, [id]),

        db.query(`
            SELECT a.*, c.name AS campaign_name, c.platform
            FROM attributions a
            JOIN campaigns c ON c.id = a.campaign_id
            WHERE a.customer_id = $1
            ORDER BY a.attributed_at DESC
            LIMIT 1`, [id]),
    ]);

    if (customerQ.rows.length === 0) {
        res.status(404).json({ error: 'Customer not found' });
        return;
    }

    const customer = customerQ.rows[0];
    const orders = ordersQ.rows;
    const totalSpent = orders.reduce((s: number, o: any) => s + Number(o.total_amount), 0);

    res.json({
        ...customer,
        identities: identitiesQ.rows,
        attributes: attrsQ.rows,
        orders,
        total_spent: totalSpent,
        past_conversations: convsQ.rows,
        ai_insight: insightQ.rows[0] ?? null,
        last_attribution: attributionQ.rows[0] ?? null,
    });
});

// GET /api/customers/:id/attributes/:key
router.get('/:id/attributes/:key', async (req: Request, res: Response) => {
    const { id, key } = req.params;
    const result = await db.query(
        'SELECT value FROM customer_attributes WHERE customer_id = $1 AND key = $2',
        [id, key]
    );
    res.json(result.rows[0] || { value: '' });
});

// PUT /api/customers/:id/attributes/:key
router.put('/:id/attributes/:key', async (req: Request, res: Response) => {
    const { id, key } = req.params;
    const { value, attribute_type = 'string' } = req.body;

    await db.query(
        `INSERT INTO customer_attributes (customer_id, key, value, attribute_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (customer_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [id, key, value, attribute_type]
    );
    res.json({ ok: true });
});

// PUT /api/customers/:id — update profile
router.put('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { display_name, avatar_url } = req.body;

    const result = await db.query(
        `UPDATE customers 
         SET display_name = COALESCE($1, display_name),
             avatar_url = COALESCE($2, avatar_url),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [display_name, avatar_url, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
});

// POST /api/customers/import — CSV import
router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const results: any[] = [];
    let created = 0;

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            try {
                for (const row of results) {
                    const name = row.name || row.display_name;
                    const phone = row.phone || row.whatsapp;

                    if (!name) continue;

                    // 1. Create customer
                    const custRes = await db.query(
                        'INSERT INTO customers (display_name) VALUES ($1) RETURNING id',
                        [name]
                    );
                    const customerId = custRes.rows[0].id;

                    // 2. Create identity if phone exists
                    if (phone) {
                        await db.query(
                            'INSERT INTO external_identities (customer_id, provider, provider_id) VALUES ($1, $2, $3)',
                            [customerId, 'whatsapp', phone]
                        );
                    }
                    created++;
                }
                fs.unlinkSync(req.file!.path);
                res.json({ ok: true, created });
            } catch (err) {
                console.error(err);
                if (fs.existsSync(req.file!.path)) fs.unlinkSync(req.file!.path);
                res.status(500).json({ error: 'Import failed' });
            }
        });
});

export default router;
