import { Worker, Queue } from 'bullmq';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
};

const db = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'myalice_clone',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
});

// ─── Queue (export so webhook route can push jobs) ───────────────────────────
export const webhookQueue = new Queue('webhooks', { connection });

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveOrCreateCustomer(provider: string, providerId: string, displayName: string): Promise<string> {
    const existing = await db.query(
        `SELECT customer_id FROM external_identities WHERE provider = $1 AND provider_id = $2`,
        [provider, providerId]
    );
    if (existing.rows.length > 0) return existing.rows[0].customer_id;

    // Try to match by phone number in WooCommerce
    let wcCustomerId: number | null = null;
    if (provider === 'whatsapp') {
        wcCustomerId = await lookupWooCommerceCustomerByPhone(providerId);
    }

    const customer = await db.query(
        `INSERT INTO customers (display_name) VALUES ($1) RETURNING id`,
        [displayName || 'Unknown']
    );
    const customerId = customer.rows[0].id;

    await db.query(
        `INSERT INTO external_identities (customer_id, provider, provider_id, metadata)
         VALUES ($1, $2, $3, $4)`,
        [customerId, provider, providerId, wcCustomerId ? { wc_customer_id: wcCustomerId } : {}]
    );

    return customerId;
}

async function resolveOrCreateConversation(customerId: string, channelId: string): Promise<string> {
    const existing = await db.query(
        `SELECT id FROM conversations
         WHERE customer_id = $1 AND channel_id = $2 AND status IN ('open','pending')
         ORDER BY created_at DESC LIMIT 1`,
        [customerId, channelId]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;

    const conv = await db.query(
        `INSERT INTO conversations (customer_id, channel_id) VALUES ($1, $2) RETURNING id`,
        [customerId, channelId]
    );
    return conv.rows[0].id;
}

async function lookupWooCommerceCustomerByPhone(phone: string): Promise<number | null> {
    const wcUrl    = process.env.WC_URL;
    const wcKey    = process.env.WC_KEY;
    const wcSecret = process.env.WC_SECRET;
    if (!wcUrl || !wcKey || !wcSecret) return null;

    try {
        const auth = Buffer.from(`${wcKey}:${wcSecret}`).toString('base64');
        // WooCommerce doesn't have a direct phone search — search by billing phone
        const r = await fetch(
            `${wcUrl}/wp-json/wc/v3/customers?search=${encodeURIComponent(phone)}`,
            { headers: { Authorization: `Basic ${auth}` } }
        );
        const customers: any[] = await r.json();
        const match = customers.find(c =>
            c.billing?.phone?.replace(/\D/g, '').includes(phone.replace(/\D/g, ''))
        );
        return match?.id ?? null;
    } catch {
        return null;
    }
}

// ─── Worker ──────────────────────────────────────────────────────────────────

const worker = new Worker('webhooks', async (job) => {
    const { type, data } = job.data;

    if (type === 'meta_message' || type === 'whatsapp_message') {
        const { provider, providerId, displayName, messageText, messageId, channelId } = data;

        const customerId     = await resolveOrCreateCustomer(provider, providerId, displayName);
        const conversationId = await resolveOrCreateConversation(customerId, channelId);

        await db.query(
            `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, provider_message_id)
             VALUES ($1, $2, $3, 'inbound', $4, $5)
             ON CONFLICT DO NOTHING`,
            [conversationId, channelId, customerId, messageText, messageId]
        );

        // Update conversation timestamp
        await db.query(
            `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
            [conversationId]
        );

        console.log(`[Worker] Processed ${type} — conv: ${conversationId}`);
    }

}, { connection, concurrency: 5 });

worker.on('completed', job => console.log(`[Worker] Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[Worker] Job ${job?.id} failed:`, err));

console.log('Webhook worker started');
