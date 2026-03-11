import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { bulkCampaignQueue } from '../queues';

const router = Router();
router.use(requireAuth);

// GET /api/bulk-campaigns
router.get('/', async (req: Request, res: Response) => {
    const result = await db.query('SELECT * FROM bulk_campaigns ORDER BY created_at DESC');
    res.json(result.rows);
});

// POST /api/bulk-campaigns
router.post('/', async (req: Request, res: Response) => {
    const { name, message_content, channel_id, filter_criteria, scheduled_at } = req.body;
    const agentId = (req as any).agent?.agentId;

    if (!name || !message_content || !channel_id) {
        res.status(400).json({ error: 'Name, message_content and channel_id are required' });
        return;
    }

    const result = await db.query(
        `INSERT INTO bulk_campaigns (name, message_content, channel_id, filter_criteria, scheduled_at, agent_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft')
         RETURNING *`,
        [name, message_content, channel_id, filter_criteria || '{}', scheduled_at, agentId]
    );

    res.status(201).json(result.rows[0]);
});

// POST /api/bulk-campaigns/:id/start
router.post('/:id/start', async (req: Request, res: Response) => {
    const { id } = req.params;

    // 1. Get campaign
    const campaignQ = await db.query('SELECT * FROM bulk_campaigns WHERE id = $1', [id]);
    if (campaignQ.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const campaign = campaignQ.rows[0];

    // 2. Identify recipients based on filter_criteria
    // This is a simplified version. In production, this would use BullMQ.
    const { label } = campaign.filter_criteria;

    let recipientQuery = `
        SELECT DISTINCT c.id as customer_id, conv.id as conversation_id
        FROM customers c
        JOIN conversations conv ON conv.customer_id = c.id
        WHERE conv.channel_id = $1
    `;
    const params = [campaign.channel_id];

    if (label) {
        params.push(label);
        recipientQuery += ` AND conv.conversation_label = $2`;
    }

    const recipients = await db.query(recipientQuery, params);

    // 3. Mark as running
    await db.query(
        `UPDATE bulk_campaigns SET status = 'running', started_at = NOW(), recipient_count = $1 WHERE id = $2`,
        [recipients.rows.length, id]
    );

    // 4. Create recipient entries AND enqueue them
    for (const r of recipients.rows) {
        await db.query(
            `INSERT INTO bulk_campaign_recipients (bulk_campaign_id, customer_id, conversation_id, status)
             VALUES ($1, $2, $3, 'pending')`,
            [id, r.customer_id, r.conversation_id]
        );

        // Add to queue
        await bulkCampaignQueue.add('sendBulkMessage', {
            recipientId: r.customer_id,
            campaignId: id,
            messageContent: campaign.message_content,
            channelId: campaign.channel_id
        });
    }

    res.json({ ok: true, recipient_count: recipients.rows.length });
});

// GET /api/bulk-campaigns/:id/recipients
router.get('/:id/recipients', async (req: Request, res: Response) => {
    const result = await db.query(
        `SELECT r.*, c.display_name as customer_name
         FROM bulk_campaign_recipients r
         JOIN customers c ON c.id = r.customer_id
         WHERE r.bulk_campaign_id = $1`,
        [req.params.id]
    );
    res.json(result.rows);
});

export default router;
