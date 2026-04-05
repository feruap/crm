import { Queue } from 'bullmq';
import { connection } from '../queues';

export interface WCWebhookJobData {
    event: string;
    payload: Record<string, any>;
    receivedAt: string;
    // Added when moved to dead-letter
    _failedReason?: string;
    _failedAt?: string;
    _originalJobId?: string;
}

export const wcWebhookQueue = new Queue<WCWebhookJobData>('wc-webhook', {
    connection: connection as any,
    defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 500,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
    },
});

// Dead-letter queue: retains webhooks that exhausted all retry attempts for manual review
export const wcWebhookDeadLetterQueue = new Queue<WCWebhookJobData>('wc-webhook-dead', {
    connection: connection as any,
    defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
    },
});
