import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// POST /api/attributions  — vincula customer + campaign + conversation (al primer contacto)
router.post('/', async (req: Request, res: Response) => {
    const { customer_id, campaign_id, conversation_id, gclid } = req.body;
    const result = await db.query(
        `INSERT INTO attributions (customer_id, campaign_id, conversation_id, gclid)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [customer_id, campaign_id, conversation_id, gclid ?? null]
    );
    res.status(201).json(result.rows[0]);
});

// PATCH /api/attributions/:id/order  — adjunta orden a una atribución existente
router.patch('/:id/order', async (req: Request, res: Response) => {
    const { order_id, woocommerce_order_id } = req.body;
    await db.query(
        `UPDATE attributions
         SET order_id = $1, woocommerce_order_id = $2, woocommerce_synced = FALSE
         WHERE id = $3`,
        [order_id, woocommerce_order_id, req.params.id]
    );
    res.json({ ok: true });
});

// ─── GET /api/attributions/summary  ─────────────────────────────────────────
// ROAS y ventas por campaña, segmentadas por sale_source
// Query param: period = '7d' | '30d' | '90d' | 'all' (default '30d')
router.get('/summary', async (req: Request, res: Response) => {
    const period = (req.query.period as string) ?? '30d';
    const intervalMap: Record<string, string> = {
        '7d': '7 days', '30d': '30 days', '90d': '90 days', 'all': '3650 days',
    };
    const interval = intervalMap[period] ?? '30 days';

    const result = await db.query(`
        WITH period_spend AS (
            SELECT campaign_id, SUM(spend_amount) AS total
            FROM campaign_daily_spend
            WHERE spend_date >= CURRENT_DATE - INTERVAL '${interval}'
            GROUP BY campaign_id
        )
        SELECT
            ca.id                                                                    AS campaign_id,
            ca.name                                                                  AS campaign_name,
            ca.platform,
            ca.daily_budget,
            -- Prefer period-aware daily spend; fallback to manually-entered total_spend
            COALESCE(ps.total, ca.total_spend, 0)                                   AS total_spend,
            ca.spend_currency,
            ca.spend_last_synced_at,
            COUNT(DISTINCT at2.conversation_id)                                      AS total_leads,
            COUNT(DISTINCT at2.id) FILTER (WHERE at2.sale_source = 'woocommerce')   AS wc_sales_count,
            COUNT(DISTINCT at2.id) FILTER (WHERE at2.sale_source = 'salesking')     AS sk_sales_count,
            COUNT(DISTINCT at2.id) FILTER (WHERE at2.sale_source = 'manual')        AS manual_sales_count,
            COALESCE(SUM(at2.sale_amount) FILTER (WHERE at2.sale_source = 'woocommerce'), 0) AS wc_revenue,
            COALESCE(SUM(at2.sale_amount) FILTER (WHERE at2.sale_source = 'salesking'),     0) AS sk_revenue,
            COALESCE(SUM(at2.sale_amount) FILTER (WHERE at2.sale_source = 'manual'),        0) AS manual_revenue,
            COALESCE(SUM(at2.sale_amount), 0)                                        AS total_revenue,
            CASE
                WHEN COALESCE(ps.total, ca.total_spend, 0) > 0
                THEN ROUND(
                    COALESCE(SUM(at2.sale_amount), 0) / COALESCE(ps.total, ca.total_spend),
                    2
                )
                ELSE NULL
            END                                                                      AS roas
        FROM campaigns ca
        LEFT JOIN period_spend ps ON ps.campaign_id = ca.id
        LEFT JOIN attributions at2 ON at2.campaign_id = ca.id
            AND at2.attributed_at >= NOW() - INTERVAL '${interval}'
        GROUP BY ca.id, ps.total
        ORDER BY total_revenue DESC
    `);
    res.json(result.rows);
});

// ─── POST /api/attributions/woocommerce-sync  ───────────────────────────────
// Webhook público — WooCommerce llama aquí cuando se crea/actualiza una orden.
// Accepts BOTH native WC webhook payload (full order object) and custom format.
router.post('/woocommerce-sync', async (req: Request, res: Response) => {
    res.sendStatus(200); // responder rápido a WC

    try {
        // Detect if this is a native WC webhook (has 'id' and 'line_items') or custom format
        const isNativeWC = req.body.id && req.body.line_items;

        let order_id: string, order_total: string, currency: string;
        let customer_email: string, customer_phone: string;
        let meta_data: { key: string; value: string }[];
        let lineItems: any[] = [];
        let orderStatus: string;

        if (isNativeWC) {
            // Native WC webhook — full order object
            const o = req.body;
            order_id = String(o.id);
            order_total = o.total;
            currency = o.currency;
            customer_email = o.billing?.email || '';
            customer_phone = o.billing?.phone || '';
            meta_data = o.meta_data || [];
            lineItems = (o.line_items || []).map((li: any) => ({
                product_id: li.product_id,
                name: li.name,
                quantity: li.quantity,
                total: li.total,
            }));
            orderStatus = o.status || 'completed';
        } else {
            // Custom format (backward compat)
            order_id = req.body.order_id;
            order_total = req.body.order_total;
            currency = req.body.currency;
            customer_email = req.body.customer_email;
            customer_phone = req.body.customer_phone;
            meta_data = req.body.meta_data || [];
            orderStatus = 'completed';
        }

        // Extraer attribution_campaign_id de los meta_data si WC lo tiene
        const campaignMeta = meta_data.find((m: any) => m.key === '_attribution_campaign_id');

        // Buscar el customer por email o teléfono
        let customerId: string | null = null;

        if (customer_email) {
            const byEmail = await db.query(
                `SELECT ei.customer_id FROM external_identities ei
                 JOIN customers cu ON cu.id = ei.customer_id
                 WHERE ei.provider = 'woocommerce' AND ei.provider_id = $1
                 LIMIT 1`,
                [customer_email]
            );
            if (byEmail.rows.length > 0) customerId = byEmail.rows[0].customer_id;
        }

        if (!customerId && customer_phone) {
            const byPhone = await db.query(
                `SELECT customer_id FROM external_identities
                 WHERE provider = 'whatsapp' AND provider_id = $1 LIMIT 1`,
                [customer_phone.replace(/\D/g, '')]
            );
            if (byPhone.rows.length > 0) customerId = byPhone.rows[0].customer_id;
        }

        if (!customerId) {
            console.log(`[WC Sync] No customer found for order ${order_id}`);
            return;
        }

        // Insertar en orders si no existe
        const dbStatus = orderStatus === 'completed' || orderStatus === 'processing' ? 'completed' : orderStatus;
        await db.query(
            `INSERT INTO orders (customer_id, external_order_id, total_amount, currency, status, order_date, items)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)
             ON CONFLICT (external_order_id) DO UPDATE SET
                total_amount = EXCLUDED.total_amount,
                status       = EXCLUDED.status,
                items        = COALESCE(EXCLUDED.items, orders.items)`,
            [customerId, String(order_id), order_total, currency ?? 'MXN', dbStatus, lineItems.length > 0 ? JSON.stringify(lineItems) : null]
        );

        const orderRow = await db.query('SELECT id FROM orders WHERE external_order_id = $1', [String(order_id)]);
        const orderId = orderRow.rows[0]?.id;

        // Actualizar la atribución más reciente de este customer
        const attr = await db.query(
            `SELECT id FROM attributions
             WHERE customer_id = $1
             ORDER BY attributed_at DESC LIMIT 1`,
            [customerId]
        );

        if (attr.rows.length > 0) {
            await db.query(
                `UPDATE attributions
                 SET order_id             = $1,
                     woocommerce_order_id = $2,
                     sale_source          = 'woocommerce',
                     sale_amount          = $3,
                     sale_currency        = $4,
                     woocommerce_synced   = FALSE
                 WHERE id = $5`,
                [orderId, String(order_id), order_total, currency ?? 'MXN', attr.rows[0].id]
            );
        } else if (campaignMeta) {
            // Crear atribución nueva con campaña si viene en meta
            const campaign = await db.query(
                'SELECT id FROM campaigns WHERE platform_campaign_id = $1 LIMIT 1',
                [campaignMeta.value]
            );
            if (campaign.rows.length > 0) {
                await db.query(
                    `INSERT INTO attributions (customer_id, campaign_id, order_id, woocommerce_order_id, sale_source, sale_amount, sale_currency)
                     VALUES ($1, $2, $3, $4, 'woocommerce', $5, $6)`,
                    [customerId, campaign.rows[0].id, orderId, String(order_id), order_total, currency ?? 'MXN']
                );
            }
        }

        console.log(`[WC Sync] ✅ Order ${order_id} linked to customer ${customerId}`);
    } catch (err) {
        console.error('[WC Sync] Error:', err);
    }
});

// ─── POST /api/attributions/salesking-sync  ─────────────────────────────────
// Webhook público — SalesKing llama aquí cuando un agente cierra una venta
// Body: { order_id, order_total, currency, agent_code, customer_email, customer_phone }
router.post('/salesking-sync', async (req: Request, res: Response) => {
    res.sendStatus(200);

    try {
        const { order_id, order_total, currency, agent_code, customer_email, customer_phone } = req.body;

        // Buscar agente por salesking_agent_code
        let agentId: string | null = null;
        if (agent_code) {
            const agentRow = await db.query(
                'SELECT id FROM agents WHERE salesking_agent_code = $1 AND is_active = TRUE LIMIT 1',
                [agent_code]
            );
            if (agentRow.rows.length > 0) agentId = agentRow.rows[0].id;
        }

        // Buscar customer
        let customerId: string | null = null;
        if (customer_email) {
            const byEmail = await db.query(
                `SELECT ei.customer_id FROM external_identities ei
                 WHERE ei.provider = 'woocommerce' AND ei.provider_id = $1 LIMIT 1`,
                [customer_email]
            );
            if (byEmail.rows.length > 0) customerId = byEmail.rows[0].customer_id;
        }
        if (!customerId && customer_phone) {
            const byPhone = await db.query(
                `SELECT customer_id FROM external_identities
                 WHERE provider = 'whatsapp' AND provider_id = $1 LIMIT 1`,
                [customer_phone.replace(/\D/g, '')]
            );
            if (byPhone.rows.length > 0) customerId = byPhone.rows[0].customer_id;
        }

        if (!customerId) {
            console.log(`[SK Sync] No customer found for SK order ${order_id}`);
            return;
        }

        // Insertar orden
        await db.query(
            `INSERT INTO orders (customer_id, external_order_id, total_amount, currency, status, order_date)
             VALUES ($1, $2, $3, $4, 'completed', NOW())
             ON CONFLICT (external_order_id) DO UPDATE SET
                total_amount = EXCLUDED.total_amount,
                status       = 'completed'`,
            [customerId, `sk_${order_id}`, order_total, currency ?? 'MXN']
        );
        const orderRow = await db.query('SELECT id FROM orders WHERE external_order_id = $1', [`sk_${order_id}`]);
        const orderId = orderRow.rows[0]?.id;

        // Marcar conversación como deal cerrado por el agente
        if (agentId) {
            await db.query(
                `UPDATE conversations
                 SET deal_value      = $1,
                     deal_currency   = $2,
                     deal_closed_at  = NOW(),
                     deal_closed_by  = $3
                 WHERE customer_id = $4 AND status IN ('open','pending')
                 ORDER BY updated_at DESC LIMIT 1`,
                [order_total, currency ?? 'MXN', agentId, customerId]
            );
        }

        // Actualizar o crear atribución
        const attr = await db.query(
            `SELECT id FROM attributions WHERE customer_id = $1
             ORDER BY attributed_at DESC LIMIT 1`,
            [customerId]
        );

        if (attr.rows.length > 0) {
            await db.query(
                `UPDATE attributions
                 SET order_id       = $1,
                     sale_source    = 'salesking',
                     sale_amount    = $2,
                     sale_currency  = $3
                 WHERE id = $4`,
                [orderId, order_total, currency ?? 'MXN', attr.rows[0].id]
            );
        }

        console.log(`[SK Sync] ✅ SK order ${order_id} agent=${agentId}`);
    } catch (err) {
        console.error('[SK Sync] Error:', err);
    }
});

// ─── POST /api/attributions/sync-woocommerce  ───────────────────────────────
// Worker interno: empuja atribuciones no sincronizadas a WooCommerce
router.post('/sync-woocommerce', async (_req: Request, res: Response) => {
    const pending = await db.query(
        `SELECT a.*, o.external_order_id, ca.platform_campaign_id, ca.name AS campaign_name
         FROM attributions a
         JOIN orders o ON o.id = a.order_id
         JOIN campaigns ca ON ca.id = a.campaign_id
         WHERE a.woocommerce_synced = FALSE
           AND a.order_id IS NOT NULL`
    );

    const results = [];
    for (const row of pending.rows) {
        try {
            const wcUrl = process.env.WC_URL;
            const wcKey = process.env.WC_KEY;
            const wcSecret = process.env.WC_SECRET;
            if (!wcUrl || !wcKey || !wcSecret) {
                results.push({ id: row.id, ok: false, error: 'WooCommerce credentials not configured' });
                continue;
            }
            const auth = Buffer.from(`${wcKey}:${wcSecret}`).toString('base64');
            const response = await fetch(`${wcUrl}/wp-json/wc/v3/orders/${row.external_order_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
                body: JSON.stringify({
                    meta_data: [
                        { key: '_attribution_campaign_id', value: row.platform_campaign_id },
                        { key: '_attribution_campaign_name', value: row.campaign_name },
                        { key: '_attribution_source', value: 'myalice' },
                    ],
                }),
            });
            if (response.ok) {
                await db.query(
                    `UPDATE attributions SET woocommerce_synced = TRUE, woocommerce_synced_at = NOW() WHERE id = $1`,
                    [row.id]
                );
                results.push({ id: row.id, ok: true });
            } else {
                results.push({ id: row.id, ok: false, error: `WC returned ${response.status}` });
            }
        } catch (err) {
            results.push({ id: row.id, ok: false, error: String(err) });
        }
    }
    res.json({ processed: results.length, results });
});

