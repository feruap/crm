import { Router, Request, Response } from 'express';
import { db } from '../db';
import { learnFromConversation } from '../ai.service';
import { getWCCreds } from '../utils/wc-creds';
import { sendOutboundReply } from './webhooks';

const router = Router();

// GET /api/conversations?status=open&channel_id=...&channel_provider=whatsapp&handled_by=bot&agent_id=...
router.get('/', async (req: Request, res: Response) => {
    const { status, channel_id, channel_provider, agent_id, handled_by } = req.query;

    let query = `
        SELECT c.*, cu.display_name AS customer_name,
               a.name AS agent_name,
               ch.name AS channel_name, ch.provider AS channel_provider,
               c.pipeline_id, c.pipeline_stage_id,
               lm.content AS last_message,
               lm.created_at AS last_message_at,
               COALESCE(uc.unread_count, 0)::int AS unread_count
        FROM conversations c
        JOIN customers cu ON cu.id = c.customer_id
        LEFT JOIN agents a ON a.id = c.assigned_agent_id
        LEFT JOIN channels ch ON ch.id = c.channel_id
        LEFT JOIN LATERAL (
            SELECT content, created_at, handled_by FROM messages
            WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
        ) lm ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS unread_count FROM messages
            WHERE conversation_id = c.id AND is_read = FALSE AND direction = 'inbound'
        ) uc ON true
        WHERE 1=1
    `;
    const { archived, starred, label } = req.query;
    const params: unknown[] = [];

    if (archived === 'true') {
        query += ` AND c.is_archived = TRUE`;
    } else {
        query += ` AND c.is_archived = FALSE`;
    }

    if (starred === 'true') {
        query += ` AND c.is_starred = TRUE`;
    }

    if (label) {
        params.push(label);
        query += ` AND c.conversation_label = $${params.length}`;
    }

    if (status) {
        const statuses = (status as string).split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length === 1) {
            params.push(statuses[0]);
            query += ` AND c.status = $${params.length}`;
        } else if (statuses.length > 1) {
            const holders: string[] = [];
            for (const s of statuses) {
                params.push(s);
                holders.push(`$${params.length}`);
            }
            query += ` AND c.status IN (${holders.join(', ')})`;
        }
    }
    if (channel_id) {
        params.push(channel_id);
        query += ` AND c.channel_id = $${params.length}`;
    }
    if (channel_provider) {
        params.push(channel_provider);
        query += ` AND ch.provider = $${params.length}`;
    }
    if (agent_id) {
        const idToUse = agent_id === 'me' ? req.agent?.agentId : agent_id;
        params.push(idToUse);
        query += ` AND c.assigned_agent_id = $${params.length}`;
    }
    if (req.query.pipeline_id) {
        params.push(req.query.pipeline_id);
        query += ` AND c.pipeline_id = $${params.length}`;
    }
    if (req.query.pipeline_stage_id) {
        params.push(req.query.pipeline_stage_id);
        query += ` AND c.pipeline_stage_id = $${params.length}`;
    }
    // Filter by who is handling — uses LATERAL join result
    if (handled_by) {
        params.push(handled_by);
        query += ` AND lm.handled_by = $${params.length}`;
    }

    query += ` ORDER BY last_message_at DESC NULLS LAST`;

    try {
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err: any) {
        console.error('[conversations] SQL error:', err.message, { query: query.substring(0, 300), paramCount: params.length });
        res.status(500).json({ error: 'Failed to load conversations', detail: err.message });
    }
});

