"use strict";
/**
 * Campaign Auto-Responder Service
 *
 * When a new conversation starts from a Meta ad (Click-to-DM), this service:
 * 1. Looks up the ad_id in campaigns
 * 2. Finds active campaign-product mappings
 * 3. Sends the welcome message + media automatically
 * 4. Records an attribution touchpoint
 *
 * Called from webhooks.ts after a new inbound message is detected
 * with a Meta referral object.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.findCampaignMapping = findCampaignMapping;
exports.sendCampaignAutoReply = sendCampaignAutoReply;
exports.recordTouchpoint = recordTouchpoint;
exports.recordUTMTouchpoint = recordUTMTouchpoint;
const db_1 = require("../db");
/**
 * Find campaign and product mappings for a given Meta referral
 */
async function findCampaignMapping(referral) {
    if (!referral.ad_id)
        return null;
    // Look up the campaign by ad_id
    const campaign = await db_1.db.query(`SELECT id, name FROM campaigns
         WHERE platform_ad_id = $1 AND is_active = TRUE
         LIMIT 1`, [referral.ad_id]);
    // If no exact ad match, try ad_set or campaign level
    let campaignId = null;
    let campaignName = null;
    if (campaign.rows.length > 0) {
        campaignId = campaign.rows[0].id;
        campaignName = campaign.rows[0].name;
    }
    else {
        // Try matching by platform_campaign_id from ads_context_data or ref
        // For now, create the campaign on the fly if we have an ad_id
        const newCampaign = await db_1.db.query(`INSERT INTO campaigns (platform, platform_campaign_id, platform_ad_id, name, metadata)
             VALUES ('facebook', $1, $1, $2, $3)
             ON CONFLICT (platform, platform_campaign_id) DO UPDATE
                 SET platform_ad_id = EXCLUDED.platform_ad_id, metadata = EXCLUDED.metadata
             RETURNING id, name`, [
            referral.ad_id,
            referral.ads_context_data?.ad_title || `FB Ad ${referral.ad_id}`,
            JSON.stringify(referral),
        ]);
        campaignId = newCampaign.rows[0].id;
        campaignName = newCampaign.rows[0].name;
    }
    if (!campaignId)
        return null;
    // Find the active mapping for this campaign
    const mapping = await db_1.db.query(`SELECT cpm.*, c.name AS campaign_name
         FROM campaign_product_mappings cpm
         JOIN campaigns c ON c.id = cpm.campaign_id
         WHERE cpm.campaign_id = $1
           AND cpm.is_active = TRUE
           AND cpm.auto_send = TRUE
         ORDER BY cpm.priority DESC
         LIMIT 1`, [campaignId]);
    if (mapping.rows.length === 0)
        return null;
    const row = mapping.rows[0];
    return {
        id: row.id,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        wc_product_id: row.wc_product_id,
        product_name: row.product_name,
        welcome_message: row.welcome_message,
        media_urls: row.media_urls || [],
        auto_send: row.auto_send,
        priority: row.priority,
    };
}
/**
 * Send the campaign auto-reply for a conversation.
 * Creates the outbound message record with handler_type = 'bot'
 * and bot_action = 'campaign_auto_reply'.
 */
async function sendCampaignAutoReply(conversationId, channelId, customerId, mapping) {
    // Send welcome message
    await db_1.db.query(`INSERT INTO messages
            (conversation_id, channel_id, customer_id, direction, content, message_type, handled_by, bot_confidence, bot_action)
         VALUES ($1, $2, $3, 'outbound', $4, 'text', 'bot', 1.0, 'campaign_auto_reply')`, [conversationId, channelId, customerId, mapping.welcome_message]);
    // Send media attachments if any
    for (const mediaUrl of mapping.media_urls) {
        const mediaType = guessMediaType(mediaUrl);
        await db_1.db.query(`INSERT INTO messages
                (conversation_id, channel_id, customer_id, direction, content, media_url, message_type, handled_by, bot_confidence, bot_action)
             VALUES ($1, $2, $3, 'outbound', $4, $5, $6, 'bot', 1.0, 'campaign_auto_reply')`, [conversationId, channelId, customerId, mapping.product_name, mediaUrl, mediaType]);
    }
}
/**
 * Record an attribution touchpoint from a Meta referral
 */
async function recordTouchpoint(customerId, campaignId, referral, channel) {
    await db_1.db.query(`INSERT INTO attribution_touchpoints
            (customer_id, campaign_id, channel, touchpoint_type, ad_id, raw_referral)
         VALUES ($1, $2, $3, $4, $5, $6)`, [
        customerId,
        campaignId,
        channel,
        referral.source === 'ADS' ? 'ad_click' : 'organic',
        referral.ad_id || null,
        JSON.stringify(referral),
    ]);
}
/**
 * Record UTM-based touchpoint (from webchat)
 */
async function recordUTMTouchpoint(customerId, utmData) {
    // Try to find matching campaign by utm_campaign
    let campaignId = null;
    if (utmData.utm_campaign) {
        const campaign = await db_1.db.query(`SELECT id FROM campaigns WHERE name ILIKE $1 LIMIT 1`, [`%${utmData.utm_campaign}%`]);
        if (campaign.rows.length > 0) {
            campaignId = campaign.rows[0].id;
        }
    }
    const touchpointType = utmData.gclid ? 'ad_click' :
        utmData.fbclid ? 'ad_click' :
            utmData.utm_medium === 'cpc' ? 'ad_click' :
                utmData.utm_source ? 'referral' : 'direct';
    await db_1.db.query(`INSERT INTO attribution_touchpoints
            (customer_id, campaign_id, channel, touchpoint_type, utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid)
         VALUES ($1, $2, 'web', $3, $4, $5, $6, $7, $8, $9, $10)`, [
        customerId,
        campaignId,
        touchpointType,
        utmData.utm_source || null,
        utmData.utm_medium || null,
        utmData.utm_campaign || null,
        utmData.utm_content || null,
        utmData.utm_term || null,
        utmData.gclid || null,
        utmData.fbclid || null,
    ]);
}
// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function guessMediaType(url) {
    const lower = url.toLowerCase();
    if (lower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/))
        return 'image';
    if (lower.match(/\.(mp4|mov|avi|webm)(\?|$)/))
        return 'video';
    if (lower.match(/\.(pdf)(\?|$)/))
        return 'file';
    return 'file';
}
