import { Router, Request, Response } from 'express';
import { db } from '../db';
import { learnFromConversation } from '../ai.service';
import { deliverMessage } from '../services/message-sender';

const router = Router();

// GET /api/conversations?status=open&channel_id=...&scoped_agent_id=...
router.get('/', async (req: Request, res: Response) => {
    const { status, channel_id, agent_id, scoped_agent_id, search } = req.query;

    let query = `
        SELECT c.*, cu.display_name AS customer_name,
               a.name AS agent_name,
               ch.name AS channel_name, ch.provider AS channel_provider,
               (SELECT content FROM messages m WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC LIMIT 1) AS last_message,
               (SELECT created_at FROM messages m WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
               (SELECT COUNT(*) FROM messages m
                WHERE m.conversation_id = c.id AND m.is_read = FALSE
                AND m.direction = 'inbound') AS unread_count
        FROM conversations c
        JOIN customers cu ON cu.id = c.customer_id
        LEFT JOIN agents a ON a.id = c.assigned_agent_id
        LEFT JOIN channels ch ON ch.id = c.channel_id
        WHERE 1=1
    `;
    const params: unknown[] = [];

    if (status) {
        params.push(status);
        query += ` AND c.status = $${params.length}`;
    }
    if (channel_id) {
        params.push(channel_id);
        query += ` AND c.channel_id = $${params.length}`;
    }
    if (agent_id) {
        params.push(agent_id);
        query += ` AND c.assigned_agent_id = $${params.length}`;
    }

    // RBAC: operadores only see their own conversations
    if (scoped_agent_id) {
        params.push(scoped_agent_id);
        query += ` AND c.assigned_agent_id = $${params.length}`;
    }

    // Search by customer name
    if (search) {
        params.push(`%${search}%`);
        query += ` AND cu.display_name ILIKE $${params.length}`;
    }

    query += ` ORDER BY last_message_at DESC NULLS LAST LIMIT 100`;

    const result = await db.query(query, params);
    res.json(result.rows);
});

// GET /api/conversations/:id — Single conversation with full context
router.get('/:id', async (req: Request, res: Response) => {
    const result = await db.query(
        `SELECT c.*,
                cu.display_name AS customer_name, cu.avatar_url,
                a.name AS agent_name, a.email AS agent_email,
                ch.name AS channel_name, ch.provider AS channel_provider,
                c.handoff_summary, c.escalation_reason,
                c.referral_data, c.utm_data
         FROM conversations c
         JOIN customers cu ON cu.id = c.customer_id
         LEFT JOIN agents a ON a.id = c.assigned_agent_id
         LEFT JOIN channels ch ON ch.id = c.channel_id
         WHERE c.id = $1`,
        [req.params.id]
    );

    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }

    res.json(result.rows[0]);
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req: Request, res: Response) => {
    const { after } = req.query; // For polling: only messages after this timestamp

    let query = `SELECT * FROM messages WHERE conversation_id = $1`;
    const params: unknown[] = [req.params.id];

    if (after) {
        params.push(after);
        query += ` AND created_at > $${params.length}`;
    }

    query += ` ORDER BY created_at ASC`;

    const result = await db.query(query, params);
    res.json(result.rows);
});

// GET /api/conversations/:id/context — Customer context for agent panel
router.get('/:id/context', async (req: Request, res: Response) => {
    // Get conversation info
    const conv = await db.query(
        `SELECT c.customer_id, c.channel_id, ch.provider AS channel_provider
         FROM conversations c
         LEFT JOIN channels ch ON ch.id = c.channel_id
         WHERE c.id = $1`,
        [req.params.id]
    );

    if (conv.rows.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }

    const { customer_id } = conv.rows[0];

    // Fetch all context in parallel
    const [customer, attributes, orders, profile, segments, pastConversations] = await Promise.all([
        db.query(`SELECT * FROM customers WHERE id = $1`, [customer_id]),
        db.query(`SELECT key, value FROM customer_attributes WHERE customer_id = $1`, [customer_id]),
        db.query(
            `SELECT id, external_order_id, total_amount, currency, status, items, order_date
             FROM orders WHERE customer_id = $1 ORDER BY order_date DESC LIMIT 10`,
            [customer_id]
        ),
        db.query(
            `SELECT * FROM customer_profiles WHERE customer_id = $1 LIMIT 1`,
            [customer_id]
        ).catch(() => ({ rows: [] })), // Table might not exist yet
        db.query(
            `SELECT segment_type, segment_value FROM customer_segments WHERE customer_id = $1`,
            [customer_id]
        ).catch(() => ({ rows: [] })),
        db.query(
            `SELECT id, status, created_at,
                    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
             FROM conversations c
             WHERE c.customer_id = $1 AND c.id != $2
             ORDER BY c.created_at DESC LIMIT 5`,
            [customer_id, req.params.id]
        ),
    ]);

    // Calculate lifetime value
    const lifetimeValue = orders.rows.reduce(
        (sum: number, o: { total_amount: string }) => sum + parseFloat(o.total_amount || '0'), 0
    );

    res.json({
        customer: customer.rows[0] || null,
        attributes: attributes.rows,
        orders: orders.rows,
        profile: profile.rows[0] || null,
        segments: segments.rows,
        past_conversations: pastConversations.rows,
        lifetime_value: lifetimeValue,
        total_orders: orders.rows.length,
    });
});

