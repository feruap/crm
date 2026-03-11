import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';

const router = Router();
router.use(requireAuth);

// ── WC helper ─────────────────────────────────────────────────────────────────
function wcAuth() {
    const wcKey = process.env.WC_KEY;
    const wcSecret = process.env.WC_SECRET;
    return Buffer.from(`${wcKey}:${wcSecret}`).toString('base64');
}

function wcConfigured() {
    return !!(process.env.WC_URL && process.env.WC_KEY && process.env.WC_SECRET);
}

// GET /api/products/categories — WooCommerce product categories (parent=0 for top-level)
router.get('/categories', async (req: Request, res: Response) => {
    if (!wcConfigured()) { res.json({ categories: [] }); return; }
    const parent = req.query.parent ?? '0'; // default: top-level only
    try {
        const response = await fetch(
            `${process.env.WC_URL}/wp-json/wc/v3/products/categories?per_page=50&parent=${parent}&orderby=name&hide_empty=true`,
            { headers: { Authorization: `Basic ${wcAuth()}` } }
        );
        if (!response.ok) { res.status(502).json({ error: 'WC API error' }); return; }
        const raw: any[] = await response.json() as any[];
        res.json({ categories: raw.map(c => ({ id: c.id, name: c.name, slug: c.slug, count: c.count, image: c.image?.src ?? null })) });
    } catch (err) { res.status(500).json({ error: String(err) }); }
});

// GET /api/products?search=...&per_page=20&orderby=popularity&category=123
router.get('/', async (req: Request, res: Response) => {
    if (!wcConfigured()) {
        res.json({ products: [], warning: 'WooCommerce credentials not configured' });
        return;
    }

    const searchTerm = (req.query.search as string || '').trim();
    const search = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';
    const perPage = Number(req.query.per_page) || 20;
    const orderby = (req.query.orderby as string) || 'date';
    const category = req.query.category ? `&category=${req.query.category}` : '';

    try {
        const response = await fetch(
            `${process.env.WC_URL}/wp-json/wc/v3/products?per_page=${perPage}&status=publish&orderby=${orderby}${search}${category}`,
            { headers: { Authorization: `Basic ${wcAuth()}` } }
        );

        if (!response.ok) {
            res.status(502).json({ error: 'WooCommerce API error', status: response.status });
            return;
        }

        const raw: any[] = await response.json() as any[];

        // Additional client-side relevance boost: if the search term appears in the product name,
        // push those results to the top
        let products = raw.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            regular_price: p.regular_price,
            sale_price: p.sale_price,
            sku: p.sku,
            stock: p.stock_status,
            image: p.images?.[0]?.src ?? null,
            categories: p.categories?.map((c: any) => ({ id: c.id, name: c.name })) ?? [],
            permalink: p.permalink,
            type: p.type,                        // 'simple' | 'variable' | 'grouped' | 'external'
            variations: p.variations ?? [],       // array of variation IDs (for variable products)
            total_sales: p.total_sales ?? 0,
        }));

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            products.sort((a, b) => {
                const aMatch = a.name.toLowerCase().includes(lowerSearch) ? 0 : 1;
                const bMatch = b.name.toLowerCase().includes(lowerSearch) ? 0 : 1;
                return aMatch - bMatch;
            });
        }

        res.json({ products });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch products', detail: String(err) });
    }
});

// GET /api/products/:id/variations — fetch variations for a variable product
router.get('/:id/variations', async (req: Request, res: Response) => {
    if (!wcConfigured()) {
        res.status(503).json({ error: 'WooCommerce not configured' });
        return;
    }

    try {
        const response = await fetch(
            `${process.env.WC_URL}/wp-json/wc/v3/products/${req.params.id}/variations?per_page=100`,
            { headers: { Authorization: `Basic ${wcAuth()}` } }
        );

        if (!response.ok) {
            const err = await response.text();
            res.status(502).json({ error: 'WooCommerce API error', detail: err });
            return;
        }

        const raw: any[] = await response.json() as any[];
        const variations = raw.map(v => ({
            id: v.id,
            price: v.price,
            regular_price: v.regular_price,
            sale_price: v.sale_price,
            sku: v.sku,
            stock_status: v.stock_status,
            stock_quantity: v.stock_quantity,
            attributes: v.attributes?.map((a: any) => ({
                name: a.name,
                option: a.option,
            })) ?? [],
            image: v.image?.src ?? null,
        }));

        res.json({ variations });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch variations', detail: String(err) });
    }
});

