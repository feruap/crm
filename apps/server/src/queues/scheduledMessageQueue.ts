// FIX 3.1: Scheduled Messages Worker — messages were created but never executed
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../db';
import { deliverMessage } from '../services/message-sender';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

export interface ScheduledMsgJobData {
    scheduledMessageId: string;
    conversationId: string;
    channelId: string;
    customerId: string;
    content: string;
}

export const scheduledMsgQueue = new Queue<ScheduledMsgJobData>(
    'scheduled-messages',
    {
        connection: redis,
        defaultJobOptions: {
            removeOnComplete: 200,
            removeOnFail: 100,
            attempts: 3,
            backoff: { type: 'exponential', delay: 3000 },
        },
    }
);

// Worker processes jobs when their delay expires
export const scheduledMsgWorker = new Worker<ScheduledMsgJobData>(
    'scheduled-messages',
    async (job: Job<ScheduledMsgJobData>) => {
        const { scheduledMessageId, conversationId, channelId, customerId, content } = job.data;

        // Idempotent guard: only proceed if still pending
        const { rowCount } = await db.query(
            `UPDATE scheduled_messages SET status = 'sending', updated_at = NOW()
             WHERE id = $1 AND status = 'pending'`,
            [scheduledMessageId]
        );
        if (rowCount === 0) return; // already sent or cancelled

        try {
            // Get channel config to deliver
            const chRes = await db.query(
                `SELECT provider, provider_config FROM channels WHERE id = $1`,
                [channelId]
            );
            if (chRes.rows.length > 0) {
                const ch = chRes.rows[0];
                const config = typeof ch.provider_config === 'string'
                    ? JSON.parse(ch.provider_config)
                    : ch.provider_config;

                // Insert the message into DB
                await db.query(
                    `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, message_type, handled_by)
                     VALUES ($1, $2, $3, 'outbound', $4, 'text', 'agent')`,
                    [conversationId, channelId, customerId, content]
                );

                // Deliver via channel
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
            throw err; // triggers BullMQ retry
        }
    },
    { connection: redis, concurrency: 3 }
);

console.log('[ScheduledMessages] Worker started');