// ─── POST /api/attributions/sync-google-ads  ────────────────────────────────
router.post('/sync-google-ads', async (_req: Request, res: Response) => {
    const {
        GOOGLE_ADS_CUSTOMER_ID, GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID,
        GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CONVERSION_ACTION_ID,
    } = process.env;

    if (!GOOGLE_ADS_CUSTOMER_ID || !GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_CLIENT_ID ||
        !GOOGLE_ADS_CLIENT_SECRET || !GOOGLE_ADS_REFRESH_TOKEN || !GOOGLE_ADS_CONVERSION_ACTION_ID) {
        res.status(503).json({ error: 'Google Ads credentials not configured' });
        return;
    }

    let accessToken: string;
    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_ADS_CLIENT_ID, client_secret: GOOGLE_ADS_CLIENT_SECRET,
                refresh_token: GOOGLE_ADS_REFRESH_TOKEN, grant_type: 'refresh_token',
            }),
        });
        if (!tokenRes.ok) throw new Error(`Token refresh failed: ${tokenRes.status}`);
        const tokenData: any = await tokenRes.json();
        accessToken = tokenData.access_token;
    } catch (err) {
        res.status(502).json({ error: `Google OAuth2 error: ${String(err)}` });
        return;
    }

    const pending = await db.query(
        `SELECT a.id, a.gclid, a.attributed_at, o.total_amount, o.currency
         FROM attributions a
         JOIN orders o ON o.id = a.order_id
         WHERE a.gclid IS NOT NULL AND a.google_ads_synced = FALSE AND a.order_id IS NOT NULL`
    );

    if (pending.rows.length === 0) { res.json({ processed: 0, results: [] }); return; }

    const conversionAction = `customers/${GOOGLE_ADS_CUSTOMER_ID}/conversionActions/${GOOGLE_ADS_CONVERSION_ACTION_ID}`;
    const conversions = pending.rows.map((row: any) => ({
        gclid: row.gclid, conversionAction,
        conversionDateTime: new Date(row.attributed_at).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '+00:00'),
        conversionValue: parseFloat(row.total_amount) || 0,
        currencyCode: row.currency || 'USD',
    }));

    const apiRes = await fetch(
        `https://googleads.googleapis.com/v18/customers/${GOOGLE_ADS_CUSTOMER_ID}:uploadClickConversions`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, 'developer-token': GOOGLE_ADS_DEVELOPER_TOKEN },
            body: JSON.stringify({ conversions, partialFailure: true }),
        }
    );

    const apiData: any = await apiRes.json();
    const results: object[] = [];
    if (apiRes.ok) {
        const failedIndices: Set<number> = new Set(
            (apiData.partialFailureError?.details ?? [])
                .flatMap((d: any) => d.errors?.map((e: any) => e.location?.fieldPathElements?.[0]?.index) ?? [])
                .filter((i: any) => typeof i === 'number')
        );
        for (let i = 0; i < pending.rows.length; i++) {
            const row = pending.rows[i];
            const ok = !failedIndices.has(i);
            if (ok) {
                await db.query(
                    `UPDATE attributions SET google_ads_synced = TRUE, google_ads_synced_at = NOW() WHERE id = $1`,
                    [row.id]
                );
            }
            results.push({ id: row.id, ok, gclid: row.gclid });
        }
    } else {
        results.push({ ok: false, error: apiData.error?.message ?? `HTTP ${apiRes.status}` });
    }
    res.json({ processed: pending.rows.length, results });
});

