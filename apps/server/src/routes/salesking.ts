import { Router, Request, Response } from 'express';
import { db } from '../db';
import { getWCCreds } from '../utils/wc-creds';
import { requireRole } from '../middleware/auth';
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
        fetch(`${creds.url}/wp-json/myalice-crm/v1/salesking-agent/${wcAgentId}`, {
            headers: { Authorization: `Basic ${auth}` },
        }),
        fetch(`${creds.url}/wp-json/myalice-crm/v1/salesking-settings`, {
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
// Agent requests a special discount that exceeds their limit.
router.post('/discount-request', async (req: Request, res: Response) => {
    const { conversation_id, product_id, product_name, original_price, requested_price } = req.body;
    const agentId = req.agent!.agentId;

    if (!product_id || !product_name || original_price == null || requested_price == null) {
        res.status(400).json({ error: 'Missing required fields: product_id, product_name, original_price, requested_price' });
        return;
    }

    const origNum = Number(original_price);
    const reqNum = Number(requested_price);

    if (reqNum <= 0 || reqNum >= origNum) {
        res.status(400).json({ error: 'requested_price must be positive and less than original_price' });
        return;
    }

    const discount_pct = ((1 - reqNum / origNum) * 100).toFixed(2);

    try {
        const result = await db.query(
            `INSERT INTO discount_requests
               (agent_id, conversation_id, product_id, product_name, original_price, requested_price, discount_pct)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [agentId, conversation_id ?? null, product_id, product_name, origNum, reqNum, discount_pct]
        );
        const dr = result.rows[0];

        const agentRow = await db.query('SELECT name FROM agents WHERE id = $1', [agentId]);
        const agentName = agentRow.rows[0]?.name || 'Agente';

        // Notify all supervisors/admins via their personal Socket.IO rooms
        const supervisors = await db.query(
            `SELECT id FROM agents WHERE role IN ('supervisor', 'admin', 'superadmin')`
        );
        try {
            const io = getIO();
            for (const sup of supervisors.rows) {
                io.to(`agent:${sup.id}`).emit('discount_request', {
                    id: dr.id,
                    agent_id: agentId,
                    agent_name: agentName,
                    product_name,
                    original_price: origNum,
                    requested_price: reqNum,
                    discount_pct: Number(discount_pct),
                    conversation_id: conversation_id ?? null,
                    created_at: dr.created_at,
                });
            }
        } catch { /* socket not initialized in tests */ }

        res.status(201).json({ id: dr.id, status: 'pending' });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// GET /api/salesking/discount-requests/pending
// Supervisors/admins list pending discount approval requests.
router.get(
    '/discount-requests/pending',
    requireRole('supervisor', 'admin', 'superadmin'),
    async (_req: Request, res: Response) => {
        try {
            const result = await db.query(
                `SELECT dr.*, a.name AS agent_name
                 FROM discount_requests dr
                 JOIN agents a ON dr.agent_id = a.id
                 WHERE dr.status = 'pending'
                 ORDER BY dr.created_at DESC`
            );
            res.json({ requests: result.rows });
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    }
);

// PUT /api/salesking/discount-request/:id/approve
router.put(
    '/discount-request/:id/approve',
    requireRole('supervisor', 'admin', 'superadmin'),
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { approved_price, note } = req.body;
        const supervisorId = req.agent!.agentId;

        try {
            const result = await db.query(
                `UPDATE discount_requests
                 SET status = 'approved',
                     approved_price = COALESCE($1::numeric, requested_price),
                     supervisor_id = $2,
                     supervisor_note = $3,
                     updated_at = NOW()
                 WHERE id = $4 AND status = 'pending'
                 RETURNING *`,
                [approved_price ?? null, supervisorId, note ?? null, id]
            );

            if (result.rowCount === 0) {
                res.status(404).json({ error: 'Request not found or already processed' });
                return;
            }
            const dr = result.rows[0];
            const finalPrice = Number(dr.approved_price);

            const supRow = await db.query('SELECT name FROM agents WHERE id = $1', [supervisorId]);
            try {
                getIO().to(`agent:${dr.agent_id}`).emit('discount_approved', {
                    request_id: dr.id,
                    product_id: dr.product_id,
                    product_name: dr.product_name,
                    approved_price: finalPrice,
                    original_price: Number(dr.original_price),
                    supervisor_name: supRow.rows[0]?.name || 'Supervisor',
                    note: note ?? null,
                });
            } catch { /* socket not ready */ }

            res.json({ ok: true, approved_price: finalPrice });
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    }
);

// PUT /api/salesking/discount-request/:id/reject
router.put(
    '/discount-request/:id/reject',
    requireRole('supervisor', 'admin', 'superadmin'),
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { note } = req.body;
        const supervisorId = req.agent!.agentId;

        try {
            const result = await db.query(
                `UPDATE discount_requests
                 SET status = 'rejected',
                     supervisor_id = $1,
                     supervisor_note = $2,
                     updated_at = NOW()
                 WHERE id = $3 AND status = 'pending'
                 RETURNING *`,
                [supervisorId, note ?? null, id]
            );

            if (result.rowCount === 0) {
                res.status(404).json({ error: 'Request not found or already processed' });
                return;
            }
            const dr = result.rows[0];

            const supRow = await db.query('SELECT name FROM agents WHERE id = $1', [supervisorId]);
            try {
                getIO().to(`agent:${dr.agent_id}`).emit('discount_rejected', {
                    request_id: dr.id,
                    product_id: dr.product_id,
                    product_name: dr.product_name,
                    original_price: Number(dr.original_price),
                    requested_price: Number(dr.requested_price),
                    supervisor_name: supRow.rows[0]?.name || 'Supervisor',
                    note: note ?? null,
                });
            } catch { /* socket not ready */ }

            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    }
);

export default router;