// GET /api/conversations/:id/customer
// Returns full customer profile: identity, orders, past conversations, campaign attribution, AI insights
router.get('/:id/customer', async (req: Request, res: Response) => {
    const convId = req.params.id;

    // Conversation + customer base
    const conv = await db.query(
        `SELECT c.customer_id, c.status, c.assigned_agent_id,
                cu.display_name, cu.created_at AS customer_since
         FROM conversations c
         JOIN customers cu ON cu.id = c.customer_id
         WHERE c.id = $1`,
        [convId]
    );
    if (conv.rows.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }
    const { customer_id, display_name, customer_since } = conv.rows[0];

    // All channel identities (phone for WhatsApp, PSID for Facebook, etc.)
    const identities = await db.query(
        `SELECT provider, provider_id FROM external_identities WHERE customer_id = $1`,
        [customer_id]
    );
    const phone = identities.rows.find((i: any) => i.provider === 'whatsapp')?.provider_id ?? null;

    // Customer attributes (email, address stored as key/value)
    const attrs = await db.query(
        `SELECT key, value FROM customer_attributes WHERE customer_id = $1`,
        [customer_id]
    );
    const attrMap: Record<string, string> = {};
    for (const row of attrs.rows) attrMap[row.key] = row.value;

    // Orders from WooCommerce sync
    let orders = await db.query(
        `SELECT id, external_order_id, total_amount, currency, status, order_date, items
         FROM orders WHERE customer_id = $1 ORDER BY order_date DESC LIMIT 20`,
        [customer_id]
    );

    // Auto-fetch from WooCommerce if no local orders exist yet
    if (orders.rows.length === 0 && phone) {
        try {
            const wc = await getWCCreds();
            if (wc.url && wc.key && wc.secret) {
                const auth = Buffer.from(`${wc.key}:${wc.secret}`).toString('base64');
                const phoneLast10 = phone.replace(/\D/g, '').slice(-10);
                const after = new Date();
                after.setMonth(after.getMonth() - 13);
                const wcRes = await fetch(
                    `${wc.url.replace(/\/$/, '')}/wp-json/wc/v3/orders?search=${encodeURIComponent(phoneLast10)}&per_page=20&after=${after.toISOString()}&orderby=date&order=desc`,
                    { headers: { Authorization: `Basic ${auth}` } }
                );
                if (wcRes.ok) {
                    const wcOrders: any[] = await wcRes.json();
                    if (Array.isArray(wcOrders) && wcOrders.length > 0) {
                        for (const o of wcOrders) {
                            const items = (o.line_items || []).map((li: any) => ({
                                product_id: li.product_id,
                                name: li.name,
                                quantity: li.quantity,
                                total: li.total,
                            }));
                            await db.query(
                                `INSERT INTO orders (customer_id, external_order_id, total_amount, currency, status, order_date, items)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                                 ON CONFLICT (external_order_id) DO NOTHING`,
                                [customer_id, String(o.id), o.total, o.currency || 'MXN', o.status || 'completed',
                                 o.date_created || new Date().toISOString(), JSON.stringify(items)]
                            );
                        }
                        orders = await db.query(
                            `SELECT id, external_order_id, total_amount, currency, status, order_date, items
                             FROM orders WHERE customer_id = $1 ORDER BY order_date DESC LIMIT 20`,
                            [customer_id]
                        );
                    }
                }
            }
        } catch (err) {
            console.error('[WC Auto-sync] Error fetching orders for customer', customer_id, err);
        }
    }

    // Total spent
    const spent = await db.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM orders WHERE customer_id = $1 AND status = 'completed'`,
        [customer_id]
    );

    // Past conversations (excluding current)
    const pastConvs = await db.query(
        `SELECT c.id, c.status, c.updated_at AS date,
                a.name AS agent_name,
                (SELECT content FROM messages WHERE conversation_id = c.id
                 ORDER BY created_at DESC LIMIT 1) AS last_message
         FROM conversations c
         LEFT JOIN agents a ON a.id = c.assigned_agent_id
         WHERE c.customer_id = $1 AND c.id != $2
         ORDER BY c.updated_at DESC LIMIT 5`,
        [customer_id, convId]
    );

    // Campaign attribution for this specific conversation
    const attribution = await db.query(
        `SELECT ca.name, ca.platform, ca.platform_campaign_id
         FROM attributions at2
         JOIN campaigns ca ON ca.id = at2.campaign_id
         WHERE at2.conversation_id = $1
         LIMIT 1`,
        [convId]
    );

    // AI insights
    const insights = await db.query(
        `SELECT last_sentiment, suggested_next_action, summary_short
         FROM ai_insights WHERE conversation_id = $1 LIMIT 1`,
        [convId]
    );

    res.json({
        id: customer_id,
        name: display_name,
        phone,
        email: attrMap['email'] ?? null,
        address: attrMap['address'] ?? attrMap['address_1'] ?? null,
        // WooCommerce shipping fields (from customer_attributes)
        shipping: {
            first_name: attrMap['first_name'] || (display_name || '').split(' ')[0] || '',
            last_name: attrMap['last_name'] || (display_name || '').split(' ').slice(1).join(' ') || '',
            address_1: attrMap['address_1'] || attrMap['address'] || '',
            address_2: attrMap['address_2'] || '',
            city: attrMap['city'] || '',
            state: attrMap['state'] || '',
            postcode: attrMap['postcode'] || attrMap['zip'] || '',
            country: attrMap['country'] || 'MX',
            email: attrMap['email'] || '',
            phone: phone || '',
        },
        wc_customer_id: attrMap['wc_customer_id'] || null,
        customer_since: new Date(customer_since).toLocaleDateString('es', { month: 'short', year: 'numeric' }),
        total_spent: parseFloat(spent.rows[0].total),
        orders: orders.rows,
        past_conversations: pastConvs.rows,
        campaign: attribution.rows[0] ?? null,
        sentiment: insights.rows[0]?.last_sentiment ?? 'neutral',
        ai_suggestions: insights.rows[0]?.suggested_next_action
            ? [{ type: 'offer', text: insights.rows[0].suggested_next_action }]
            : [],
    });
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req: Request, res: Response) => {
    const result = await db.query(
        `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
        [req.params.id]
    );
    res.json(result.rows);
});

