import { Worker, Job } from 'bullmq';
import { connection } from '../queues';
import { db } from '../db';
import axios from 'axios';

const worker = new Worker('bulkCampaigns', async (job: Job) => {
    const { recipientId, campaignId, messageContent, channelId } = job.data;

    console.log(`Processing bulk message for recipient ${recipientId} in campaign ${campaignId}`);

    try {
        // 1. Get channel config
        const channelQ = await db.query('SELECT * FROM channels WHERE id = $1', [channelId]);
        if (channelQ.rows.length === 0) throw new Error('Channel not found');
        const channel = channelQ.rows[0];

        // 2. Get recipient (customer) identity for this channel
        // Usually, we pick the first phone number or PSID
        const identityQ = await db.query(
            'SELECT * FROM external_identities WHERE customer_id = $1 AND provider = $2',
            [recipientId, channel.provider]
        );
        if (identityQ.rows.length === 0) throw new Error('Recipient identity not found for this channel');
        const identity = identityQ.rows[0];

        // 3. Send message (Simulated or Real depending on provider)
        // In this clone, we simulate sending or use a placeholder axios call
        console.log(`Sending message to ${identity.provider_id} via ${channel.provider}: ${messageContent}`);

        // Simulate API delay
        await new Promise(r => setTimeout(r, 1000));

        // 4. Record message in DB
        await db.query(
            `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, message_type, handled_by)
             (SELECT conversation_id, $1, $2, 'outbound', $3, 'text', 'bot' 
              FROM bulk_campaign_recipients 
              WHERE bulk_campaign_id = $4 AND customer_id = $2 LIMIT 1)`,
            [channelId, recipientId, messageContent, campaignId]
        );

        // 5. Update recipient status
        await db.query(
            `UPDATE bulk_campaign_recipients SET status = 'sent', sent_at = NOW() WHERE bulk_campaign_id = $1 AND customer_id = $2`,
            [campaignId, recipientId]
        );

        // 6. Increment campaign sent count
        await db.query(`UPDATE bulk_campaigns SET sent_count = sent_count + 1 WHERE id = $1`, [campaignId]);

    } catch (error: any) {
        console.error(`Failed to send bulk message: ${error.message}`);
        await db.query(
            `UPDATE bulk_campaign_recipients SET status = 'failed', error_message = $1 WHERE bulk_campaign_id = $2 AND customer_id = $3`,
            [error.message, campaignId, recipientId]
        );
        await db.query(`UPDATE bulk_campaigns SET failed_count = failed_count + 1 WHERE id = $1`, [campaignId]);
    }
}, { connection: connection as any });

worker.on('completed', job => {
    console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed: ${err.message}`);
});

export default worker;
