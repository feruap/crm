/**
 * Google Ads Offline Conversion Service
 *
 * Sends offline conversion events to Google Ads when:
 * - An order with a GCLID (Google Click ID) is completed
 *
 * Uses the Google Ads REST API to upload offline conversions.
 * Conversions appear in Google Ads reports after ~24h.
 */

import { db } from '../db';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface GoogleOfflineConversion {
    gclid: string;
    conversion_action: string;  // Format: customers/{customer_id}/conversionActions/{action_id}
    conversion_date_time: string; // Format: 2026-03-19 14:30:00-06:00
    conversion_value: number;
    currency_code: string;
    order_id?: string;
}

interface GoogleUploadResult {
    partialFailureError?: {
        code: number;
        message: string;
    };
    results: Array<{
        gclid: { gclid: string };
        conversionAction: string;
        conversionDateTime: string;
    }>;
}

// ─────────────────────────────────────────────
// OAuth Token Management
// ─────────────────────────────────────────────

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getGoogleAccessToken(): Promise<string> {
    // Check cache
    if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60000) {
        return cachedAccessToken.token;
    }

    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Google Ads OAuth credentials not configured');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google OAuth error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };

    cachedAccessToken = {
        token: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
    };

    return data.access_token;
}

// ─────────────────────────────────────────────
// Upload Offline Conversion
// ─────────────────────────────────────────────

async function uploadOfflineConversion(
    conversion: GoogleOfflineConversion
): Promise<GoogleUploadResult> {
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID; // Format: 123-456-7890
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    if (!customerId || !developerToken) {
        throw new Error('GOOGLE_ADS_CUSTOMER_ID and GOOGLE_ADS_DEVELOPER_TOKEN are required');
    }

    const accessToken = await getGoogleAccessToken();
    const cleanCustomerId = customerId.replace(/-/g, '');

    const url = `https://googleads.googleapis.com/v16/customers/${cleanCustomerId}:uploadClickConversions`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': developerToken,
        },
        body: JSON.stringify({
            conversions: [{
                gclid: conversion.gclid,
                conversionAction: conversion.conversion_action,
                conversionDateTime: conversion.conversion_date_time,
                conversionValue: conversion.conversion_value,
                currencyCode: conversion.currency_code,
                orderId: conversion.order_id,
            }],
            partialFailure: true,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Ads API error ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<GoogleUploadResult>;
}

// ─────────────────────────────────────────────
// Public: Send Google Purchase Conversion
// ─────────────────────────────────────────────

/**
 * Send a Purchase conversion to Google Ads.
 * Only sends if the customer has a GCLID touchpoint.
 */
export async function sendGooglePurchaseConversion(
    orderId: number,
    attributionId: string
): Promise<{ ok: boolean; eventId: string; error?: string }> {
    const eventId = `gads_purchase_${orderId}_${Date.now()}`;

    try {
        // Get order data
        const orderData = await db.query(
            `SELECT o.*, a.customer_id
             FROM orders o
             JOIN attributions a ON a.order_id = o.id AND a.id = $1
             WHERE o.id = $2`,
            [attributionId, orderId]
        );

        if (orderData.rows.length === 0) {
            return { ok: false, eventId, error: 'Order or attribution not found' };
        }

        const order = orderData.rows[0];

        // Find GCLID from touchpoints
        const gclidTouch = await db.query(
            `SELECT gclid, event_source_url
             FROM attribution_touchpoints
             WHERE customer_id = $1 AND gclid IS NOT NULL
             ORDER BY created_at DESC LIMIT 1`,
            [order.customer_id]
        );

        if (gclidTouch.rows.length === 0) {
            return { ok: false, eventId, error: 'No GCLID found for this customer' };
        }

        const gclid = gclidTouch.rows[0].gclid;

        // Get conversion action resource name from env
        const conversionAction = process.env.GOOGLE_ADS_CONVERSION_ACTION;
        if (!conversionAction) {
            return { ok: false, eventId, error: 'GOOGLE_ADS_CONVERSION_ACTION not configured' };
        }

        // Format datetime for Google Ads (YYYY-MM-DD HH:MM:SS±HH:MM)
        const now = new Date();
        const tzOffset = -6; // Mexico City UTC-6
        const offsetStr = `${tzOffset < 0 ? '-' : '+'}${String(Math.abs(tzOffset)).padStart(2, '0')}:00`;
        const dateStr = now.toISOString().replace('T', ' ').substring(0, 19) + offsetStr;

        // Record in conversion_events
        await db.query(
            `INSERT INTO conversion_events
                (platform, event_name, event_id, order_id, customer_id, attribution_id,
                 event_value, currency, gclid, status)
             VALUES ('google', 'Purchase', $1, $2, $3, $4, $5, $6, $7, 'pending')`,
            [
                eventId, orderId, order.customer_id, attributionId,
                parseFloat(order.total_amount || '0'), order.currency || 'MXN',
                gclid,
            ]
        );

        // Upload to Google Ads
        const result = await uploadOfflineConversion({
            gclid,
            conversion_action: conversionAction,
            conversion_date_time: dateStr,
            conversion_value: parseFloat(order.total_amount || '0'),
            currency_code: order.currency || 'MXN',
            order_id: order.external_order_id,
        });

        // Check for partial failures
        if (result.partialFailureError) {
            await db.query(
                `UPDATE conversion_events
                 SET status = 'failed', platform_response = $1, last_attempt_at = NOW(), retry_count = retry_count + 1
                 WHERE event_id = $2`,
                [JSON.stringify(result), eventId]
            );
            return { ok: false, eventId, error: result.partialFailureError.message };
        }

        // Success
        await db.query(
            `UPDATE conversion_events
             SET status = 'sent', platform_response = $1, sent_at = NOW(), last_attempt_at = NOW()
             WHERE event_id = $2`,
            [JSON.stringify(result), eventId]
        );

        console.log(`[Google Ads] Purchase conversion sent for order #${order.external_order_id} ($${order.total_amount} ${order.currency})`);

        return { ok: true, eventId };
    } catch (err) {
        await db.query(
            `UPDATE conversion_events
             SET status = 'failed', last_attempt_at = NOW(), retry_count = retry_count + 1,
                 platform_response = $1
             WHERE event_id = $2`,
            [JSON.stringify({ error: String(err) }), eventId]
        ).catch(() => {});

        console.error(`[Google Ads] Failed to send Purchase conversion:`, err);
        return { ok: false, eventId, error: String(err) };
    }
}

// ─────────────────────────────────────────────
// Retry Failed Events
// ─────────────────────────────────────────────

export async function retryFailedGoogleEvents(): Promise<{ retried: number; succeeded: number }> {
    const failed = await db.query(
        `SELECT * FROM conversion_events
         WHERE platform = 'google' AND status = 'failed' AND retry_count < 3
         ORDER BY created_at ASC LIMIT 50`
    );

    let retried = 0;
    let succeeded = 0;

    for (const event of failed.rows) {
        retried++;
        if (event.order_id && event.attribution_id) {
            const result = await sendGooglePurchaseConversion(event.order_id, event.attribution_id);
            if (result.ok) succeeded++;
        }
    }

    return { retried, succeeded };
}