// POST /api/conversations/:id/messages  (send outbound message — ACTUALLY DELIVERS)
router.post('/:id/messages', async (req: Request, res: Response) => {
    const { content, message_type = 'text' } = req.body;

    if (!content?.trim()) {
        res.status(400).json({ error: 'Message content is required' });
        return;
    }

    const conv = await db.query(
        `SELECT customer_id, channel_id FROM conversations WHERE id = $1`,
        [req.params.id]
    );
    if (conv.rows.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
    }

    const { customer_id, channel_id } = conv.rows[0];

    // Save message to DB
    const msg = await db.query(
        `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, message_type, handled_by)
         VALUES ($1, $2, $3, 'outbound', $4, $5, 'human')
         RETURNING *`,
        [req.params.id, channel_id, customer_id, content, message_type]
    );

    const savedMsg = msg.rows[0];

    // Actually deliver the message via the channel (non-blocking)
    deliverMessage(savedMsg.id, req.params.id as string, customer_id, channel_id, content)
        .then(result => {
            if (!result.ok) {
                console.error(`[Delivery] Failed for msg ${savedMsg.id}:`, result.error);
            }
        })
        .catch(console.error);

    // Mark conversation as open if it was pending
    await db.query(
        `UPDATE conversations SET status = 'open', updated_at = NOW()
         WHERE id = $1 AND status = 'pending'`,
        [req.params.id]
    );

    res.status(201).json(savedMsg);
});

// POST /api/conversations/:id/read — Mark all messages as read
router.post('/:id/read', async (req: Request, res: Response) => {
    await db.query(
        `UPDATE messages SET is_read = TRUE
         WHERE conversation_id = $1 AND direction = 'inbound' AND is_read = FALSE`,
        [req.params.id]
    );
    res.json({ ok: true });
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
            learnFromConversation(req.params.id as string, provider, api_key_encrypted).catch(console.error);
        }
    }

    res.json({ ok: true, status });
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

