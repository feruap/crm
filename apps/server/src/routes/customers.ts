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


// PUT /api/customers/:id/shipping ? bulk-save WooCommerce shipping fields
router.put('/:id/shipping', async (req, res) => {
    const { id } = req.params;
    const fields = req.body; // { first_name, last_name, address_1, ... }
    const ALLOWED = ['first_name','last_name','email','phone','address_1','address_2','city','state','postcode','country','wc_customer_id'];
    
    const entries = Object.entries(fields).filter(([k]) => ALLOWED.includes(k));
    if (entries.length === 0) return res.status(400).json({ error: 'No valid fields' });
    
    for (const [key, value] of entries) {
        await db.query(
            `INSERT INTO customer_attributes (customer_id, key, value, attribute_type)
             VALUES ($1, $2, $3, 'string')
             ON CONFLICT (customer_id, key) DO UPDATE SET value = EXCLUDED.value`,
            [id, key, String(value)]
        );
    }
    
    // Also update display_name if first_name/last_name provided
    if (fields.first_name || fields.last_name) {
        const name = [fields.first_name || '', fields.last_name || ''].join(' ').trim();
        if (name) {
            await db.query('UPDATE customers SET display_name = $1 WHERE id = $2', [name, id]);
        }
    }
    
    res.json({ ok: true, saved: entries.length });
});