// ─── WooCommerce Webhook Management ─────────────────────────────────────────

function wcAuth() {
    const key = process.env.WC_KEY;
    const secret = process.env.WC_SECRET;
    if (!key || !secret) return null;
    return Buffer.from(`${key}:${secret}`).toString('base64');
}

// GET /api/attributions/wc-webhooks — list WC webhooks that point to us
router.get('/wc-webhooks', async (req: Request, res: Response) => {
    const auth = wcAuth();
    const wcUrl = process.env.WC_URL;
    if (!auth || !wcUrl) {
        res.status(400).json({ error: 'WC credentials not configured' });
        return;
    }
    try {
        const r = await fetch(`${wcUrl}/wp-json/wc/v3/webhooks?per_page=50`, {
            headers: { Authorization: `Basic ${auth}` },
        });
        const webhooks = await r.json();
        // Filter only webhooks that contain our endpoint
        const ours = (Array.isArray(webhooks) ? webhooks : []).filter((w: any) =>
            w.delivery_url?.includes('woocommerce-sync') || w.delivery_url?.includes('salesking-sync')
        );
        res.json({
            webhooks: ours.map((w: any) => ({
                id: w.id,
                name: w.name,
                topic: w.topic,
                delivery_url: w.delivery_url,
                status: w.status,
                date_created: w.date_created,
            })),
            all_count: Array.isArray(webhooks) ? webhooks.length : 0,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/attributions/wc-webhooks — create webhook in WooCommerce
router.post('/wc-webhooks', async (req: Request, res: Response) => {
    const auth = wcAuth();
    const wcUrl = process.env.WC_URL;
    if (!auth || !wcUrl) {
        res.status(400).json({ error: 'WC credentials not configured' });
        return;
    }

    const { public_url } = req.body as { public_url: string };
    if (!public_url) {
        res.status(400).json({ error: 'public_url is required' });
        return;
    }

    // Save public_url in settings table for future reference
    await db.query(
        `INSERT INTO settings (key, value) VALUES ('public_url', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [public_url]
    ).catch(() => { /* settings table might not exist yet */ });

    const deliveryUrl = `${public_url.replace(/\/$/, '')}/api/attributions/woocommerce-sync`;

    try {
        // Create two webhooks: order.created and order.updated
        const topics = [
            { topic: 'order.created', name: 'MyAlice CRM — Orden creada' },
            { topic: 'order.updated', name: 'MyAlice CRM — Orden actualizada' },
        ];
        const created = [];

        for (const t of topics) {
            // Check if webhook already exists for this topic + delivery_url
            const listRes = await fetch(`${wcUrl}/wp-json/wc/v3/webhooks?per_page=100`, {
                headers: { Authorization: `Basic ${auth}` },
            });
            const existing = await listRes.json();
            const dupe = (Array.isArray(existing) ? existing : []).find(
                (w: any) => w.topic === t.topic && w.delivery_url === deliveryUrl && w.status === 'active'
            );
            if (dupe) {
                created.push({ id: dupe.id, topic: t.topic, status: 'already_exists' });
                continue;
            }

            const r = await fetch(`${wcUrl}/wp-json/wc/v3/webhooks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
                body: JSON.stringify({
                    name: t.name,
                    topic: t.topic,
                    delivery_url: deliveryUrl,
                    status: 'active',
                    secret: process.env.JWT_SECRET || 'myalice-webhook-secret',
                }),
            });
            const wh: any = await r.json();
            if (wh.id) {
                created.push({ id: wh.id, topic: t.topic, status: 'created' });
            } else {
                created.push({ topic: t.topic, status: 'error', error: wh.message || JSON.stringify(wh) });
            }
        }

        res.json({ delivery_url: deliveryUrl, webhooks: created });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/attributions/wc-webhooks/:id — delete a WC webhook
router.delete('/wc-webhooks/:id', async (req: Request, res: Response) => {
    const auth = wcAuth();
    const wcUrl = process.env.WC_URL;
    if (!auth || !wcUrl) {
        res.status(400).json({ error: 'WC credentials not configured' });
        return;
    }
    try {
        const r = await fetch(`${wcUrl}/wp-json/wc/v3/webhooks/${req.params.id}?force=true`, {
            method: 'DELETE',
            headers: { Authorization: `Basic ${auth}` },
        });
        const data = await r.json();
        res.json({ deleted: true, id: req.params.id });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/attributions/public-url — get stored public URL
router.get('/public-url', async (_req: Request, res: Response) => {
    try {
        const r = await db.query(`SELECT value FROM settings WHERE key = 'public_url'`);
        res.json({ public_url: r.rows[0]?.value || null });
    } catch {
        res.json({ public_url: null });
    }
});

export default router;