// GET /api/conversations/:id/customer — full customer profile for panels
router.get('/:id/customer', async (req: Request, res: Response) => {
    try {
        const convResult = await db.query(
            `SELECT customer_id FROM conversations WHERE id = $1`,
            [req.params.id]
        );
        if (convResult.rows.length === 0) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }
        const customerId = convResult.rows[0].customer_id;

        const customer = await db.query(
            `SELECT id, display_name AS name, avatar_url, created_at
             FROM customers WHERE id = $1`,
            [customerId]
        );
        if (customer.rows.length === 0) {
            res.status(404).json({ error: 'Customer not found' });
            return;
        }

        const c = customer.rows[0];

        // Get phone and email from external_identities
        const identities = await db.query(
            `SELECT provider, provider_id, metadata FROM external_identities WHERE customer_id = $1`,
            [customerId]
        );
        let phone: string | null = null;
        let email: string | null = null;
        let wc_customer_id: string | null = null;
        for (const ident of identities.rows) {
            if (ident.provider === 'whatsapp' && !phone) phone = ident.provider_id;
            if (ident.provider === 'webchat' && ident.metadata?.email && !email) email = ident.metadata.email;
            if (ident.provider === 'webchat' && ident.metadata?.phone && !phone) phone = ident.metadata.phone;
            if (ident.provider === 'woocommerce') wc_customer_id = ident.provider_id;
        }

        // Get shipping from attributes
        const shippingAttr = await db.query(
            `SELECT value FROM customer_attributes WHERE customer_id = $1 AND key = 'shipping'`,
            [customerId]
        );
        const shipping = shippingAttr.rows.length > 0
            ? (typeof shippingAttr.rows[0].value === 'string'
                ? JSON.parse(shippingAttr.rows[0].value)
                : shippingAttr.rows[0].value)
            : null;

        // Get orders
        const orders = await db.query(
            `SELECT id, external_order_id AS wc_order_id, status, total_amount AS total, created_at
             FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20`,
            [customerId]
        );

        // Get segments
        const segments = await db.query(
            `SELECT segment_type, segment_value FROM customer_segments WHERE customer_id = $1`,
            [customerId]
        );

        // Get attributes
        const attributes = await db.query(
            `SELECT key, value FROM customer_attributes WHERE customer_id = $1 AND key != 'shipping'`,
            [customerId]
        );
        const attrsMap: Record<string, string> = {};
        attributes.rows.forEach((r: any) => { attrsMap[r.key] = r.value; });

        // Also check attributes for phone/email if not found in identities
        if (!phone && attrsMap['phone']) phone = attrsMap['phone'];
        if (!email && attrsMap['email']) email = attrsMap['email'];

        // If already linked via attributes, use that
        if (!wc_customer_id && attrsMap['wc_customer_id']) {
            wc_customer_id = attrsMap['wc_customer_id'];
        }

        // ── Auto-lookup WooCommerce customer by phone (WhatsApp) ──
        // If we have a phone but no WC link, search WooCommerce automatically
        let wcAutoLinked = false;
        if (!wc_customer_id && phone) {
            try {
                const wcUrl = process.env.WC_URL;
                const wcKey = process.env.WC_KEY;
                const wcSecret = process.env.WC_SECRET;

                if (wcUrl && wcKey && wcSecret) {
                    const wcAuth = Buffer.from(`${wcKey}:${wcSecret}`).toString('base64');
                    const headers = { Authorization: `Basic ${wcAuth}` };
                    let wcCustomer: any = null;

                    // 1. Normalize phone: extract the 10-digit local number
                    const phoneDigits = phone.replace(/\D/g, '');
                    let phoneLocal = phoneDigits;

                    if (phoneDigits.startsWith('521') && phoneDigits.length === 13) {
                        phoneLocal = phoneDigits.slice(3);
                    } else if (phoneDigits.startsWith('52') && phoneDigits.length === 12) {
                        phoneLocal = phoneDigits.slice(2);
                    } else if (phoneDigits.length > 10) {
                        phoneLocal = phoneDigits.slice(-10);
                    }

                    const phoneVariants = new Set([phoneLocal, phoneDigits, phone]);
                    if (phoneLocal.length === 10) {
                        phoneVariants.add(`52${phoneLocal}`);
                        phoneVariants.add(`521${phoneLocal}`);
                    }

                    // Strategy A: Search WC customers by phone (search= only checks name/email,
                    // but we try anyway in case there's a name match, then verify phone)
                    for (const pv of phoneVariants) {
                        if (wcCustomer) break;
                        const searchResp = await fetch(
                            `${wcUrl}/wp-json/wc/v3/customers?search=${encodeURIComponent(pv)}&per_page=10`,
                            { headers }
                        );
                        if (searchResp.ok) {
                            const results = await searchResp.json();
                            if (Array.isArray(results)) {
                                wcCustomer = results.find((wc: any) => {
                                    const wcBillingLocal = wc.billing?.phone?.replace(/\D/g, '').slice(-10);
                                    const wcShippingLocal = wc.shipping?.phone?.replace(/\D/g, '').slice(-10);
                                    return wcBillingLocal === phoneLocal || wcShippingLocal === phoneLocal;
                                }) || null;
                            }
                        }
                    }

                    // Strategy B: Search WC ORDERS by phone (orders search= DOES search billing phone)
                    // Then extract billing/shipping data from the most recent matching order
                    let wcOrderData: any = null;
                    if (!wcCustomer) {
                        for (const pv of phoneVariants) {
                            if (wcCustomer || wcOrderData) break;
                            const orderResp = await fetch(
                                `${wcUrl}/wp-json/wc/v3/orders?search=${encodeURIComponent(pv)}&per_page=5&orderby=date&order=desc`,
                                { headers }
                            );
                            if (orderResp.ok) {
                                const orders = await orderResp.json();
                                if (Array.isArray(orders)) {
                                    const matchingOrder = orders.find((o: any) => {
                                        const obLocal = o.billing?.phone?.replace(/\D/g, '').slice(-10);
                                        return obLocal === phoneLocal;
                                    });
                                    if (matchingOrder) {
                                        // If order has a real customer_id (not 0 = guest), fetch the WC customer
                                        if (matchingOrder.customer_id && matchingOrder.customer_id > 1) {
                                            const custResp = await fetch(
                                                `${wcUrl}/wp-json/wc/v3/customers/${matchingOrder.customer_id}`,
                                                { headers }
                                            );
                                            if (custResp.ok) {
                                                wcCustomer = await custResp.json();
                                            }
                                        }
                                        // Always save order billing/shipping as fallback data
                                        wcOrderData = matchingOrder;
                                    }
                                }
                            }
                        }
                    }

                    // Strategy C: If not found by phone but we have email, try email on customers
                    if (!wcCustomer && !wcOrderData && email) {
                        const emailResp = await fetch(
                            `${wcUrl}/wp-json/wc/v3/customers?email=${encodeURIComponent(email)}&per_page=1`,
                            { headers }
                        );
                        if (emailResp.ok) {
                            const results = await emailResp.json();
                            if (Array.isArray(results) && results.length > 0) {
                                wcCustomer = results[0];
                            }
                        }
                    }

                    // Import data: prefer WC customer profile, fall back to order billing data
                    const wcSource = wcCustomer || wcOrderData;
                    if (wcSource) {
                        if (wcCustomer) {
                            wc_customer_id = String(wcCustomer.id);
                        } else if (wcOrderData?.customer_id && wcOrderData.customer_id > 1) {
                            wc_customer_id = String(wcOrderData.customer_id);
                        } else {
                            // Guest order — use order ID as reference with prefix
                            wc_customer_id = `order_${wcOrderData.id}`;
                        }
                        wcAutoLinked = true;

                        // Save wc_customer_id in attributes
                        await db.query(
                            `INSERT INTO customer_attributes (customer_id, key, value, attribute_type)
                             VALUES ($1, 'wc_customer_id', $2, 'string')
                             ON CONFLICT (customer_id, key) DO UPDATE SET value = EXCLUDED.value`,
                            [customerId, wc_customer_id]
                        );

                        // Import shipping/billing data (prefer customer profile, then order data)
                        // Try customer profile first, then fall back to order billing/shipping
                        let wcData: any = {};
                        if (wcCustomer) {
                            wcData = wcCustomer.shipping?.first_name ? wcCustomer.shipping
                                   : wcCustomer.billing?.first_name ? wcCustomer.billing
                                   : {};
                        }
                        // If customer profile had no data, fall back to order billing/shipping
                        if (!wcData.first_name && wcOrderData) {
                            wcData = wcOrderData.shipping?.first_name ? wcOrderData.shipping
                                   : wcOrderData.billing?.first_name ? wcOrderData.billing
                                   : {};
                        }
                        const importFields = ['first_name', 'last_name', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country', 'phone'];
                        for (const key of importFields) {
                            if (wcData[key]) {
                                await db.query(
                                    `INSERT INTO customer_attributes (customer_id, key, value, attribute_type)
                                     VALUES ($1, $2, $3, 'string')
                                     ON CONFLICT (customer_id, key) DO UPDATE SET value = EXCLUDED.value`,
                                    [customerId, key, wcData[key]]
                                );
                                attrsMap[key] = wcData[key];
                            }
                        }

                        // Import email from WC if we didn't have one
                        const wcEmail = wcCustomer?.email || wcSource?.billing?.email;
                        if (!email && wcEmail && !wcEmail.includes('@placeholder')) {
                            email = wcEmail;
                            await db.query(
                                `INSERT INTO customer_attributes (customer_id, key, value, attribute_type)
                                 VALUES ($1, 'email', $2, 'string')
                                 ON CONFLICT (customer_id, key) DO UPDATE SET value = EXCLUDED.value`,
                                [customerId, email]
                            );
                            attrsMap['email'] = email!;
                        }

                        console.log(`[WC Auto-Link] Customer ${customerId} linked to WC #${wc_customer_id} via phone ${phone} (source: ${wcCustomer ? 'customer' : 'order'})`);
                    } else {
                        console.log(`[WC Auto-Link] No WC match found for phone ${phone} (local: ${phoneLocal})`);
                    }
                }
            } catch (wcErr) {
                // Non-critical: log but don't fail the response
                console.error('[WC Auto-Link] Error searching WooCommerce:', wcErr);
            }
        }

        res.json({
            id: c.id,
            name: c.name,
            phone,
            email,
            created_at: c.created_at,
            wc_customer_id,
            wc_auto_linked: wcAutoLinked,
            shipping,
            orders: orders.rows,
            segments: segments.rows,
            attributes: attrsMap,
        });
    } catch (err: any) {
        console.error('Error fetching customer for conversation:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/conversations/:id/cart-link — create WC draft order & return payment URL
router.post('/:id/cart-link', async (req: Request, res: Response) => {
    try {
        const { line_items, billing, shipping, notes } = req.body;

        // Get customer for this conversation
        const convResult = await db.query(
            `SELECT customer_id FROM conversations WHERE id = $1`,
            [req.params.id]
        );
        if (convResult.rows.length === 0) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }
        const customerId = convResult.rows[0].customer_id;

        const customerResult = await db.query(
            `SELECT id, wc_customer_id FROM customers WHERE id = $1`,
            [customerId]
        );
        const customer = customerResult.rows[0];

        // Build WooCommerce order payload
        const WC_URL = process.env.WC_URL || 'https://tst.amunet.com.mx';
        const WC_KEY = process.env.WC_KEY || '';
        const WC_SECRET = process.env.WC_SECRET || '';

        const orderPayload: any = {
            status: 'pending',
            line_items: line_items || [],
            set_paid: false,
        };

        if (customer.wc_customer_id) {
            orderPayload.customer_id = Number(customer.wc_customer_id);
        }
        if (billing) orderPayload.billing = billing;
        if (shipping) orderPayload.shipping = shipping;
        if (notes) orderPayload.customer_note = notes;

        // Add agent attribution metadata
        const agentId = (req as any).agent?.id;
        if (agentId) {
            const agentResult = await db.query(`SELECT name, wp_user_id FROM agents WHERE id = $1`, [agentId]);
            if (agentResult.rows.length > 0) {
                orderPayload.meta_data = [
                    { key: '_crm_agent_id', value: agentId },
                    { key: '_crm_agent_name', value: agentResult.rows[0].name },
                    { key: '_crm_conversation_id', value: req.params.id },
                ];
                if (agentResult.rows[0].wp_user_id) {
                    orderPayload.meta_data.push(
                        { key: 'salesking_order_placed_by', value: String(agentResult.rows[0].wp_user_id) },
                        { key: 'salesking_assigned_agent', value: String(agentResult.rows[0].wp_user_id) }
                    );
                }
            }
        }

        // Call WooCommerce API to create the order
        const wcAuth = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');
        const wcResponse = await fetch(`${WC_URL}/wp-json/wc/v3/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${wcAuth}`,
            },
            body: JSON.stringify(orderPayload),
        });

        if (!wcResponse.ok) {
            const err = await wcResponse.text();
            res.status(502).json({ error: 'WooCommerce order creation failed', details: err });
            return;
        }

        const wcOrder = await wcResponse.json() as any;

        // Save order in CRM database
        await db.query(
            `INSERT INTO orders (id, customer_id, wc_order_id, status, total, items, created_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
             ON CONFLICT (wc_order_id) DO UPDATE SET status = $3, total = $4`,
            [customerId, wcOrder.id, wcOrder.status, wcOrder.total, JSON.stringify(wcOrder.line_items)]
        );

        // Return payment URL
        const paymentUrl = wcOrder.payment_url || `${WC_URL}/checkout/order-pay/${wcOrder.id}/?pay_for_order=true&key=${wcOrder.order_key}`;

        res.json({
            wc_order_id: wcOrder.id,
            order_number: wcOrder.number,
            total: wcOrder.total,
            payment_url: paymentUrl,
            status: wcOrder.status,
        });
    } catch (err: any) {
        console.error('Error creating cart-link:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
