// WC Webhook Worker — processes queued WooCommerce webhooks with retry + dead-letter
// Wrapped in try-catch so it doesn't crash the server if Redis is unavailable
try {
    const { Worker } = require('bullmq');
    const { connection, wcWebhookDeadLetterQueue } = require('../queues/wcWebhookQueue');
    const { db } = require('../db');
    const { receiveStatusFromWC } = require('../services/woocommerce');
    const { connection: redisConnection } = require('../queues');

    async function processWCWebhook(data: any): Promise<void> {
        const { event, payload } = data;

        // Handle order status webhooks (sent from WooCommerce or via bridge)
        if (
            event === 'woocommerce-status' ||
            event === 'order.status_changed' ||
            event === 'order.created' ||
            event === 'order.updated'
        ) {
            const order = payload;
            if (!order.id || !order.status) return;

            const externalOrderId = String(order.id);
            const newStatus = order.status;

            const result = await receiveStatusFromWC(externalOrderId, newStatus);
            if (result.ok) {
                console.log(`[WCWebhookWorker] Order #${externalOrderId} → ${newStatus}`);
            } else {
                console.error(
                    `[WCWebhookWorker] receiveStatusFromWC error for order #${externalOrderId}:`,
                    (result as any).error
                );
            }

            // Sync order record if it doesn't exist in CRM yet
            const existingOrder = await db.query(
                `SELECT id FROM orders WHERE external_order_id = $1`,
                [externalOrderId]
            );

            if (existingOrder.rows.length === 0 && order.total) {
                const customerEmail = order.billing?.email;
                let customerId: string | null = null;

                if (customerEmail) {
                    const customer = await db.query(
                        `SELECT c.id FROM customers c
                         JOIN customer_attributes ca ON ca.customer_id = c.id
                         WHERE ca.key = 'email' AND ca.value = $1
                         LIMIT 1`,
                        [customerEmail]
                    );
                    if (customer.rows.length > 0) {
                        customerId = customer.rows[0].id;
                    }
                }

                await db.query(
                    `INSERT INTO orders (external_order_id, customer_id, total_amount, currency, status, items, order_date)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (external_order_id) DO UPDATE
                         SET status = EXCLUDED.status, total_amount = EXCLUDED.total_amount`,
                    [
                        externalOrderId,
                        customerId,
                        order.total,
                        order.currency?.toUpperCase() || 'MXN',
                        newStatus,
                        JSON.stringify(order.line_items || []),
                        order.date_created || new Date().toISOString(),
                    ]
                );
            }
            return;
        }

        console.warn(`[WCWebhookWorker] Unhandled event type: ${event} — no-op`);
    }

    const worker = new Worker(
        'wc-webhook',
        async (job: any) => {
            console.log(`[WCWebhookWorker] Processing job ${job.id}, event: ${job.data.event}`);
            await processWCWebhook(job.data);
        },
        { connection: redisConnection, concurrency: 5 }
    );

    worker.on('completed', (job: any) => {
        console.log(`[WCWebhookWorker] Job ${job.id} completed`);
    });

    worker.on('failed', async (job: any, err: Error) => {
        console.error(
            `[WCWebhookWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts ?? 3}):`,
            err.message
        );

        // After all retries are exhausted, move to dead-letter queue for manual review
        if (job && job.attemptsMade >= (job.opts?.attempts ?? 3)) {
            try {
                const { wcWebhookDeadLetterQueue: dlq } = require('../queues/wcWebhookQueue');
                await dlq.add('dead', {
                    ...job.data,
                    _failedReason: err.message,
                    _failedAt: new Date().toISOString(),
                    _originalJobId: job.id,
                });
                console.log(`[WCWebhookWorker] Job ${job.id} moved to dead-letter queue`);
            } catch (dlqErr: any) {
                console.error(`[WCWebhookWorker] Failed to add to dead-letter queue:`, dlqErr.message);
            }
        }
    });

    console.log('[WCWebhookWorker] Worker started');

    module.exports = { worker };
} catch (err: any) {
    console.warn('[WCWebhookWorker] Worker init failed (non-fatal):', err.message);
    module.exports = {};
}
