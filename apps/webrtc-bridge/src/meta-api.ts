/**
 * Meta Graph API helpers for WhatsApp Business Calling
 * Docs: https://developers.facebook.com/docs/whatsapp/business-calling
 */
import axios from 'axios';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

function getAccessToken(): string {
    const token = process.env.META_ACCESS_TOKEN;
    if (!token) throw new Error('META_ACCESS_TOKEN is not set');
    return token;
}

export interface CallActionResponse {
    success: boolean;
    call_id?: string;
    error?: string;
}

/**
 * pre_accept — Acknowledge receipt of an incoming call.
 * Must be called within ~5 seconds of receiving the webhook.
 */
export async function preAcceptCall(
    phoneNumberId: string,
    callId: string
): Promise<CallActionResponse> {
    try {
        const resp = await axios.post(
            `${GRAPH_BASE}/${phoneNumberId}/calls`,
            { call_id: callId, action: 'pre_accept' },
            {
                headers: {
                    Authorization: `Bearer ${getAccessToken()}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log(`[MetaAPI] pre_accept callId=${callId}`, resp.data);
        return { success: true, call_id: callId };
    } catch (err: any) {
        const msg = err.response?.data?.error?.message ?? err.message;
        console.error(`[MetaAPI] pre_accept failed callId=${callId}:`, msg);
        return { success: false, error: msg };
    }
}

/**
 * accept — Send our SDP answer to Meta to complete the WebRTC handshake.
 * Call this after generating the RTCPeerConnection answer.
 */
export async function acceptCall(
    phoneNumberId: string,
    callId: string,
    sdpAnswer: string
): Promise<CallActionResponse> {
    try {
        const resp = await axios.post(
            `${GRAPH_BASE}/${phoneNumberId}/calls`,
            {
                call_id: callId,
                action: 'accept',
                sdp: sdpAnswer,
            },
            {
                headers: {
                    Authorization: `Bearer ${getAccessToken()}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log(`[MetaAPI] accept callId=${callId}`, resp.data);
        return { success: true, call_id: callId };
    } catch (err: any) {
        const msg = err.response?.data?.error?.message ?? err.message;
        console.error(`[MetaAPI] accept failed callId=${callId}:`, msg);
        return { success: false, error: msg };
    }
}

/**
 * terminate — End the call from the bridge side.
 */
export async function terminateCall(
    phoneNumberId: string,
    callId: string
): Promise<CallActionResponse> {
    try {
        const resp = await axios.post(
            `${GRAPH_BASE}/${phoneNumberId}/calls`,
            { call_id: callId, action: 'terminate' },
            {
                headers: {
                    Authorization: `Bearer ${getAccessToken()}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log(`[MetaAPI] terminate callId=${callId}`, resp.data);
        return { success: true, call_id: callId };
    } catch (err: any) {
        const msg = err.response?.data?.error?.message ?? err.message;
        console.error(`[MetaAPI] terminate failed callId=${callId}:`, msg);
        return { success: false, error: msg };
    }
}

/**
 * getCallStatus — Retrieve current call state from Meta.
 */
export async function getCallStatus(
    phoneNumberId: string,
    callId: string
): Promise<Record<string, unknown> | null> {
    try {
        const resp = await axios.get(
            `${GRAPH_BASE}/${phoneNumberId}/calls/${callId}`,
            {
                headers: { Authorization: `Bearer ${getAccessToken()}` },
            }
        );
        return resp.data;
    } catch (err: any) {
        const msg = err.response?.data?.error?.message ?? err.message;
        console.error(`[MetaAPI] getCallStatus failed callId=${callId}:`, msg);
        return null;
    }
}
