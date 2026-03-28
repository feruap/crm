/**
 * call-handler.ts
 * Processes incoming WhatsApp call webhooks from Meta.
 * Creates the server-side RTCPeerConnection (PC1) that bridges to Meta's WebRTC.
 */
import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
// @ts-ignore — @roamhq/wrtc provides WebRTC for Node.js
import wrtc from '@roamhq/wrtc';
import { preAcceptCall } from './meta-api';
import { CallStore, createCallState, CallStatus } from './webrtc-bridge';

const { RTCPeerConnection, RTCSessionDescription } = wrtc;

export function createCallRouter(io: SocketIOServer, callStore: CallStore): Router {
    const router = Router();

    // ── Webhook endpoint ──────────────────────────────────────────────────────
    // Meta POSTs call events here. Forward from CRM or configure Meta directly.
    router.post('/webhook/call', async (req: Request, res: Response) => {
        // Always 200 immediately so Meta doesn't retry
        res.sendStatus(200);

        try {
            await handleCallWebhook(req.body, io, callStore);
        } catch (err) {
            console.error('[CallHandler] Unhandled error in webhook:', err);
        }
    });

    // ── Status endpoint ───────────────────────────────────────────────────────
    router.get('/calls', (_req: Request, res: Response) => {
        const calls = Array.from(callStore.values()).map(c => ({
            callId: c.callId,
            from: c.fromPhone,
            status: c.status,
            startTime: c.startTime,
        }));
        res.json(calls);
    });

    return router;
}

// ─────────────────────────────────────────────────────────────────────────────

async function handleCallWebhook(
    body: any,
    io: SocketIOServer,
    callStore: CallStore
): Promise<void> {
    // Support both formats:
    //  1. Meta direct: { entry[0].changes[0].value.calls[] }
    //  2. CRM forward: { calls[] } (stripped entry wrapper)
    const value =
        body?.entry?.[0]?.changes?.[0]?.value ??
        body?.value ??
        body;

    const callEvents: any[] = value?.calls ?? [];
    if (callEvents.length === 0) {
        console.log('[CallHandler] No call events in webhook body');
        return;
    }

    const phoneNumberId: string =
        body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ??
        body?.phone_number_id ??
        process.env.META_PHONE_NUMBER_ID ??
        '';

    for (const callEvent of callEvents) {
        await processCallEvent(callEvent, phoneNumberId, io, callStore);
    }
}

