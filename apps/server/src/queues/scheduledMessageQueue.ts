// FIX 3.1: Scheduled Messages Worker
// Wrapped in try-catch so it doesn't crash the server if Redis is unavailable
try {
    const { Queue, Worker } = require('bullmq');
    const Redis = require('ioredis');
    const { db } = require('../db');

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });

    const scheduledMsgQueue = new Queue('scheduled-messages', {
        connection: redis,
        defaultJobOptions: {
            removeOnComplete: 200,
            removeOnFail: 100,
            attempts: 3,
            backoff: { type: 'exponential', delay: 3000 },
        },
    });

    const scheduledMsgWorker = new Worker(
        'scheduled-messages',
        async (job: any) => {
            const { scheduledMessageId, conversationId, channelId, customerId, content } = job.data;

            // Idempotent guard
            const { rowCount } = await db.query(
                `UPDATE scheduled_messages SET status = 'sending', updated_at = NOW()
                 WHERE id = $1 AND status = 'pending'`,
                [scheduledMessageId]
            );
            if (rowCount === 0) return;

            try {
                // Get channel config
                const chRes = await db.query(
                    `SELECT provider, provider_config FROM channels WHERE id = $1`,
                    [channelId]
                );
                if (chRes.rows.length > 0) {
                    // Insert message and deliver
                    await db.query(
                        `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, message_type, handled_by)
                         VALUES ($1, $2, $3, 'outbound', $4, 'text', 'agent')`,
                        [conversationId, channelId, customerId, content]
                    );

                    // Use the existing sendOutboundReply pattern
                    const { deliverMessage } = require('../services/message-sender');
                    const ch = chRes.rows[0];
                    const config = typeof ch.provider_config === 'string'
                        ? JSON.parse(ch.provider_config) : ch.provider_config;
                    await deliverMessage(ch.provider, config, customerId, content);
                }

                await db.query(
                    `UPDATE scheduled_messages SET status = 'sent', sent_at = NOW() WHERE id = $1`,
                    [scheduledMessageId]
                );
            } catch (err: any) {
                await db.query(
                    `UPDATE scheduled_messages SET status = 'failed', error = $2 WHERE id = $1`,
                    [scheduledMessageId, err.message]
                );
                throw err;
            }
        },
        { connection: redis, concurrency: 3 }
    );

    console.log('[ScheduledMessages] Worker started');

    module.exports = { scheduledMsgQueue, scheduledMsgWorker };
} catch (err: any) {
    console.warn('[ScheduledMessages] Worker init failed (non-fatal):', err.message);
    module.exports = {};
}
