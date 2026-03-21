/**
 * Outbound Message Sender Service
 *
 * Actually delivers messages to customers via:
 * - WhatsApp Cloud API
 * - Facebook Messenger (Page Send API)
 * - Instagram Direct (Page Send API)
 *
 * Called when:
 * - An agent sends a reply from the CRM
 * - The bot generates a response
 * - A campaign auto-reply is triggered
 */

import { db } from '../db';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface SendResult {
    ok: boolean;
    provider_message_id?: string;
    error?: string;
}

interface ChannelConfig {
    provider: string;
    provider_config: {
        page_access_token?: string;
        phone_number_id?: string;
        whatsapp_access_token?: string;
        page_id?: string;
    } | null;
}

// ─────────────────────────────────────────────
// WhatsApp Cloud API
// ─────────────────────────────────────────────

async function sendWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    recipientPhone: string,
    text: string
): Promise<SendResult> {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: recipientPhone,
                    type: 'text',
                    text: { body: text },
                }),
            }
        );

        if (!response.ok) {
            const err = await response.text();
            return { ok: false, error: `WhatsApp API ${response.status}: ${err}` };
        }

        const data = await response.json() as { messages: Array<{ id: string }> };
        return { ok: true, provider_message_id: data.messages?.[0]?.id };
    } catch (err) {
        return { ok: false, error: String(err) };
    }
}

// ─────────────────────────────────────────────
// Facebook Messenger Send API
// ─────────────────────────────────────────────

async function sendFacebookMessenger(
    pageAccessToken: string,
    recipientPSID: string,
    text: string
): Promise<SendResult> {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v19.0/me/messages`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${pageAccessToken}`,
                },
                body: JSON.stringify({
                    recipient: { id: recipientPSID },
                    message: { text },
                    messaging_type: 'RESPONSE',
                }),
            }
        );

        if (!response.ok) {
            const err = await response.text();
            return { ok: false, error: `FB Messenger API ${response.status}: ${err}` };
        }

        const data = await response.json() as { message_id: string };
        return { ok: true, provider_message_id: data.message_id };
    } catch (err) {
        return { ok: false, error: String(err) };
    }
}

// ─────────────────────────────────────────────
// Instagram Direct Send API
// ─────────────────────────────────────────────

async function sendInstagramDirect(
    pageAccessToken: string,
    recipientIGSID: string,
    text: string
): Promise<SendResult> {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v19.0/me/messages`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${pageAccessToken}`,
                },
                body: JSON.stringify({
                    recipient: { id: recipientIGSID },
                    message: { text },
                    messaging_type: 'RESPONSE',
                }),
            }
        );

        if (!response.ok) {
            const err = await response.text();
            return { ok: false, error: `IG Direct API ${response.status}: ${err}` };
        }

        const data = await response.json() as { message_id: string };
        return { ok: true, provider_message_id: data.message_id };
    } catch (err) {
        return { ok: false, error: String(err) };
    }
}

// ─────────────────────────────────────────────
// Public: Send Message to Customer
// ─────────────────────────────────────────────

/**
 * Delivers an outbound message to a customer via their channel.
 * Looks up the channel config, finds the customer's external ID,
 * and routes to the correct send API.
 *
 * Also updates the message record with the provider_message_id.
 */
export async function deliverMessage(
    messageId: string,
    conversationId: string,
    customerId: string,
    channelId: string,
    content: string
): Promise<SendResult> {
    try {
        // Get channel config
        const channelResult = await db.query(
            `SELECT provider, provider_config FROM channels WHERE id = $1`,
            [channelId]
        );

        if (channelResult.rows.length === 0) {
            return { ok: false, error: 'Channel not found' };
        }

        const channel = channelResult.rows[0] as ChannelConfig;
        const config = channel.provider_config || {};

        // Get customer's external ID for this provider
        const identity = await db.query(
            `SELECT provider_id FROM external_identities
             WHERE customer_id = $1 AND provider = $2
             LIMIT 1`,
            [customerId, channel.provider]
        );

        if (identity.rows.length === 0) {
            return { ok: false, error: `No ${channel.provider} identity found for customer` };
        }

        const recipientId = identity.rows[0].provider_id;
        let result: SendResult;

        // Route to the correct sender
        switch (channel.provider) {
            case 'whatsapp': {
                const phoneNumberId = config.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
                const token = config.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;

                if (!phoneNumberId || !token) {
                    return { ok: false, error: 'WhatsApp credentials not configured' };
                }

                result = await sendWhatsApp(phoneNumberId, token, recipientId, content);
                break;
            }

            case 'facebook': {
                const token = config.page_access_token || process.env.FB_PAGE_ACCESS_TOKEN;
                if (!token) {
                    return { ok: false, error: 'Facebook page access token not configured' };
                }
                result = await sendFacebookMessenger(token, recipientId, content);
                break;
            }

            case 'instagram': {
                const token = config.page_access_token || process.env.IG_PAGE_ACCESS_TOKEN;
                if (!token) {
                    return { ok: false, error: 'Instagram page access token not configured' };
                }
                result = await sendInstagramDirect(token, recipientId, content);
                break;
            }

            default:
                return { ok: false, error: `Unsupported channel provider: ${channel.provider}` };
        }

        // Update message with provider_message_id if sent successfully
        if (result.ok && result.provider_message_id) {
            await db.query(
                `UPDATE messages SET provider_message_id = $1 WHERE id = $2`,
                [result.provider_message_id, messageId]
            );
        }

        // Log delivery result
        if (!result.ok) {
            console.error(`[Message Sender] Failed to deliver msg ${messageId} via ${channel.provider}:`, result.error);
        }

        return result;
    } catch (err) {
        return { ok: false, error: String(err) };
    }
}

/**
 * Send and save an outbound message in one call.
 * Used by the bot and auto-reply systems.
 */
export async function sendAndSaveMessage(
    conversationId: string,
    channelId: string,
    customerId: string,
    content: string,
    handledBy: 'bot' | 'human' = 'bot',
    botAction?: string,
    botConfidence?: number
): Promise<{ messageId: string; delivered: boolean; error?: string }> {
    // Save to DB first
    const msg = await db.query(
        `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by, bot_action, bot_confidence)
         VALUES ($1, $2, $3, 'outbound', $4, $5, $6, $7)
         RETURNING id`,
        [conversationId, channelId, customerId, content, handledBy, botAction || null, botConfidence || null]
    );

    const messageId = msg.rows[0].id;

    // Deliver via the appropriate channel
    const delivery = await deliverMessage(messageId, conversationId, customerId, channelId, content);

    return {
        messageId,
        delivered: delivery.ok,
        error: delivery.error,
    };
}