async function processCallEvent(
    event: any,
    phoneNumberId: string,
    io: SocketIOServer,
    callStore: CallStore
): Promise<void> {
    const callId: string = event.call_id ?? event.id ?? '';
    const fromPhone: string = event.from ?? '';
    const status: string = event.status ?? '';
    const sdpPayload = event.sdp ?? null;

    console.log(`[CallHandler] Event callId=${callId} from=${fromPhone} status=${status}`);

    // ── Incoming call (offer) ─────────────────────────────────────────────────
    if (status === 'initiated' || (sdpPayload && sdpPayload.type === 'offer')) {
        await handleIncomingCall(callId, fromPhone, phoneNumberId, sdpPayload, io, callStore);
        return;
    }

    // ── Call terminated by Meta ────────────────────────────────────────────────
    if (status === 'terminated' || status === 'rejected' || status === 'missed') {
        handleMetaTermination(callId, io, callStore);
        return;
    }

    // ── ICE candidate from Meta ───────────────────────────────────────────────
    if (event.ice_candidate) {
        handleMetaIceCandidate(callId, event.ice_candidate, callStore);
        return;
    }

    console.log(`[CallHandler] Unhandled event status="${status}" for callId=${callId}`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function handleIncomingCall(
    callId: string,
    fromPhone: string,
    phoneNumberId: string,
    sdpPayload: { type: string; sdp: string } | null,
    io: SocketIOServer,
    callStore: CallStore
): Promise<void> {
    if (callStore.has(callId)) {
        console.log(`[CallHandler] Duplicate callId=${callId}, ignoring`);
        return;
    }

    // Step 1: pre_accept immediately (< 5 s requirement)
    const preAcceptResult = await preAcceptCall(phoneNumberId, callId);
    if (!preAcceptResult.success) {
        console.error(`[CallHandler] pre_accept failed for callId=${callId}`);
        return;
    }

    // Step 2: Build initial call state
    const callState = createCallState(callId, fromPhone, phoneNumberId);
    callStore.set(callId, callState);

    // Step 3: Create PC1 (bridge ↔ Meta) if we have an SDP offer
    if (sdpPayload?.sdp) {
        await setupMetaPeerConnection(callId, sdpPayload.sdp, phoneNumberId, io, callStore);
    } else {
        // Meta may send the SDP in a follow-up event; just store state and wait
        console.log(`[CallHandler] callId=${callId} — no SDP in webhook, waiting for SDP event`);
    }

    // Step 4: Notify all connected CRM agents
    io.emit('incoming_call', {
        callId,
        from: fromPhone,
        phoneNumberId,
        timestamp: new Date().toISOString(),
    });

    console.log(`[CallHandler] Incoming call callId=${callId} from=${fromPhone} — agents notified`);
}

export async function setupMetaPeerConnection(
    callId: string,
    sdpOffer: string,
    phoneNumberId: string,
    io: SocketIOServer,
    callStore: CallStore
): Promise<void> {
    const callState = callStore.get(callId);
    if (!callState) return;

    const iceServers = buildIceConfig();

    const pc1 = new RTCPeerConnection({ iceServers }) as RTCPeerConnection;
    callState.pc1 = pc1;
    callState.status = CallStatus.PRE_ACCEPTED;
    callStore.set(callId, callState);

    // Collect ICE candidates for PC1 → store them; send after setLocalDescription
    const pendingCandidates: RTCIceCandidate[] = [];

    pc1.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
            pendingCandidates.push(event.candidate);
            // Optionally send to Meta via Graph API if they support trickle ICE
        }
    };

    pc1.oniceconnectionstatechange = () => {
        console.log(`[CallHandler] PC1 ICE state callId=${callId}: ${pc1.iceConnectionState}`);
        if (pc1.iceConnectionState === 'failed' || pc1.iceConnectionState === 'disconnected') {
            handleMetaTermination(callId, io, callStore);
        }
    };

    pc1.onconnectionstatechange = () => {
        console.log(`[CallHandler] PC1 connection state callId=${callId}: ${pc1.connectionState}`);
    };

    // When Meta's audio arrives on PC1, bridge to PC2
    pc1.ontrack = (event: RTCTrackEvent) => {
        console.log(`[CallHandler] PC1 track received callId=${callId} kind=${event.track.kind}`);
        const cs = callStore.get(callId);
        if (!cs) return;

        event.streams[0].getTracks().forEach((track: MediaStreamTrack) => {
            if (cs.pc2) {
                // PC2 already exists — add directly
                cs.pc2.addTrack(track, event.streams[0]);
                console.log(`[CallHandler] Bridged Meta track → PC2 callId=${callId}`);
            } else {
                // PC2 not ready yet — store for later
                cs.pendingMetaTracks.push({ track, stream: event.streams[0] });
                console.log(`[CallHandler] Stored pending Meta track for callId=${callId}`);
            }
        });
    };

    // Set Meta's SDP offer as remote description
    await pc1.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpOffer }));

    // Create answer
    const answer = await pc1.createAnswer();
    await pc1.setLocalDescription(answer);

    // Wait for ICE gathering to complete
    await waitForIceGathering(pc1);

    const finalSdp = pc1.localDescription?.sdp ?? answer.sdp ?? '';

    callState.pc1AnswerSdp = finalSdp;
    callState.status = CallStatus.PENDING_AGENT;
    callStore.set(callId, callState);

    console.log(`[CallHandler] PC1 answer ready for callId=${callId} — waiting for agent`);

    // Notify agents that the call is ready with SDP (they can now accept)
    io.emit('call_ready', { callId, from: callState.fromPhone });
}

function handleMetaTermination(
    callId: string,
    io: SocketIOServer,
    callStore: CallStore
): void {
    const cs = callStore.get(callId);
    if (!cs) return;

    console.log(`[CallHandler] Meta terminated callId=${callId}`);
    cs.pc1?.close();
    cs.pc2?.close();
    cs.status = CallStatus.TERMINATED;
    callStore.delete(callId);

    io.emit('call_terminated', { callId, reason: 'meta_terminated' });
}

function handleMetaIceCandidate(
    callId: string,
    candidate: RTCIceCandidateInit,
    callStore: CallStore
): void {
    const cs = callStore.get(callId);
    if (!cs?.pc1) return;

    cs.pc1.addIceCandidate(candidate).catch((err: Error) => {
        console.error(`[CallHandler] Failed to add ICE candidate for callId=${callId}:`, err);
    });
}

// ─────────────────────────────────────────────────────────────────────────────

function buildIceConfig(): RTCIceServer[] {
    const servers: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ];

    const turnUrl = process.env.TURN_SERVER_URL;
    const turnUser = process.env.TURN_USERNAME;
    const turnPass = process.env.TURN_PASSWORD;

    if (turnUrl && turnUser && turnPass) {
        servers.push({
            urls: turnUrl,
            username: turnUser,
            credential: turnPass,
        });
    }

    return servers;
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') {
            resolve();
            return;
        }
        const timeout = setTimeout(resolve, 3000); // Max 3 s wait
        pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
                clearTimeout(timeout);
                resolve();
            }
        };
    });
}
