import { db } from '../db';

export interface WCCreds {
    url: string;
    key: string;
    secret: string;
    webhookSecret: string;
}

/**
 * Read WooCommerce credentials from settings DB (UI-managed),
 * falling back to env vars for backwards compatibility.
 */
export async function getWCCreds(): Promise<WCCreds> {
    try {
        const result = await db.query(
            `SELECT key, value FROM settings WHERE key IN ('wc_url', 'wc_key', 'wc_secret', 'wc_webhook_secret')`
        );
        const map: Record<string, string> = {};
        for (const r of result.rows) map[r.key] = r.value;
        return {
            url: map['wc_url'] || process.env.WC_URL || '',
            key: map['wc_key'] || process.env.WC_KEY || '',
            secret: map['wc_secret'] || process.env.WC_SECRET || '',
            webhookSecret: map['wc_webhook_secret'] || process.env.WC_WEBHOOK_SECRET || '',
        };
    } catch {
        return {
            url: process.env.WC_URL || '',
            key: process.env.WC_KEY || '',
            secret: process.env.WC_SECRET || '',
            webhookSecret: process.env.WC_WEBHOOK_SECRET || '',
        };
    }
}
