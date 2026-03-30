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

// Types & Interfaces

interface SendResult {
  ok: boolean;
  provider_message_id?: string;
  error?: string;
}

interface ChannelRow {
  provider: string;
  provider_config?: Record<string, string>;
}

interface IdentityRow {
  provider_id: string;
}

interface MessageRow {
  id: string;
}

interface SendAndSaveResult {
  messageId: string;
  delivered: boolean;
  error?: string;
}

// Detect numbered options in bot text and extract buttons (max 3 for WhatsApp)
// Strip common product prefixes to create a short, meaningful button title (max 20 chars)
function shortenTitle(raw: string): string {
  let s = raw;
  // Remove common prefixes (case-insensitive)
  const prefixes = [
    /^prueba\s+r[aá]pida\s+de\s+/i,
    /^prueba\s+de\s+/i,
    /^prueba\s+/i,
    /^kit\s+de\s+detecci[oó]n\s+de\s+/i,
    /^kit\s+de\s+/i,
    /^test\s+r[aá]pido\s+de\s+/i,
    /^test\s+de\s+/i,
    /^panel\s+de\s+/i,
    /^reactivo\s+para\s+/i,
  ];
  for (const p of prefixes) {
    const shortened = s.replace(p, '');
    if (shortened !== s && shortened.length >= 3) {
      s = shortened;
      break;
    }
  }
  // Truncate to 20 chars at a word boundary if possible
  if (s.length <= 20) return s.trim();
  const truncated = s.substring(0, 20);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 10) return truncated.substring(0, lastSpace).trim();
  return truncated.trim();
}

export function extractButtons(text: string): { bodyText: string; buttons: Array<{ id: string; title: string }> } | null {
  const lines = text.split('\n');
  const buttons: Array<{ id: string; title: string }> = [];
  const bodyLines: string[] = [];
  let optionCount = 0;

  for (const line of lines) {
    const numMatch = line.match(/^\s*(\d+)[.)]\s*(.+)/);
    if (numMatch && buttons.length < 3) {
      optionCount++;
      let rawTitle = numMatch[2].replace(/\*\*/g, '').replace(/\*/g, '').trim();
      // Take text before separator (- or :) as product name
      const sepIdx = rawTitle.search(/\s[-–—:]\s/);
      if (sepIdx > 0) rawTitle = rawTitle.substring(0, sepIdx);
      const title = shortenTitle(rawTitle);
      if (title.length >= 3) {
        buttons.push({ id: `opt_${optionCount}`, title });
      } else {
        bodyLines.push(line);
      }
    } else {
      bodyLines.push(line);
    }
  }

  if (buttons.length >= 2) {
    // Ensure unique titles
    const uniqueTitles = new Set(buttons.map(b => b.title));
    if (uniqueTitles.size < buttons.length) {
      // Try prepending option number
      buttons.forEach((b, i) => { b.title = `${i+1}. ${b.title}`.substring(0, 20); });
      const retryUnique = new Set(buttons.map(b => b.title));
      if (retryUnique.size < buttons.length) {
        buttons.forEach((b, i) => { b.title = `Opción ${i + 1}`; });
      }
    }
    console.log(`[Buttons] Sending ${buttons.length}:`, buttons.map(b => b.title));
    return { bodyText: bodyLines.join('\n').trim(), buttons };
  }
  return null;
}

// WhatsApp Cloud API

