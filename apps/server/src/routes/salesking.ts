import { Router, Request, Response } from 'express';
import { db } from '../db';
import { getWCCreds } from '../utils/wc-creds';
import { getIO } from '../socket';

const router = Router();

// ── In-memory rules cache (15 min TTL per agent) ─────────────────────────────
interface CachedRules { data: any; expiresAt: number; }
const rulesCache = new Map<string, CachedRules>();
const CACHE_TTL_MS = 15 * 60 * 1000;

async function fetchAgentRulesFromBridge(wcAgentId: string): Promise<any> {
    const creds = await getWCCreds();
    if (!creds.url || !creds.key || !creds.secret) return null;
    const auth = Buffer.from(`${creds.key}:${creds.secret}`).toString('base64');

    const [agentRes, settingsRes] = await Promise.all([
        fetch(`${creds.url}/wp-json/amunet-crm/v1/salesking-agent/${wcAgentId}`, {
            headers: { Authorization: `Basic ${auth}` },
        }),
        fetch(`${creds.url}/wp-json/amunet-crm/v1/salesking-settings`, {
            headers: { Authorization: `Basic ${auth}` },
        }),
    ]);

    if (!agentRes.ok) {
        console.warn(`SalesKing bridge /salesking-agent/${wcAgentId} returned ${agentRes.status}`);
        return null;
    }

    const agentData: any = await agentRes.json();
    const settingsData: any = settingsRes.ok ? await settingsRes.json() : {};

    return {
        available: true,
        agent_id: wcAgentId,
        display_name: agentData.display_name,
        group: agentData.group,
        pricing: {
            effective_max_discount: agentData.pricing?.effective_max_discount ?? 0,
            agent_max_discount: agentData.pricing?.agent_max_discount ?? null,
            can_increase_price: agentData.pricing?.can_increase_price ?? false,
            can_decrease_price: agentData.pricing?.can_decrease_price ?? true,
            discount_from_commission: agentData.pricing?.discount_from_commission ?? false,
        },
        settings: {
            can_edit_prices_increase: settingsData.can_edit_prices_increase ?? 0,
            can_edit_prices_discount: settingsData.can_edit_prices_discount ?? 0,
        },
    };
}

// GET /api/salesking/agent-rules
// Returns SalesKing pricing rules for the current agent (in-memory cached, 15 min TTL).
router.get('/agent-rules', async (req: Request, res: Response) => {
    const agentId = req.agent!.agentId;

    const cached = rulesCache.get(agentId);
    if (cached && cached.expiresAt > Date.now()) {
        res.json({ ...cached.data, cached: true });
        return;
    }

    const creds = await getWCCreds();
    if (!creds.url || !creds.key || !creds.secret) {
        res.json({ available: false, reason: 'WooCommerce not configured' });
        return;
    }

    const agentRow = await db.query(
        'SELECT wc_agent_id, name FROM agents WHERE id = $1',
        [agentId]
    );
    const wcAgentId = agentRow.rows[0]?.wc_agent_id;

    if (!wcAgentId) {
        res.json({ available: false, reason: 'Agent has no WC User ID linked' });
        return;
    }

    try {
        const rules = await fetchAgentRulesFromBridge(wcAgentId);
        if (!rules) {
            res.json({ available: false, reason: 'Bridge plugin not reachable' });
            return;
        }
        rulesCache.set(agentId, { data: rules, expiresAt: Date.now() + CACHE_TTL_MS });
        res.json(rules);
    } catch (err) {
        console.error('SalesKing agent-rules error:', err);
        res.json({ available: false, reason: 'Network error', detail: String(err) });
    }
});

// POST /api/salesking/discount-request
// Proxies the discount request to the WordPress bridge (salesking-custom-discount plugin).
// The bridge creates the sk_discount_req CPT, routes to the correct approver, and
// fires a webhook back to /api/salesking/webhook/discount when approved/rejected.
router.post('/discount-request', async (req: Request, res: Response) => {
    const { conversation_id, discount_pct, reason, cart_items } = req.body;
    const agentId = req.agent!.agentId;

    if (!discount_pct) {
        res.status(400).json({ error: 'Missing required field: discount_pct' });
        return;
    }

    try {
        const creds = await getWCCreds();
        if (!creds.url || !creds.key || !creds.secret) {
            res.status(503).json({ error: 'WooCommerce not configured' });
            return;
        }

        // Resolve WC user ID for the CRM agent
        const agentRow = await db.query(
            'SELECT wc_agent_id FROM agents WHERE id = $1',
            [agentId]
        );
        const wcAgentId = agentRow.rows[0]?.wc_agent_id;
        if (!wcAgentId) {
            res.status(400).json({ error: 'Agent has no WC User ID linked' });
            return;
        }

        // Resolve WC customer ID from conversation
        let wcCustomerId = 0;
        if (conversation_id) {
            const custRow = await db.query(
                `SELECT ca.attr_value
                 FROM conversations conv
                 JOIN customer_attributes ca ON ca.customer_id = conv.customer_id
                 WHERE conv.id = $1 AND ca.attr_key = 'wc_customer_id'`,
                [conversation_id]
            );
            wcCustomerId = parseInt(custRow.rows[0]?.attr_value || '0', 10) || 0;
        }

        const auth = Buffer.from(`${creds.key}:${creds.secret}`).toString('base64');
        const bridgeRes = await fetch(`${creds.url}/wp-json/amunet-crm/v1/discount-request`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                agent_id:     wcAgentId,
                customer_id:  wcCustomerId,
                discount_pct: Number(discount_pct),
                reason:       reason || `Descuento ${discount_pct}% solicitado desde CRM`,
                cart_items:   Array.isArray(cart_items) ? cart_items : [],
            }),
        });

        const data: any = await bridgeRes.json();
        if (!bridgeRes.ok) {
            res.status(bridgeRes.status).json({ error: data.message || data.error || 'Bridge error' });
            return;
        }

        res.status(201).json({
            id:                  String(data.request_id),
            request_id:          data.request_id,
            approver_name:       data.approver_name,
            agent_max_discount:  data.agent_max_discount,
            status:              'pending',
        });
    } catch (err) {
        console.error('SalesKing discount-request error:', err);
        res.status(500).json({ error: String(err) });
    }
});

// POST /api/salesking/webhook/discount
// Receives approval/rejection webhook from the WordPress bridge.
// This route is intentionally public (no JWT auth) — mounted separately in index.ts.
// Emits a Socket.IO 'discount_response' event to the specific agent.
router.post('/webhook/discount', async (req: Request, res: Response) => {
    const { event, request_id, agent_id, amount, coupon_code } = req.body;

    if (!event || !request_id) {
        res.status(400).json({ error: 'Missing event or request_id' });
        return;
    }

    try {
        // Find CRM agent by their WC user ID
        const agentRow = await db.query(
            'SELECT id FROM agents WHERE wc_agent_id = $1',
            [String(agent_id)]
        );
        const crmAgentId = agentRow.rows[0]?.id;

        if (crmAgentId) {
            const approved = event === 'discount_approved';
            try {
                getIO().to(`agent:${crmAgentId}`).emit('discount_response', {
                    approved,
                    coupon_code: coupon_code || null,
                    amount:      Number(amount),
                    request_id:  String(request_id),
                });
            } catch { /* socket not ready */ }
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('SalesKing discount webhook error:', err);
        res.status(500).json({ error: String(err) });
    }
});

export default router;