// POST /api/products/order
// Creates a WooCommerce Draft Order (Pending) and returns a checkout link.
// It also injects SalesKing attribution metadata so the agent gets the commission.
router.post('/order', async (req: Request, res: Response) => {
    const { customer_id, wc_customer_id, line_items, billing, shipping, notes } = req.body;

    if (!wcConfigured()) {
        res.status(503).json({ error: 'WooCommerce not configured' });
        return;
    }

    try {
        // Fetch agent's WC User ID from the database
        let wcAgentId = null;
        let wcAgentName = '';
        if (req.agent?.agentId) {
            const agentRes = await db.query('SELECT wc_agent_id, name FROM agents WHERE id = $1', [req.agent.agentId]);
            if (agentRes.rows.length > 0) {
                wcAgentId = agentRes.rows[0].wc_agent_id;
                wcAgentName = agentRes.rows[0].name;
            }
        }

        const meta_data = [
            { key: '_myalice_customer_id', value: customer_id },
            { key: '_myalice_source', value: 'crm_agent' },
        ];

        // Inject SalesKing tracking if agent is linked
        if (wcAgentId) {
            meta_data.push(
                { key: 'salesking_order_placed_by', value: String(wcAgentId) },
                { key: 'salesking_order_placed_type', value: 'placed_by_agent' },
                { key: 'salesking_assigned_agent', value: String(wcAgentId) },
                { key: 'salesking_assigned_agent_name', value: wcAgentName },
                { key: 'salesking_customer_assigned_agent_name', value: wcAgentName }
            );
        }

        const response = await fetch(`${process.env.WC_URL}/wp-json/wc/v3/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Basic ${wcAuth()}` },
            body: JSON.stringify({
                customer_id: wc_customer_id ?? 0,
                line_items,
                billing,
                shipping,
                customer_note: notes,
                status: 'pending', // Pending payment
                meta_data,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            res.status(502).json({ error: 'WooCommerce order creation failed', detail: err });
            return;
        }

        const order: any = await response.json();

        res.status(201).json({
            wc_order_id: order.id,
            order_number: order.number,
            total: order.total,
            payment_url: order.payment_url || order.checkout_payment_url // The actual WooCommerce checkout link
        });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// GET /api/products/wp-agents
// Search WordPress users with role "agent" (for linking CRM agents to WP/SalesKing)
router.get('/wp-agents', async (_req: Request, res: Response) => {
    if (!wcConfigured()) {
        res.status(503).json({ error: 'WooCommerce not configured' });
        return;
    }

    try {
        // WP REST API: list users with role=agent
        const response = await fetch(
            `${process.env.WC_URL}/wp-json/wp/v2/users?roles=agent&per_page=100&context=edit`,
            { headers: { Authorization: `Basic ${wcAuth()}` } }
        );

        if (!response.ok) {
            const err = await response.text();
            res.status(502).json({ error: 'WordPress API error', detail: err });
            return;
        }

        const users: any[] = await response.json() as any[];
        const agents = users.map(u => ({
            wp_user_id: u.id,
            name: u.name,
            email: u.email,
            username: u.username ?? u.slug,
        }));

        res.json({ agents });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch WP agents', detail: String(err) });
    }
});

// GET /api/products/salesking-pricing
// Fetches the current agent's SalesKing pricing rules from the bridge plugin in real-time.
// This ensures any changes made in SalesKing are immediately reflected in the CRM.
router.get('/salesking-pricing', async (req: Request, res: Response) => {
    if (!wcConfigured()) {
        res.json({ available: false, reason: 'WooCommerce not configured' });
        return;
    }

    // Get agent's WC User ID from the database
    const agentRow = await db.query('SELECT wc_agent_id FROM agents WHERE id = $1', [req.agent!.agentId]);
    const wcAgentId = agentRow.rows[0]?.wc_agent_id;

    if (!wcAgentId) {
        res.json({ available: false, reason: 'Agent has no WC User ID linked' });
        return;
    }

    try {
        // Fetch agent-specific rules from the bridge plugin
        const [agentRes, settingsRes] = await Promise.all([
            fetch(
                `${process.env.WC_URL}/wp-json/myalice-crm/v1/salesking-agent/${wcAgentId}`,
                { headers: { Authorization: `Basic ${wcAuth()}` } }
            ),
            fetch(
                `${process.env.WC_URL}/wp-json/myalice-crm/v1/salesking-settings`,
                { headers: { Authorization: `Basic ${wcAuth()}` } }
            ),
        ]);

        if (!agentRes.ok) {
            // Bridge plugin may not be installed — gracefully degrade
            const errText = await agentRes.text();
            console.warn('SalesKing bridge agent endpoint failed:', agentRes.status, errText);
            res.json({ available: false, reason: 'Bridge plugin not reachable', status: agentRes.status });
            return;
        }

        const agentData: any = await agentRes.json();
        const settingsData: any = settingsRes.ok ? await settingsRes.json() : {};

        res.json({
            available: true,
            agent_id: wcAgentId,
            display_name: agentData.display_name,
            group: agentData.group,
            pricing: {
                effective_max_discount: agentData.pricing?.effective_max_discount ?? 1,
                agent_max_discount: agentData.pricing?.agent_max_discount ?? null,
                can_increase_price: agentData.pricing?.can_increase_price ?? false,
                can_decrease_price: agentData.pricing?.can_decrease_price ?? true,
                discount_from_commission: agentData.pricing?.discount_from_commission ?? false,
            },
            settings: {
                can_edit_prices_increase: settingsData.can_edit_prices_increase ?? 0,
                can_edit_prices_discount: settingsData.can_edit_prices_discount ?? 0,
            },
        });
    } catch (err) {
        console.error('SalesKing pricing fetch error:', err);
        res.json({ available: false, reason: 'Network error', detail: String(err) });
    }
});

export default router;