async function sendWhatsApp(
  phoneNumberId: string,
  accessToken: string,
  recipientPhone: string,
  text: string
): Promise<SendResult> {
  try {
    // Try to detect interactive buttons in the message
    const interactive = extractButtons(text);
    
    let messageBody: Record<string, unknown>;
    if (interactive && interactive.buttons.length >= 2) {
      messageBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: interactive.bodyText.substring(0, 1024) },
          action: {
            buttons: interactive.buttons.map(b => ({
              type: 'reply',
              reply: { id: b.id, title: b.title }
            }))
          }
        }
      };
    } else {
      messageBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'text',
        text: { body: text },
      };
    }
    
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(messageBody),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return { ok: false, error: `WhatsApp API ${response.status}: ${err}` };
    }

    const data = await response.json() as Record<string, unknown>;
    const messages = data.messages as Array<{ id: string }> | undefined;
    return { ok: true, provider_message_id: messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Facebook Messenger Send API

async function sendFacebookMessenger(
  pageAccessToken: string,
  recipientPSID: string,
  text: string
): Promise<SendResult> {
  try {
    const response = await fetch(
      'https://graph.facebook.com/v19.0/me/messages',
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

    const data = await response.json() as { message_id?: string };
    return { ok: true, provider_message_id: data.message_id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Instagram Direct Send API

async function sendInstagramDirect(
  pageAccessToken: string,
  recipientIGSID: string,
  text: string
): Promise<SendResult> {
  try {
    const response = await fetch(
      'https://graph.facebook.com/v19.0/me/messages',
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

    const data = await response.json() as { message_id?: string };
    return { ok: true, provider_message_id: data.message_id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

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
      'SELECT provider, provider_config FROM channels WHERE id = $1',
      [channelId]
    );

    if (channelResult.rows.length === 0) {
      return { ok: false, error: 'Channel not found' };
    }

    const channel = channelResult.rows[0] as ChannelRow;
    const config = channel.provider_config || {};

    // Get customer's external ID for this provider
    const identity = await db.query(
      `SELECT provider_id FROM external_identities
       WHERE customer_id = $1 AND provider = $2
       LIMIT 1`,
      [customerId, channel.provider]
    );

    if (identity.rows.length === 0) {
      return {
        ok: false,
        error: `No ${channel.provider} identity found for customer`,
      };
    }

    const recipientId = (identity.rows[0] as IdentityRow).provider_id;

    let result: SendResult;

    // Route to the correct sender
    switch (channel.provider) {
      case 'whatsapp': {
        const phoneNumberId =
          config.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
        const token =
          config.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;

        if (!phoneNumberId || !token) {
          return { ok: false, error: 'WhatsApp credentials not configured' };
        }

        result = await sendWhatsApp(phoneNumberId, token, recipientId, content);
        break;
      }

      case 'facebook': {
        const token =
          config.page_access_token || process.env.FB_PAGE_ACCESS_TOKEN;

        if (!token) {
          return {
            ok: false,
            error: 'Facebook page access token not configured',
          };
        }

        result = await sendFacebookMessenger(token, recipientId, content);
        break;
      }

      case 'instagram': {
        const token =
          config.page_access_token || process.env.IG_PAGE_ACCESS_TOKEN;

        if (!token) {
          return {
            ok: false,
            error: 'Instagram page access token not configured',
          };
        }

        result = await sendInstagramDirect(token, recipientId, content);
        break;
      }

      default:
        return {
          ok: false,
          error: `Unsupported channel provider: ${channel.provider}`,
        };
    }

    // Update message with provider_message_id if sent successfully
    if (result.ok && result.provider_message_id) {
      await db.query(
        'UPDATE messages SET provider_message_id = $1 WHERE id = $2',
        [result.provider_message_id, messageId]
      );
    }

    // Log delivery result
    if (!result.ok) {
      console.error(
        `[Message Sender] Failed to deliver msg ${messageId} via ${channel.provider}:`,
        result.error
      );
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
  handledBy: string = 'bot',
  botAction?: string | null,
  botConfidence?: number | null
): Promise<SendAndSaveResult> {
  // Save to DB first
  const msg = await db.query(
    `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by, bot_action, bot_confidence)
     VALUES ($1, $2, $3, 'outbound', $4, $5, $6, $7)
     RETURNING id`,
    [conversationId, channelId, customerId, content, handledBy, botAction || null, botConfidence || null]
  );

  const messageId = (msg.rows[0] as MessageRow).id;

  // Deliver via the appropriate channel
  const delivery = await deliverMessage(
    messageId,
    conversationId,
    customerId,
    channelId,
    content
  );

  return {
    messageId,
    delivered: delivery.ok,
    error: delivery.error,
  };
}