// POST /api/customers/:id/wc-sync ? search or create WooCommerce customer
router.post('/:id/wc-sync', async (req, res) => {
    const { id } = req.params;
    const { shipping } = req.body; // WC shipping fields from frontend
    
    const wcUrl = process.env.WC_URL;
    const wcKey = process.env.WC_KEY;
    const wcSecret = process.env.WC_SECRET;
    if (!wcUrl || !wcKey || !wcSecret) {
        return res.status(503).json({ error: 'WooCommerce not configured' });
    }
    const wcAuth = Buffer.from(`${wcKey}:${wcSecret}`).toString('base64');
    
    // Get current customer data
    const custRow = await db.query('SELECT display_name FROM customers WHERE id = $1', [id]);
    if (custRow.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    
    const attrs = await db.query('SELECT key, value FROM customer_attributes WHERE customer_id = $1', [id]);
    const attrMap: Record<string, string> = {};
    for (const row of attrs.rows) attrMap[row.key] = row.value;
    
    // Check if already linked
    if (attrMap['wc_customer_id']) {
        return res.json({ 
            status: 'already_linked', 
            wc_customer_id: parseInt(attrMap['wc_customer_id']),
            message: 'Customer already linked to WooCommerce'
        });
    }
    
    const email = shipping?.email || attrMap['email'] || '';
    const phone = shipping?.phone || attrMap['phone'] || '';
    
    // Search WC by email first, then by phone (billing_phone meta)
    let wcCustomer = null;
    
    if (email) {
        const searchResp = await fetch(`${wcUrl}/wp-json/wc/v3/customers?email=${encodeURIComponent(email)}&per_page=1`, {
            headers: { Authorization: `Basic ${wcAuth}` }
        });
        const results = await searchResp.json();
        if (Array.isArray(results) && results.length > 0) wcCustomer = results[0];
    }
    
    if (!wcCustomer && phone) {
        // Normalize phone: extract 10-digit local number (handles MX formats)
        const phoneDigits = phone.replace(/\D/g, '');
        let phoneLocal = phoneDigits;
        if (phoneDigits.startsWith('521') && phoneDigits.length === 13) {
            phoneLocal = phoneDigits.slice(3); // +52 1 XXXXXXXXXX
        } else if (phoneDigits.startsWith('52') && phoneDigits.length === 12) {
            phoneLocal = phoneDigits.slice(2); // +52 XXXXXXXXXX
        } else if (phoneDigits.length > 10) {
            phoneLocal = phoneDigits.slice(-10);
        }

        // Search with multiple phone variants
        const phoneVariants = new Set([phoneLocal, phoneDigits, phone]);
        for (const pv of phoneVariants) {
            if (wcCustomer) break;
            const searchResp = await fetch(`${wcUrl}/wp-json/wc/v3/customers?search=${encodeURIComponent(pv)}&per_page=10`, {
                headers: { Authorization: `Basic ${wcAuth}` }
            });
            const results = await searchResp.json();
            if (Array.isArray(results)) {
                wcCustomer = results.find((c: any) => {
                    const billingLocal = c.billing?.phone?.replace(/\D/g, '').slice(-10);
                    const shippingLocal = c.shipping?.phone?.replace(/\D/g, '').slice(-10);
                    return billingLocal === phoneLocal || shippingLocal === phoneLocal;
                }) || null;
            }
        }
    }
    
    if (wcCustomer) {
        // Found existing ? link and import their data
        await db.query(
            `INSERT INTO customer_attributes (customer_id, key, value, attribute_type)
             VALUES ($1, 'wc_customer_id', $2, 'string')
             ON CONFLICT (customer_id, key) DO UPDATE SET value = EXCLUDED.value`,
            [id, String(wcCustomer.id)]
        );
        
        // Import WC shipping fields back
        const wcShipping = wcCustomer.shipping || wcCustomer.billing || {};
        const importFields = ['first_name','last_name','address_1','address_2','city','state','postcode','country'];
        for (const key of importFields) {
            if (wcShipping[key]) {
                await db.query(
                    `INSERT INTO customer_attributes (customer_id, key, value, attribute_type)
                     VALUES ($1, $2, $3, 'string')
                     ON CONFLICT (customer_id, key) DO UPDATE SET value = EXCLUDED.value`,
                    [id, key, wcShipping[key]]
                );
            }
        }
        
        return res.json({
            status: 'found',
            wc_customer_id: wcCustomer.id,
            imported_shipping: wcShipping,
            message: `Found existing WC customer #${wcCustomer.id}`
        });
    }
    
    // Not found ? create new WC customer
    const firstName = shipping?.first_name || custRow.rows[0].display_name?.split(' ')[0] || 'Cliente';
    const lastName = shipping?.last_name || custRow.rows[0].display_name?.split(' ').slice(1).join(' ') || '';
    
    // Auto-generate email if missing (WC requires email)
    const customerEmail = email || `customer-${id}@placeholder.myalice.local`;
    
    // Auto-generate username and password for WP account
    const username = customerEmail.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '') + '-' + Date.now().toString(36);
    const password = 'CRM-' + Math.random().toString(36).substring(2, 10) + '!' + Date.now().toString(36).slice(-4);
    
    const wcBody = {
        email: customerEmail,
        username: username,
        password: password,
        first_name: firstName,
        last_name: lastName,
        billing: {
            first_name: firstName,
            last_name: lastName,
            email: customerEmail,
            phone: phone,
            address_1: shipping?.address_1 || '',
            address_2: shipping?.address_2 || '',
            city: shipping?.city || '',
            state: shipping?.state || '',
            postcode: shipping?.postcode || '',
            country: shipping?.country || 'MX',
        },
        shipping: {
            first_name: firstName,
            last_name: lastName,
            address_1: shipping?.address_1 || '',
            address_2: shipping?.address_2 || '',
            city: shipping?.city || '',
            state: shipping?.state || '',
            postcode: shipping?.postcode || '',
            country: shipping?.country || 'MX',
        },
    };
    
    try {
        const createResp = await fetch(`${wcUrl}/wp-json/wc/v3/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Basic ${wcAuth}` },
            body: JSON.stringify(wcBody),
        });
        
        if (!createResp.ok) {
            const errText = await createResp.text();
            console.error('WC customer creation failed:', errText);
            return res.status(502).json({ error: 'WC customer creation failed', detail: errText });
        }
        
        const newCustomer = await createResp.json();
        
        // Save wc_customer_id
        await db.query(
            `INSERT INTO customer_attributes (customer_id, key, value, attribute_type)
             VALUES ($1, 'wc_customer_id', $2, 'string')
             ON CONFLICT (customer_id, key) DO UPDATE SET value = EXCLUDED.value`,
            [id, String(newCustomer.id)]
        );
        
        return res.json({
            status: 'created',
            wc_customer_id: newCustomer.id,
            username: newCustomer.username,
            message: `Created WC customer #${newCustomer.id} (username: ${newCustomer.username})`
        });
    } catch (err) {
        console.error('WC sync error:', err);
        return res.status(500).json({ error: 'WC sync failed', detail: String(err) });
    }
});


export default router;