// PATCH /api/conversations/:id/status
router.patch('/:id/status', async (req: Request, res: Response) => {
    const { status } = req.body;
    const validStatuses = ['open', 'pending', 'resolved', 'snoozed'];

    if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
    }

    await db.query(
        `UPDATE conversations SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, req.params.id]
    );

    // When resolved, automatically extract knowledge from the conversation
    if (status === 'resolved') {
        const settings = await db.query(
            `SELECT provider, api_key_encrypted, system_prompt
             FROM ai_settings WHERE is_default = TRUE LIMIT 1`
        );
        if (settings.rows.length > 0) {
            const { provider, api_key_encrypted } = settings.rows[0];
            // Fire and forget — don't block the response
            learnFromConversation(req.params.id as string, provider, api_key_encrypted).catch(console.error);

        }
    }

    res.json({ ok: true, status });
});

// PATCH /api/conversations/:id/stage
router.patch('/:id/stage', async (req: Request, res: Response) => {
    const { pipeline_id, pipeline_stage_id } = req.body;
    await db.query(
        `UPDATE conversations SET pipeline_id = $1, pipeline_stage_id = $2, updated_at = NOW() WHERE id = $3`,
        [pipeline_id, pipeline_stage_id, req.params.id]
    );
    res.json({ ok: true, pipeline_id, pipeline_stage_id });
});

// PATCH /api/conversations/:id/assign
router.patch('/:id/assign', async (req: Request, res: Response) => {
    const { agent_id } = req.body;
    await db.query(
        `UPDATE conversations SET assigned_agent_id = $1, updated_at = NOW() WHERE id = $2`,
        [agent_id, req.params.id]
    );
    res.json({ ok: true });
});

// PATCH /api/conversations/:id/takeover — agent takes over from bot
router.patch('/:id/takeover', async (req: Request, res: Response) => {
    await db.query(
        `UPDATE conversations SET assigned_agent_id = $1, updated_at = NOW() WHERE id = $2`,
        [req.agent!.agentId, req.params.id]
    );
    res.json({ ok: true, agent_id: req.agent!.agentId });
});


// POST /api/conversations/:id/cart-link
// Creates a WooCommerce order (pending payment) with SalesKing metadata and
// sends the payment link as a message in the conversation.
// Flow: Agent builds cart → WC draft order → customer receives payment URL → pays → SalesKing calculates commission
router.post('/:id/cart-link', async (req: Request, res: Response) => {
    const { items, billing: billingOverride, campaign_id } = req.body as {
        items: {
            product_id: number; variation_id?: number; quantity: number;
            name: string; price: string; variation_label?: string;
            custom_price?: string;       // Agent-modified price (SalesKing discount)
            original_price?: string;     // Original price before discount
        }[];
        billing?: {
            first_name?: string; last_name?: string;
            address_1?: string; address_2?: string;
            city?: string; state?: string; postcode?: string; country?: string;
            email?: string; phone?: string;
        };
        campaign_id?: string;
    };

    if (!items || items.length === 0) {
        res.status(400).json({ error: 'items required' });
        return;
    }

    const wcCreds = await getWCCreds();
    if (!wcCreds.url || !wcCreds.key || !wcCreds.secret) {
        res.status(503).json({ error: 'WooCommerce not configured' });
        return;
    }
    const wcUrl = wcCreds.url;
    const wcAuth = Buffer.from(`${wcCreds.key}:${wcCreds.secret}`).toString('base64');

    // ── Fetch agent info (WordPress User ID for SalesKing) ──────────────────
    const agentRow = await db.query(
        `SELECT wc_agent_id, name FROM agents WHERE id = $1`,
        [req.agent!.agentId]
    );
    const wcAgentId: string | null = agentRow.rows[0]?.wc_agent_id ?? null;
    const agentName: string = agentRow.rows[0]?.name ?? '';

    // ── Fetch customer info for WC billing ──────────────────────────────────
    const conv = await db.query(
        `SELECT c.customer_id, c.channel_id, cu.display_name
         FROM conversations c
         JOIN customers cu ON cu.id = c.customer_id
         WHERE c.id = $1`,
        [req.params.id]
    );
    if (conv.rows.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }
    const { customer_id, channel_id, display_name } = conv.rows[0];

    // Get customer phone, email, and address from identities + attributes
    const identities = await db.query(
        `SELECT provider, provider_id FROM external_identities WHERE customer_id = $1`,
        [customer_id]
    );
    const phone = identities.rows.find((i: any) => i.provider === 'whatsapp')?.provider_id ?? '';
    const attrs = await db.query(
        `SELECT key, value FROM customer_attributes WHERE customer_id = $1`,
        [customer_id]
    );
    const attrMap: Record<string, string> = {};
    for (const row of attrs.rows) attrMap[row.key] = row.value;
    const email = attrMap['email'] || '';

    // ── Build WC line_items (with variation_id + custom price support) ──────
    const line_items = items.map(i => {
        const item: any = {
            product_id: i.product_id,
            quantity: i.quantity,
        };
        if (i.variation_id) {
            item.variation_id = i.variation_id;
        }
        // If agent set a custom (discounted) price, override the WC price
        // and attach SalesKing metadata so it tracks the discount correctly
        if (i.custom_price && i.custom_price !== i.original_price) {
            item.price = i.custom_price;
            item.subtotal = String(parseFloat(i.custom_price) * i.quantity);
            item.total = String(parseFloat(i.custom_price) * i.quantity);
            item.meta_data = [
                { key: '_salesking_set_price', value: i.custom_price },
                { key: '_salesking_original_price', value: i.original_price || i.price },
            ];
        }
        return item;
    });

    const meta_data: { key: string; value: string }[] = [
        { key: '_myalice_customer_id', value: customer_id },
        { key: '_myalice_source', value: 'crm_agent' },
        { key: '_myalice_conversation_id', value: req.params.id },
    ];

    // Campaign attribution metadata
    if (campaign_id) {
        meta_data.push(
            { key: '_myalice_campaign_id', value: campaign_id },
        );
    }

    // SalesKing metadata — this is what triggers commission calculation
    if (wcAgentId) {
        meta_data.push(
            { key: 'salesking_order_placed_by', value: String(wcAgentId) },
            { key: 'salesking_order_placed_type', value: 'placed_by_agent' },
            { key: 'salesking_assigned_agent', value: String(wcAgentId) },
            { key: 'salesking_assigned_agent_name', value: agentName },
            { key: 'salesking_customer_assigned_agent_name', value: agentName },
        );
    }

    // Split display_name for billing
    const nameParts = (display_name || 'Cliente').split(' ');
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || '';

    // ── Build billing & shipping from customer data + override ──────────────
    const billing: Record<string, any> = {
        first_name: billingOverride?.first_name || firstName,
        last_name: billingOverride?.last_name || lastName,
        email: billingOverride?.email || email || undefined,
        phone: billingOverride?.phone || phone || undefined,
        address_1: billingOverride?.address_1 || attrMap['address_1'] || attrMap['address'] || '',
        address_2: billingOverride?.address_2 || attrMap['address_2'] || '',
        city: billingOverride?.city || attrMap['city'] || '',
        state: billingOverride?.state || attrMap['state'] || '',
        postcode: billingOverride?.postcode || attrMap['postcode'] || attrMap['zip'] || '',
        country: billingOverride?.country || attrMap['country'] || 'MX',
    };

    // Use same data for shipping so WC can calculate shipping costs
    const shipping: Record<string, any> = {
        first_name: billing.first_name,
        last_name: billing.last_name,
        address_1: billing.address_1,
        address_2: billing.address_2,
        city: billing.city,
        state: billing.state,
        postcode: billing.postcode,
        country: billing.country,
    };

    // Look up linked WC customer ID
    const wcCustIdAttr = attrMap['wc_customer_id'] ? parseInt(attrMap['wc_customer_id']) : 0;

    try {
        const wcResponse = await fetch(`${wcUrl}/wp-json/wc/v3/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Basic ${wcAuth}` },
            body: JSON.stringify({
                status: 'pending',
                customer_id: wcCustIdAttr,
                line_items,
                billing,
                shipping,
                customer_note: `Pedido creado por agente ${agentName} desde CRM`,
                meta_data,
                set_paid: false,
            }),
        });

        if (!wcResponse.ok) {
            const err = await wcResponse.text();
            console.error('WC order creation failed:', err);
            res.status(502).json({ error: 'WooCommerce order creation failed', detail: err });
            return;
        }

        const order: any = await wcResponse.json();

        // Build payment URL — add campaign UTM params if applicable
        let paymentUrl = order.payment_url || `${wcUrl}/checkout/order-pay/${order.id}/?pay_for_order=true&key=${order.order_key}`;
        if (campaign_id) {
            const sep = paymentUrl.includes('?') ? '&' : '?';
            paymentUrl += `${sep}utm_source=myalice&utm_medium=crm&utm_campaign=${encodeURIComponent(campaign_id)}`;
        }

        // ── Save order to local DB ──────────────────────────────────────────
        await db.query(
            `INSERT INTO orders (customer_id, external_order_id, total_amount, currency, status, order_date, items)
             VALUES ($1, $2, $3, $4, 'pending', NOW(), $5)
             ON CONFLICT (external_order_id) DO UPDATE SET total_amount = $3, status = 'pending'`,
            [customer_id, String(order.id), order.total, order.currency, JSON.stringify(line_items)]
        );

        // ── Build and send chat message ─────────────────────────────────────
        const itemLines = items.map(i => {
            const varLabel = i.variation_label ? ` (${i.variation_label})` : '';
            const effectivePrice = i.custom_price || i.price;
            const discountLabel = (i.custom_price && i.custom_price !== i.original_price)
                ? ` ~$${i.original_price}~ → $${i.custom_price}`
                : ` $${effectivePrice}`;
            return `  ${i.name}${varLabel} x${i.quantity} —${discountLabel}`;
        }).join('\n');
        const total = items.reduce((sum, i) => sum + (parseFloat(i.custom_price || i.price) * i.quantity), 0);
        const shippingNote = billing.address_1 ? '' : '\n⚠️ Sin dirección de envío — el cliente la completará en checkout';
        const messageContent =
            `*Pedido #${order.number}*\n${itemLines}\n*Total: $${total.toFixed(2)} ${order.currency}*${shippingNote}\n\n` +
            `Completa tu compra aqui:\n${paymentUrl}`;

        const msg = await db.query(
            `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, message_type, handled_by)
             VALUES ($1, $2, $3, 'outbound', $4, 'text', 'human') RETURNING *`,
            [req.params.id, channel_id, customer_id, messageContent]
        );

        res.status(201).json({
            message: msg.rows[0],
            payment_url: paymentUrl,
            wc_order_id: order.id,
            order_number: order.number,
            total: order.total,
        });
    } catch (err) {
        console.error('Cart-link error:', err);
        res.status(500).json({ error: 'Failed to create order', detail: String(err) });
    }
});

