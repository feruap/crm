import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { db } from '../db';
import { findBestAnswer, generateEmbedding, getAIResponse, recordKnowledgeUse } from '../ai.service';
import { findMatchingFlow, isWithinBusinessHours } from './flows';
import { assignFromGroup } from './agent-groups';
import { emitNewMessage, getIO } from '../socket';
import { handleIncomingMessage } from '../services/smart-bot-engine';
import { executeHandoff } from '../services/escalation-engine';
import { recordTouchpoint, findCampaignMapping, sendCampaignAutoReply, recordUTMTouchpoint } from '../services/campaign-responder';
import { deliverMessage } from '../services/message-sender';
import { receiveStatusFromWC } from '../services/woocommerce';

// ─────────────────────────────────────────────
// Send outbound reply via the channel's native API (WhatsApp, Messenger, etc.)
// ─────────────────────────────────────────────
async function sendOutboundReply(
    channelId: string,
    customerId: string,
    replyText: string
): Promise<void> {
    try {
        // Get channel info + provider config
        const chResult = await db.query(
            `SELECT provider, provider_config FROM channels WHERE id = $1`,
            [channelId]
        );
        if (chResult.rows.length === 0) return;

        const { provider, provider_config } = chResult.rows[0];
        const config = typeof provider_config === 'string' ? JSON.parse(provider_config) : (provider_config || {});

        // Get customer's external ID (phone number for WhatsApp, page-scoped ID for Messenger)
        const eiResult = await db.query(
            `SELECT provider_id FROM external_identities WHERE customer_id = $1 AND provider = $2 LIMIT 1`,
            [customerId, provider]
        );
        if (eiResult.rows.length === 0) {
            console.log(`[SendReply] No external identity for customer ${customerId} on ${provider}`);
            return;
        }
        const recipientId = eiResult.rows[0].provider_id;

        if (provider === 'whatsapp') {
            // Get access token: first from channel config, then from business_settings, then from env
            let accessToken = config.access_token;
            if (!accessToken) {
                const tokenRow = await db.query(`SELECT value FROM business_settings WHERE key = 'meta_access_token' LIMIT 1`);
                accessToken = tokenRow.rows[0]?.value || process.env.META_ACCESS_TOKEN;
            }
            const phoneNumberId = config.phone_number_id;

            if (!accessToken || !phoneNumberId) {
                console.error(`[SendReply] WhatsApp channel missing access_token or phone_number_id`);
                return;
            }

            const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
            console.log(`📤 Sending WhatsApp reply to ${recipientId} via phone ${phoneNumberId}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: recipientId,
                    type: 'text',
                    text: { preview_url: false, body: replyText },
                }),
            });

            if (!response.ok) {
                const errBody = await response.text();
                console.error(`❌ WhatsApp send failed (${response.status}): ${errBody}`);
            } else {
                const result = await response.json();
                console.log(`✅ WhatsApp reply sent. Message ID: ${(result as any)?.messages?.[0]?.id}`);
            }
        } else if (provider === 'facebook' || provider === 'instagram') {
            // Meta Messenger / Instagram Direct send-back
            let accessToken = config.access_token;
            if (!accessToken) {
                const tokenRow = await db.query(`SELECT value FROM business_settings WHERE key = 'meta_access_token' LIMIT 1`);
                accessToken = tokenRow.rows[0]?.value || process.env.META_ACCESS_TOKEN;
            }
            if (!accessToken) {
                console.error(`[SendReply] ${provider} channel missing access_token`);
                return;
            }

            const url = provider === 'instagram'
                ? `https://graph.facebook.com/v21.0/me/messages`
                : `https://graph.facebook.com/v21.0/me/messages`;

            console.log(`📤 Sending ${provider} reply to ${recipientId}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text: replyText },
                }),
            });

            if (!response.ok) {
                const errBody = await response.text();
                console.error(`❌ ${provider} send failed (${response.status}): ${errBody}`);
            } else {
                console.log(`✅ ${provider} reply sent to ${recipientId}`);
            }
        }
        // webchat, tiktok — no outbound API needed (handled by socket/other mechanisms)
    } catch (err: any) {
        console.error(`[SendReply] Error:`, err.message);
    }
}

const router = Router();

// Helper: get a business setting from DB, fallback to env var
async function getBusinessSetting(key: string, envFallback?: string): Promise<string | null> {
    try {
        const row = await db.query(`SELECT value FROM business_settings WHERE key = $1 LIMIT 1`, [key]);
        if (row.rows[0]?.value) return row.rows[0].value;
    } catch { /* ignore */ }
    return envFallback || null;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function validateMetaSignature(req: Request, secret: string): boolean {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) return false;
    const expected = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update((req as any).rawBody || JSON.stringify(req.body))
        .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function resolveOrCreateCustomer(
    provider: string,
    providerId: string,
    displayName: string
): Promise<string> {
    // Find existing identity
    const existing = await db.query(
        `SELECT customer_id FROM external_identities WHERE provider = $1 AND provider_id = $2`,
        [provider, providerId]
    );
    if (existing.rows.length > 0) return existing.rows[0].customer_id;

    // Create new customer + identity
    const customer = await db.query(
        `INSERT INTO customers (display_name) VALUES ($1) RETURNING id`,
        [displayName || 'Unknown']
    );
    const customerId = customer.rows[0].id;

    await db.query(
        `INSERT INTO external_identities (customer_id, provider, provider_id) VALUES ($1, $2, $3)`,
        [customerId, provider, providerId]
    );

    return customerId;
}

/**
 * Resolve Facebook user's real name from Graph API.
 * Falls back to PSID if API call fails or name is not available.
 */
async function resolveFacebookProfileName(psid: string, accessToken: string): Promise<string> {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${psid}?fields=first_name,last_name,profile_pic&access_token=${accessToken}`,
            { method: 'GET' }
        );
        if (!response.ok) {
            console.warn(`[FB Graph API] Failed to resolve profile for ${psid}: ${response.status}`);
            return psid;
        }
        const data = await response.json() as any;
        const firstName = data.first_name || '';
        const lastName = data.last_name || '';
        const displayName = `${firstName} ${lastName}`.trim();
        if (!displayName) return psid;
        console.log(`[FB Graph API] Resolved profile for ${psid}: ${displayName}`);
        return displayName;
    } catch (err) {
        console.error(`[FB Graph API] Error resolving profile for ${psid}:`, err);
        return psid;
    }
}

async function resolveOrCreateConversation(
    customerId: string,
    channelId: string,
    referralData?: any,
    utmData?: any
): Promise<{ conversationId: string; isNew: boolean }> {
    const existing = await db.query(
        `SELECT id FROM conversations
         WHERE customer_id = $1 AND channel_id = $2 AND status IN ('open', 'pending')
         ORDER BY created_at DESC LIMIT 1`,
        [customerId, channelId]
    );
    if (existing.rows.length > 0) return { conversationId: existing.rows[0].id, isNew: false };

    // Create new conversation with referral/UTM data
    const conv = await db.query(
        `INSERT INTO conversations (customer_id, channel_id, referral_data, utm_data) VALUES ($1, $2, $3, $4) RETURNING id`,
        [customerId, channelId, referralData ? JSON.stringify(referralData) : null, utmData ? JSON.stringify(utmData) : null]
    );
    const convId = conv.rows[0].id;

    // AUTO-ASSIGNMENT LOGIC
    try {
        const rules = await db.query(
            `SELECT * FROM assignment_rules 
             WHERE is_active = TRUE AND (channel_id = $1 OR channel_id IS NULL)
             ORDER BY channel_id NULLS LAST LIMIT 1`,
            [channelId]
        );

        if (rules.rows.length > 0) {
            const rule = rules.rows[0];
            let agentId = null;

            if (rule.strategy === 'round_robin' && rule.agent_ids?.length > 0) {
                const index = rule.current_index % rule.agent_ids.length;
                agentId = rule.agent_ids[index];

                // Update current_index for next time
                await db.query(
                    'UPDATE assignment_rules SET current_index = current_index + 1 WHERE id = $1',
                    [rule.id]
                );
            } else if (rule.strategy === 'random' && rule.agent_ids?.length > 0) {
                agentId = rule.agent_ids[Math.floor(Math.random() * rule.agent_ids.length)];
            }

            if (agentId) {
                await db.query(
                    'UPDATE conversations SET assigned_agent_id = $1 WHERE id = $2',
                    [agentId, convId]
                );
                console.log(`[AutoAssign] Conv ${convId} assigned to agent ${agentId} via rule "${rule.name}"`);
            }
        }
    } catch (err) {
        console.error('[AutoAssign] Error:', err);
    }

    return { conversationId: convId, isNew: true };
}

// ─────────────────────────────────────────────
// Auto-attribution: detect campaign from Meta referral
// Fired when a Click-to-Messenger or Click-to-IG-DM ad is the entry point
// ─────────────────────────────────────────────
async function autoAttributeFromReferral(
    customerId: string,
    conversationId: string,
    platform: 'facebook' | 'instagram',
    adId: string | null,
    adSetId: string | null,
    adContextData: object | null
): Promise<void> {
    if (!adId) return;
    try {
        // Look up campaign by platform_ad_id
        let campaign = await db.query(
            `SELECT id FROM campaigns WHERE platform = $1 AND platform_ad_id = $2 LIMIT 1`,
            [platform, adId]
        );

        if (campaign.rows.length === 0) {
            const name = (adContextData as any)?.ad_title ?? `${platform} ad ${adId}`;
            campaign = await db.query(
                `INSERT INTO campaigns (platform, platform_campaign_id, platform_ad_id, name, metadata)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (platform, platform_campaign_id)
                     DO UPDATE SET platform_ad_id = EXCLUDED.platform_ad_id
                 RETURNING id`,
                [platform, adId, adId, name, JSON.stringify(adContextData ?? {})]
            );
        }

        const campaignId = campaign.rows[0].id;

        await db.query(
            `INSERT INTO attributions (customer_id, campaign_id, conversation_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [customerId, campaignId, conversationId]
        );

        console.log(`[Attribution] ${platform} ad ${adId} → conv ${conversationId}`);
    } catch (err) {
        console.error('[Attribution] error:', err);
    }
}

export async function handleBotResponse(
    conversationId: string,
    channelId: string,
    customerId: string,
    messageText: string,
    referral?: Record<string, any>
): Promise<void> {
    try {
        const { emitNewMessage, emitConversationUpdated, getIO } = require('../socket');

        // ── 1. Check for matching bot_flow ────────────────────────────────────
        try {
            // Determine context for flow matching
            const channel = await db.query(`SELECT provider, provider_config->>'brand_name' AS brand_name FROM channels WHERE id = $1`, [channelId]);
            const provider = channel.rows[0]?.provider || 'whatsapp';
            // channelBrandName moved to outer scope as brandName

            const msgCount = await db.query(
                `SELECT COUNT(*) FROM messages WHERE conversation_id = $1 AND direction = 'inbound'`,
                [conversationId]
            );
            const isFirstMessage = parseInt(msgCount.rows[0].count) <= 1;

            // Check campaign attribution
            const attribution = await db.query(
                `SELECT campaign_id FROM attributions WHERE conversation_id = $1 LIMIT 1`,
                [conversationId]
            );
            const campaignId = attribution.rows[0]?.campaign_id || null;

            const afterHours = !(await isWithinBusinessHours());

            const matchedFlow = await findMatchingFlow({
                provider,
                messageText,
                isFirstMessage,
                campaignId,
                isAfterHours: afterHours,
            });

            if (matchedFlow) {
                console.log(`[BotFlow] Matched flow "${matchedFlow.name}" (${matchedFlow.flow_type}) for conv ${conversationId}`);

                if (matchedFlow.flow_type === 'visual' && matchedFlow.nodes) {
                    await executeVisualFlow(matchedFlow, conversationId, channelId, customerId, messageText);
                    return;
                }
                // For simple flows, we could use the steps field — for now fall through to RAG+AI
            }
        } catch (flowErr) {
            console.error('[BotFlow] Error matching flow:', flowErr);
            // Fall through to RAG+AI
        }

        // ── 2. Fallback: RAG + AI response (original behavior) ───────────────
        const settings = await db.query(
            `SELECT provider, api_key_encrypted, system_prompt, model_name
             FROM ai_settings WHERE is_default = TRUE LIMIT 1`
        );
        if (settings.rows.length === 0) return;

        const { provider: aiProvider, api_key_encrypted, system_prompt: rawPrompt, model_name } = settings.rows[0];

        // Inject channel brand name into system prompt
        const chBrand = await db.query(`SELECT brand_name, name FROM channels WHERE id = $1`, [channelId]);
        const brandName = chBrand.rows[0]?.brand_name || chBrand.rows[0]?.name || 'Amunet';
        const system_prompt = rawPrompt ? rawPrompt.replace(/Amunet/gi, brandName) : rawPrompt;

        const embedding = await generateEmbedding(messageText, aiProvider, api_key_encrypted);
        const knowledgeHit = await findBestAnswer(messageText, embedding);

        let botReply: string;
        let confidence: number;
        let knowledgeContext: string | undefined = undefined;

        if (knowledgeHit && knowledgeHit.confidence > 0.90) {
            botReply = knowledgeHit.answer;
            confidence = knowledgeHit.confidence;
            await recordKnowledgeUse(knowledgeHit.knowledgeId as any);
        } else {
            if (knowledgeHit && knowledgeHit.confidence > 0.30) {
                knowledgeContext = `Información relacionada encontrada en la base de datos:\n- Pregunta/Contexto: ${knowledgeHit.question}\n- Respuesta base: ${knowledgeHit.answer}`;
                await recordKnowledgeUse(knowledgeHit.knowledgeId as any);
            }

            let finalSystemPrompt = system_prompt || '';
            if (brandName && brandName !== 'Amunet') {
                finalSystemPrompt = `Eres el asistente de ${brandName}. ` + finalSystemPrompt;
            }
            botReply = await getAIResponse(
                aiProvider as any,
                finalSystemPrompt,
                messageText,
                api_key_encrypted,
                model_name,
                customerId,
                knowledgeContext,
                conversationId
            );
            confidence = knowledgeHit ? knowledgeHit.confidence : 0.5;
        }

        const result = await db.query(
            `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by, bot_confidence)
             VALUES ($1, $2, $3, 'outbound', $4, 'bot', $5) RETURNING *`,
            [conversationId, channelId, customerId, botReply, confidence]
        );

        const insertedMessage = result.rows[0];
        emitNewMessage(conversationId, insertedMessage);
        emitConversationUpdated(conversationId, {
            last_message: botReply,
            last_message_at: insertedMessage.created_at,
        });
        getIO().emit('conversation_list_updated', { conversation_id: conversationId });

        // ── Send the reply back via the channel's native API (WhatsApp, Messenger, etc.) ──
        await sendOutboundReply(channelId, customerId, botReply);
    } catch (err: any) {
        console.error('🤖 Bot Error:', err.message, err.stack?.split('\n').slice(0,3).join('\n'));
        try { require('fs').appendFileSync('/tmp/bot_crash.log', `[${new Date().toISOString()}] Bot Error: ${err.message}\n${err.stack}\n`); } catch (_) { /* ignore log write failures in Docker */ }

        // Friendly fallback message for the customer — never expose internal errors
        const friendlyMessage = "¡Hola! Un momento, te atiendo enseguida. 😊";

        // Log the real error internally for CRM agents
        if (err.message.includes("1113") || err.message.includes("余额不足")) {
            console.error('⚠️ Z.ai/Zhipu credits exhausted (Error 429). Please recharge API credits.');
        }

        try {
            const fallback = await db.query(
                `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by, bot_confidence)
                 VALUES ($1, $2, $3, 'outbound', $4, 'bot', 0) RETURNING *`,
                [conversationId, channelId, customerId, friendlyMessage]
            );
            const { emitNewMessage, emitConversationUpdated, getIO } = require('../socket');
            emitNewMessage(conversationId, fallback.rows[0]);
            emitConversationUpdated(conversationId, {
                last_message: friendlyMessage,
                last_message_at: fallback.rows[0].created_at,
            });
            getIO().emit('conversation_list_updated', { conversation_id: conversationId });
        } catch (dbErr) {
            console.error('🤖 Bot Error: Failed to save fallback message:', dbErr);
        }
    }
}

// ── Visual Flow Executor ─────────────────────────────────────────────────────
// Walks through nodes following edges from the trigger, executing each action.

async function executeVisualFlow(
    flow: any,
    conversationId: string,
    channelId: string,
    customerId: string,
    messageText: string
): Promise<void> {
    const { emitNewMessage, emitConversationUpdated, getIO } = require('../socket');
    const nodes: any[] = flow.nodes || [];
    const edges: any[] = flow.edges || [];

    // Find trigger node
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');
    if (!triggerNode) return;

    // Walk the graph starting from the trigger
    const visited = new Set<string>();
    let currentNodeId = triggerNode.id;

    // Find next node(s) connected from a given node
    function getNextNodes(nodeId: string): string[] {
        return edges
            .filter((e: any) => e.source === nodeId)
            .map((e: any) => e.target);
    }

    // Helper to emit a bot message
    async function sendBotMessage(content: string): Promise<void> {
        const result = await db.query(
            `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, handled_by, bot_confidence)
             VALUES ($1, $2, $3, 'outbound', $4, 'bot', 1.0) RETURNING *`,
            [conversationId, channelId, customerId, content]
        );
        const msg = result.rows[0];
        emitNewMessage(conversationId, msg);
        emitConversationUpdated(conversationId, {
            last_message: content,
            last_message_at: msg.created_at,
        });
        getIO().emit('conversation_list_updated', { conversation_id: conversationId });
    }

    // Walk the flow — process first connected node after trigger, then follow edges
    const queue = getNextNodes(currentNodeId);

    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const node = nodes.find((n: any) => n.id === nodeId);
        if (!node) continue;

        switch (node.type) {
            case 'send_message': {
                if (node.data.message) {
                    await sendBotMessage(node.data.message);
                }
                // Continue to next nodes
                queue.push(...getNextNodes(nodeId));
                break;
            }

            case 'menu_buttons': {
                // Send the menu text with buttons listed
                const buttons = node.data.buttons || [];
                let menuText = node.data.message || '';
                if (buttons.length > 0) {
                    menuText += '\n\n' + buttons.map((b: any, i: number) => `${i + 1}. ${b.text}`).join('\n');
                }
                if (menuText.trim()) {
                    await sendBotMessage(menuText);
                }
                // Menu is a pause point — we don't continue automatically
                // The next message from the customer will re-trigger handleBotResponse
                // which will try to match the flow again. For now, stop here.
                break;
            }

            case 'conditional': {
                const condition = (node.data.condition || '').toLowerCase();
                const text = messageText.toLowerCase();
                // Simple condition evaluation: check if message contains the condition text
                const conditionMet = condition.split('|').some((part: string) => text.includes(part.trim()));

                const nextNodes = getNextNodes(nodeId);
                if (conditionMet && nextNodes.length > 0) {
                    queue.push(nextNodes[0]); // True branch = first connection
                } else if (nextNodes.length > 1) {
                    queue.push(nextNodes[1]); // False branch = second connection
                }
                break;
            }

            case 'transfer_to_group': {
                if (node.data.group_id) {
                    const agentId = await assignFromGroup(node.data.group_id, conversationId);
                    if (agentId) {
                        await sendBotMessage('Te estamos conectando con un agente. Un momento por favor...');
                    }
                }
                // Stop flow — agent takes over
                break;
            }

            case 'ai_response': {
                // Use RAG + AI with optional custom prompt
                try {
                    const settings = await db.query(
                        `SELECT provider, api_key_encrypted, system_prompt, model_name
                         FROM ai_settings WHERE is_default = TRUE LIMIT 1`
                    );
                    if (settings.rows.length > 0) {
                        const { provider, api_key_encrypted, system_prompt, model_name } = settings.rows[0];
                        const prompt = node.data.custom_prompt || system_prompt || '';
                        const embedding = await generateEmbedding(messageText, provider, api_key_encrypted);
                        const hit = await findBestAnswer(messageText, embedding);

                        let context: string | undefined;
                        if (hit && hit.confidence > 0.30) {
                            context = `Info: ${hit.question} → ${hit.answer}`;
                        }

                        const reply = await getAIResponse(
                            provider as any, prompt, messageText,
                            api_key_encrypted, model_name, customerId, context, conversationId
                        );
                        await sendBotMessage(reply);
                    }
                } catch (aiErr) {
                    console.error('[VisualFlow] AI Response error:', aiErr);
                    await sendBotMessage('Lo siento, hubo un error al procesar tu solicitud.');
                }
                queue.push(...getNextNodes(nodeId));
                break;
            }

            case 'wait_response': {
                // Pause — stop flow execution. Next customer message will re-enter handleBotResponse
                break;
            }

            default:
                queue.push(...getNextNodes(nodeId));
                break;
        }
    }
}

// ─────────────────────────────────────────────
// Meta Webhook Verification (GET)
// ─────────────────────────────────────────────
router.get('/meta', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// ─────────────────────────────────────────────
// Helpers para resolución de canales por subtype
// ─────────────────────────────────────────────

async function resolveChannelBySubtype(
    provider: string,
    subtype: string | null
): Promise<{ id: string; webhook_secret: string | null } | null> {
    // 1. Intenta encontrar canal con subtype exacto
    if (subtype) {
        const withSubtype = await db.query(
            `SELECT id, webhook_secret FROM channels WHERE provider = $1 AND subtype = $2 AND is_active = TRUE LIMIT 1`,
            [provider, subtype]
        );
        if (withSubtype.rows.length > 0) return withSubtype.rows[0];
    }
    // 2. Fallback al canal genérico sin subtype
    const generic = await db.query(
        `SELECT id, webhook_secret FROM channels WHERE provider = $1 AND subtype IS NULL AND is_active = TRUE LIMIT 1`,
        [provider]
    );
    if (generic.rows.length > 0) return generic.rows[0];
    // 3. Cualquier canal del provider
    const any = await db.query(
        `SELECT id, webhook_secret FROM channels WHERE provider = $1 AND is_active = TRUE LIMIT 1`,
        [provider]
    );
    return any.rows[0] ?? null;
}

// ─────────────────────────────────────────────
// Meta Webhook (POST) — Facebook & Instagram messages
// Maneja: Messenger DMs, FB Feed comments, IG Direct, IG Comments
// ─────────────────────────────────────────────
router.post('/meta', async (req: Request, res: Response) => {
    // Always acknowledge immediately to avoid Meta retries
    res.sendStatus(200);

    try {
        const body = req.body;
        if (body.object !== 'page' && body.object !== 'instagram') return;

        const isInstagram = body.object === 'instagram';
        const provider = isInstagram ? 'instagram' : 'facebook';

        for (const entry of body.entry ?? []) {

            // ── 1. DM / Messenger / IG Direct (entry.messaging[]) ────────────
            for (const event of entry.messaging ?? []) {
                if (!event.message?.text) continue;

                const subtype = isInstagram ? 'chat' : 'messenger';
                const ch = await resolveChannelBySubtype(provider, subtype);
                if (!ch) continue;

                if (ch.webhook_secret && !validateMetaSignature(req, ch.webhook_secret)) {
                    console.warn(`Meta webhook signature mismatch for ${provider}/${subtype} — dropping`);
                    continue;
                }

                const senderId: string = event.sender.id;
                const messageText: string = event.message.text;
                const referral = event.referral || event.message?.referral || null;

                // Resolve FB profile name if possible
                let displayName = senderId;
                try {
                    const chConfig = await db.query(`SELECT provider_config FROM channels WHERE id = $1`, [ch.id]);
                    const cfg = chConfig.rows[0]?.provider_config || {};
                    const accessToken = typeof cfg === 'string' ? JSON.parse(cfg).access_token : cfg.access_token;
                    if (accessToken && !isInstagram) {
                        displayName = await resolveFacebookProfileName(senderId, accessToken);
                    }
                } catch (_) { /* fallback to senderId */ }

                const customerId = await resolveOrCreateCustomer(provider, senderId, displayName);
                const { conversationId } = await resolveOrCreateConversation(customerId, ch.id, referral);

                // Auto-attribution from Click-to-Messenger / Click-to-IG-DM ads
                if (event.referral?.source === 'ADS') {
                    autoAttributeFromReferral(
                        customerId, conversationId, provider,
                        event.referral.ad_id ?? null,
                        event.referral.ads_context_data?.ad_set_id ?? null,
                        event.referral.ads_context_data ?? null
                    ).catch(console.error);
                }

                await db.query(
                    `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, provider_message_id)
                     VALUES ($1, $2, $3, 'inbound', $4, $5)`,
                    [conversationId, ch.id, customerId, messageText, event.message.mid]
                );

                handleBotResponse(conversationId, ch.id, customerId, messageText, referral).catch(console.error);
            }

            // ── 2. FB Page post comments (entry.changes[field='feed']) ────────
            for (const change of entry.changes ?? []) {
                if (change.field !== 'feed') continue;
                const value = change.value;
                if (!value?.message || value.item !== 'comment') continue;

                const subtype = 'feed';
                const ch = await resolveChannelBySubtype('facebook', subtype);
                if (!ch) continue;

                const senderId: string = value.from?.id ?? value.sender_id;
                const senderName: string = value.from?.name ?? senderId;
                const commentText: string = value.message;
                const commentId: string = value.comment_id ?? value.id;
                const postId: string = value.post_id ?? '';

                if (!senderId || !commentText) continue;

                const customerId = await resolveOrCreateCustomer('facebook', senderId, senderName);
                const { conversationId } = await resolveOrCreateConversation(customerId, ch.id);

                await db.query(
                    `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content,
                                          provider_message_id, source_post_id, source_comment_id)
                     VALUES ($1, $2, $3, 'inbound', $4, $5, $6, $7)
                     ON CONFLICT DO NOTHING`,
                    [conversationId, ch.id, customerId, commentText, commentId, postId, commentId]
                );

                // Auto-attribution si el post es de un anuncio (el postId comienza con '_' en FB)
                autoAttributeFromReferral(
                    customerId, conversationId, 'facebook',
                    value.ad_id ?? null,
                    null, value
                ).catch(console.error);

                handleBotResponse(conversationId, ch.id, customerId, commentText).catch(console.error);
            }

            // ── 3. Instagram comments (entry.changes[field='comments']) ───────
            for (const change of entry.changes ?? []) {
                if (change.field !== 'comments') continue;
                const value = change.value;
                if (!value?.text) continue;

                const subtype = 'comments';
                const ch = await resolveChannelBySubtype('instagram', subtype);
                if (!ch) continue;

                const senderId: string = value.from?.id ?? '';
                const senderName: string = value.from?.username ?? senderId;
                const commentText: string = value.text;
                const commentId: string = value.id ?? '';
                const mediaId: string = value.media?.id ?? '';

                if (!senderId || !commentText) continue;

                const customerId = await resolveOrCreateCustomer('instagram', senderId, senderName);
                const { conversationId } = await resolveOrCreateConversation(customerId, ch.id);

                await db.query(
                    `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content,
                                          provider_message_id, source_post_id, source_comment_id)
                     VALUES ($1, $2, $3, 'inbound', $4, $5, $6, $7)
                     ON CONFLICT DO NOTHING`,
                    [conversationId, ch.id, customerId, commentText, commentId, mediaId, commentId]
                );

                handleBotResponse(conversationId, ch.id, customerId, commentText).catch(console.error);
            }
        }
    } catch (err) {
        console.error('Meta webhook error:', err);
    }
});

// ─────────────────────────────────────────────
// WhatsApp Cloud API Webhook Verification (GET)
// Meta uses the same verification for WhatsApp Cloud API
// ─────────────────────────────────────────────
router.get('/whatsapp', async (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Read verify token from DB first, env fallback
    const verifyToken = await getBusinessSetting('meta_verify_token', process.env.META_VERIFY_TOKEN);

    if (mode === 'subscribe' && verifyToken && token === verifyToken) {
        console.log('[WhatsApp Webhook] Verification successful');
        res.status(200).send(challenge);
    } else {
        console.warn('[WhatsApp Webhook] Verification failed — token mismatch');
        res.sendStatus(403);
    }
});

// ─────────────────────────────────────────────
// WhatsApp Cloud API Webhook (POST)
// ─────────────────────────────────────────────
router.post('/whatsapp', async (req: Request, res: Response) => {
    res.sendStatus(200);

    try {
        const channel = await db.query(
            `SELECT id, webhook_secret FROM channels WHERE provider = 'whatsapp' AND is_active = TRUE LIMIT 1`
        );
        if (channel.rows.length === 0) return;

        const { id: channelId, webhook_secret } = channel.rows[0];

        // Signature validation: use webhook_secret from channel, fallback to app_secret from DB/env
        const sigSecret = webhook_secret || await getBusinessSetting('meta_app_secret', process.env.META_APP_SECRET);
        if (sigSecret && !validateMetaSignature(req, sigSecret)) {
            console.warn('WhatsApp webhook signature mismatch — dropping');
            return;
        }

        const changes = req.body?.entry?.[0]?.changes?.[0]?.value;

        // ── Forward call events to the WebRTC bridge ───────────────────────
        if (changes?.calls?.length) {
            const bridgeUrl = process.env.WEBRTC_BRIDGE_URL || 'http://localhost:4000';
            const phoneNumberId =
                req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? '';
            axios.post(`${bridgeUrl}/webhook/call`, {
                phone_number_id: phoneNumberId,
                value: changes,
            }).catch((err: Error) =>
                console.error('[WhatsApp] Failed to forward call event to bridge:', err.message)
            );
        }

        if (!changes?.messages) return;

        for (const msg of changes.messages) {
            if (msg.type !== 'text') continue;

            const phone: string = msg.from;
            const messageText: string = msg.text.body;
            const displayName: string = changes.contacts?.[0]?.profile?.name || phone;

            // WhatsApp Click-to-WhatsApp ads include referral
            const referral = msg.referral || null;

            const customerId = await resolveOrCreateCustomer('whatsapp', phone, displayName);
            const { conversationId } = await resolveOrCreateConversation(customerId, channelId, referral);

            const insertResult = await db.query(
                `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, provider_message_id)
                 VALUES ($1, $2, $3, 'inbound', $4, $5)
                 RETURNING id, conversation_id, channel_id, customer_id, direction, content, created_at, handled_by`,
                [conversationId, channelId, customerId, messageText, msg.id]
            );

            // Emit real-time socket events
            if (insertResult.rows[0]) {
                const savedMsg = insertResult.rows[0];
                emitNewMessage(conversationId, savedMsg);
                // Broadcast globally so all connected clients refresh their conversation list
                getIO().emit('conversation_list_updated', { conversationId, channelId });
            }

            handleBotResponse(conversationId, channelId, customerId, messageText, referral).catch(console.error);
        }
    } catch (err) {
        console.error('WhatsApp webhook error:', err);
    }
});

// ─────────────────────────────────────────────
// TikTok Webhook Verification (GET)
// ─────────────────────────────────────────────
router.get('/tiktok', (req: Request, res: Response) => {
    // TikTok sends a challenge string — echo it back to verify the endpoint
    const challenge = req.query['challenge'] as string;
    res.status(200).send(challenge ?? 'ok');
});

// ─────────────────────────────────────────────
// TikTok Webhook (POST) — TikTok for Business DMs & ad comments
// ─────────────────────────────────────────────
router.post('/tiktok', async (req: Request, res: Response) => {
    res.sendStatus(200);

    try {
        const appSecret = process.env.TIKTOK_APP_SECRET;
        if (appSecret) {
            const signature = req.headers['x-tiktok-signature'] as string;
            if (!signature) {
                console.warn('TikTok webhook: missing signature — dropping');
                return;
            }
            const expected = crypto
                .createHmac('sha256', appSecret)
                .update(JSON.stringify(req.body))
                .digest('hex');
            if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
                console.warn('TikTok webhook: signature mismatch — dropping');
                return;
            }
        }

        const channel = await db.query(
            `SELECT id FROM channels WHERE provider = 'tiktok' AND is_active = TRUE LIMIT 1`
        );
        if (channel.rows.length === 0) {
            console.warn('TikTok webhook: no active tiktok channel configured');
            return;
        }
        const channelId: string = channel.rows[0].id;

        const body = req.body;

        // DM event
        if (body.event_type === 'message' && body.message?.content?.message_type === 'text') {
            const senderId = body.message.sender_id as string;
            const messageText = body.message.content.text as string;
            const displayName = (body.message.sender_display_name as string) || senderId;
            const messageId = (body.message.message_id as string) || '';

            if (!senderId || !messageText) return;

            const customerId = await resolveOrCreateCustomer('tiktok', senderId, displayName);
            const { conversationId } = await resolveOrCreateConversation(customerId, channelId);

            await db.query(
                `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, provider_message_id)
                 VALUES ($1, $2, $3, 'inbound', $4, $5)
                 ON CONFLICT DO NOTHING`,
                [conversationId, channelId, customerId, messageText, messageId]
            );
            await db.query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]);
            handleBotResponse(conversationId, channelId, customerId, messageText).catch(console.error);
        }

        // Ad comment event — treat as inbound message
        if (body.event_type === 'comment' && body.comment?.text) {
            const senderId = body.comment.user_id as string;
            const messageText = body.comment.text as string;
            const displayName = (body.comment.username as string) || senderId;
            const messageId = (body.comment.comment_id as string) || '';

            if (!senderId || !messageText) return;

            const customerId = await resolveOrCreateCustomer('tiktok', senderId, displayName);
            const { conversationId } = await resolveOrCreateConversation(customerId, channelId);

            await db.query(
                `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content, provider_message_id)
                 VALUES ($1, $2, $3, 'inbound', $4, $5)
                 ON CONFLICT DO NOTHING`,
                [conversationId, channelId, customerId, messageText, messageId]
            );
            handleBotResponse(conversationId, channelId, customerId, messageText).catch(console.error);
        }
    } catch (err) {
        console.error('TikTok webhook error:', err);
    }
});

// Web Widget endpoint (POST /api/webhooks/webchat)
router.post('/webchat', async (req: Request, res: Response) => {
    try {
        const { contact_id, name, message } = req.body;
        if (!contact_id || !message) {
            res.status(400).json({ error: 'contact_id y message requeridos' });
            return;
        }

        // Get channel ID for webchat
        const channel = await db.query(`SELECT id FROM channels WHERE provider = 'webchat' AND is_active = TRUE LIMIT 1`);
        if (channel.rows.length === 0) {
            // Auto-create if it doesn't exist (simpler for this case)
            const newChannel = await db.query(
                `INSERT INTO channels (provider, name, is_active) VALUES ('webchat', 'Widget Web', TRUE) RETURNING id`
            );
            channel.rows.push(newChannel.rows[0]);
        }
        const channelId = channel.rows[0].id;

        const customerId = await resolveOrCreateCustomer('webchat', contact_id, name || contact_id);
        const { conversationId } = await resolveOrCreateConversation(customerId, channelId);

        // Insert message
        await db.query(
            `INSERT INTO messages (conversation_id, channel_id, customer_id, direction, content)
             VALUES ($1, $2, $3, 'inbound', $4)`,
            [conversationId, channelId, customerId, message]
        );

        // Update conversation
        await db.query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]);

        // Trigger bot response
        handleBotResponse(conversationId, channelId, customerId, message).catch(console.error);

        res.json({ ok: true, conversationId });
    } catch (err: any) {
        console.error('Webchat webhook error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────────────────
// WooCommerce Webhook — Order Status Changes
// Receives status updates from WC and syncs to CRM
// ──────────────────────────────────────────────────────────────────────────
router.post('/woocommerce-status', async (req: Request, res: Response) => {
    const wcWebhookSecret = process.env.WC_WEBHOOK_SECRET;
    if (wcWebhookSecret) {
        const signature = req.headers['x-wc-webhook-signature'] as string;
        if (signature) {
            const expected = crypto
                .createHmac('sha256', wcWebhookSecret)
                .update((req as any).rawBody || JSON.stringify(req.body))
                .digest('base64');
            if (signature !== expected) {
                console.warn('WooCommerce webhook signature mismatch — dropping');
                res.sendStatus(401);
                return;
            }
        }
    }

    try {
        const order = req.body;
        if (!order.id || !order.status) {
            res.sendStatus(200);
            return;
        }

        const externalOrderId = String(order.id);
        const newStatus = order.status;

        const result = await receiveStatusFromWC(externalOrderId, newStatus);
        if (result.ok) {
            console.log(`[WC→CRM Sync] Order #${externalOrderId} → ${newStatus}`);
        } else {
            console.error(`[WC→CRM Sync] Error for order #${externalOrderId}:`, (result as any).error);
        }

        // Also sync order data if it doesn't exist in CRM
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

        res.sendStatus(200);
    } catch (err) {
        console.error('WooCommerce webhook error:', err);
        res.sendStatus(500);
    }
});

// ──────────────────────────────────────────────────────────────────────────
// Webchat — Receive UTM data from chat widget
// ──────────────────────────────────────────────────────────────────────────
router.post('/webchat-utm', async (req: Request, res: Response) => {
    try {
        const { customer_id, conversation_id, utm_data } = req.body;
        if (!customer_id || !utm_data) {
            res.status(400).json({ error: 'customer_id and utm_data are required' });
            return;
        }

        if (conversation_id) {
            await db.query(
                `UPDATE conversations SET utm_data = $1 WHERE id = $2`,
                [JSON.stringify(utm_data), conversation_id]
            );
        }

        await recordUTMTouchpoint(customer_id, utm_data);
        res.json({ ok: true });
    } catch (err) {
        console.error('Webchat UTM error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
