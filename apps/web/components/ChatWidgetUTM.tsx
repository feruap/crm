'use client';

/**
 * ChatWidgetUTM
 *
 * Utility component that captures UTM parameters from the browser URL
 * and sends them to the CRM API when a webchat conversation starts.
 *
 * Usage: Include <ChatWidgetUTM /> in any page where the webchat widget lives.
 * It reads window.location.search on mount and stores the UTMs.
 * When a conversation is created, call sendUTMData(customerId, conversationId).
 */

import { useEffect, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

const UTM_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign',
    'utm_content', 'utm_term', 'gclid', 'fbclid',
] as const;

export interface UTMData {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    gclid?: string;
    fbclid?: string;
}

/**
 * Extract UTM parameters from the current URL
 */
export function extractUTMFromURL(): UTMData | null {
    if (typeof window === 'undefined') return null;

    const params = new URLSearchParams(window.location.search);
    const utmData: UTMData = {};
    let hasAny = false;

    for (const key of UTM_PARAMS) {
        const value = params.get(key);
        if (value) {
            utmData[key] = value;
            hasAny = true;
        }
    }

    return hasAny ? utmData : null;
}

/**
 * Send UTM data to the CRM API
 */
export async function sendUTMData(
    customerId: string,
    conversationId: string,
    utmData: UTMData
): Promise<void> {
    try {
        await fetch(`${API_URL}/api/webhooks/webchat-utm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: customerId,
                conversation_id: conversationId,
                utm_data: utmData,
            }),
        });
    } catch (err) {
        console.error('[ChatWidgetUTM] Failed to send UTM data:', err);
    }
}

/**
 * Hook that captures UTMs on mount and exposes them for sending
 */
export function useUTMCapture() {
    const utmData = useRef<UTMData | null>(null);

    useEffect(() => {
        utmData.current = extractUTMFromURL();
    }, []);

    return {
        utmData: utmData.current,
        sendUTM: (customerId: string, conversationId: string) => {
            if (utmData.current) {
                sendUTMData(customerId, conversationId, utmData.current);
            }
        },
    };
}

/**
 * Component that auto-captures UTMs and stores them in sessionStorage
 * so they persist across page navigations within the same session.
 */
export default function ChatWidgetUTM() {
    useEffect(() => {
        const utmData = extractUTMFromURL();
        if (utmData) {
            // Store for later use when conversation is created
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('crm_utm_data', JSON.stringify(utmData));
            }
        }
    }, []);

    // This component renders nothing — it's a side-effect only
    return null;
}