// POST /api/conversations/:id/messages  (send outbound message)
router.post('/:id/messages', async (req: Request, res: Response) => {
    const { content, message_type = 'text' } = req.body;

    const conv = await db.query(
        `SELECT customer_id, channel_id FROM conversations WHERE id = $1`,
        [req.params.id]
    );
    if (conv.rows.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }

    const { customer_id, channel_id } = conv.rows[0];

    const msg = await db.query(
        `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, message_type, handled_by)
         VALUES ($1, $2, $3, 'outbound', $4, $5, 'human')
         RETURNING *`,
        [req.params.id, channel_id, customer_id, content, message_type]
    );

    // Deliver message via WhatsApp/Meta API
    sendOutboundReply(channel_id, customer_id, content).catch((err: unknown) =>
        console.error('[conversations] sendOutboundReply failed:', err)
    );

    res.status(201).json(msg.rows[0]);
});

// PATCH /api/conversations/:id/star
router.patch('/:id/star', async (req: Request, res: Response) => {
    const result = await db.query(
        `UPDATE conversations SET is_starred = NOT is_starred, updated_at = NOW() WHERE id = $1 RETURNING is_starred`,
        [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, is_starred: result.rows[0].is_starred });
});

// PATCH /api/conversations/:id/archive
router.patch('/:id/archive', async (req: Request, res: Response) => {
    const result = await db.query(
        `UPDATE conversations SET is_archived = NOT is_archived, updated_at = NOW() WHERE id = $1 RETURNING is_archived`,
        [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, is_archived: result.rows[0].is_archived });
});

// PATCH /api/conversations/:id/label
router.patch('/:id/label', async (req: Request, res: Response) => {
    const { label } = req.body;
    await db.query(
        `UPDATE conversations SET conversation_label = $1, updated_at = NOW() WHERE id = $2`,
        [label, req.params.id]
    );
    res.json({ ok: true });
});

// PATCH /api/conversations/:id/tags
router.patch('/:id/tags', async (req: Request, res: Response) => {
    const { tags } = req.body; // Expecting string[]
    await db.query(
        `UPDATE conversations SET tags = $1, updated_at = NOW() WHERE id = $2`,
        [tags, req.params.id]
    );
    res.json({ ok: true });
});

// PATCH /api/conversations/:id/read  — mark all as read
router.patch('/:id/read', async (req: Request, res: Response) => {
    const { id } = req.params;
    await db.query('UPDATE messages SET is_read = TRUE WHERE conversation_id = $1 AND is_read = FALSE', [id]);
    res.json({ ok: true });
});

// PATCH /api/conversations/:id/close-deal
// Registra venta manual cerrada por el agente. Crea/actualiza atribución con sale_source='manual'.
router.patch('/:id/close-deal', async (req: Request, res: Response) => {
    const { deal_value, deal_currency = 'MXN' } = req.body;
    if (!deal_value || isNaN(Number(deal_value))) {
        res.status(400).json({ error: 'deal_value requerido' });
        return;
    }

    const agentId = req.agent!.agentId;

    // Actualizar conversación con datos de la venta
    await db.query(
        `UPDATE conversations
         SET deal_value     = $1,
             deal_currency  = $2,
             deal_closed_at = NOW(),
             deal_closed_by = $3,
             updated_at     = NOW()
         WHERE id = $4`,
        [deal_value, deal_currency, agentId, req.params.id]
    );

    // Crear o actualizar atribución con sale_source='manual'
    const existing = await db.query(
        `SELECT id FROM attributions WHERE conversation_id = $1 LIMIT 1`,
        [req.params.id]
    );

    if (existing.rows.length > 0) {
        await db.query(
            `UPDATE attributions
             SET sale_source   = 'manual',
                 sale_amount   = $1,
                 sale_currency = $2
             WHERE id = $3`,
            [deal_value, deal_currency, existing.rows[0].id]
        );
    } else {
        // Obtener customer_id para crear atribución sin campaign
        const conv = await db.query('SELECT customer_id FROM conversations WHERE id = $1', [req.params.id]);
        if (conv.rows.length > 0) {
            await db.query(
                `INSERT INTO attributions (customer_id, conversation_id, sale_source, sale_amount, sale_currency)
                 VALUES ($1, $2, 'manual', $3, $4)`,
                [conv.rows[0].customer_id, req.params.id, deal_value, deal_currency]
            );
        }
    }

    res.json({ ok: true, deal_value, deal_currency });
});

export default router;
