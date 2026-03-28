/**
 * webrtc-bridge.ts
 * Manages the Socket.IO <-> WebRTC bridge between CRM agents and Meta.
 *
 * Flow:
 *  1. Agent receives "incoming_call" event, shows UI
 *  2. Agent clicks Accept → sends "agent_accept_call" with SDP offer
 *  3. Bridge creates PC2 (bridge ↔ browser), sends SDP answer back
 *  4. Bridge calls Meta API "accept" with PC1's stored answer SDP
 *  5. Audio is bridged: PC1 tracks ↔ PC2 tracks
 *  6. Either side can terminate
 */
import { Server as SocketIOServer, Socket } from 'socket.io';
// @ts-ignore
import wrtc from '@roamhq/wrtc';
import { acceptCall, terminateCall } from './meta-api';

const { RTCPeerConnection, RTCSessionDescription } = wrtc;

// ── Call state types ──────────────────────────────────────────────────────────

export enum CallStatus {
    PRE_ACCEPTED = 'pre_accepted',
    PENDING_AGENT = 'pending_agent',
    AGENT_CONNECTING = 'agent_connecting',
    ACTIVE = 'active',
    TERMINATED = 'terminated',
}

export interface PendingTrack {
    track: MediaStreamTrack;
    stream: MediaStream;
}

export interface CallState {
    callId: string;
    fromPhone: string;
    phoneNumberId: string;
    status: CallStatus;
    pc1?: RTCPeerConnection;       // Bridge ↔ Meta
    pc2?: RTCPeerConnection;       // Bridge ↔ Agent browser
    pc1AnswerSdp?: string;         // Our answer to Meta, sent on agent accept
    agentSocketId?: string;
    startTime?: Date;
    pendingMetaTracks: PendingTrack[];    // Tracks from Meta queued until PC2 ready
    pendingBrowserTracks: PendingTrack[]; // Tracks from browser queued until PC1 ready
}

export type CallStore = Map<string, CallState>;

export function createCallState(
    callId: string,
    fromPhone: string,
    phoneNumberId: string
): CallState {
    return {
        callId,
        fromPhone,
        phoneNumberId,
        status: CallStatus.PRE_ACCEPTED,
        pendingMetaTracks: [],
        pendingBrowserTracks: [],
    };
}

// ── Bridge Socket.IO handler ─────────────────────────────────────────────────

export function registerBridgeHandlers(io: SocketIOServer, callStore: CallStore): void {
    io.on('connection', (socket: Socket) => {
        console.log(`[Bridge] Agent connected socketId=${socket.id}`);

        // ── Agent accepts call ────────────────────────────────────────────────
        socket.on('agent_accept_call', async (data: { callId: string; sdp: string }) => {
            const { callId, sdp: browserSdpOffer } = data;
            console.log(`[Bridge] agent_accept_call callId=${callId} socketId=${socket.id}`);

            const cs = callStore.get(callId);
            if (!cs) {
                socket.emit('call_error', { callId, error: 'Call not found' });
                return;
            }
            if (cs.status === CallStatus.ACTIVE || cs.status === CallStatus.AGENT_CONNECTING) {
                socket.emit('call_error', { callId, error: 'Call already being handled' });
                return;
            }
            if (cs.status === CallStatus.TERMINATED) {
                socket.emit('call_error', { callId, error: 'Call already terminated' });
                return;
            }

            cs.agentSocketId = socket.id;
            cs.status = CallStatus.AGENT_CONNECTING;
            callStore.set(callId, cs);

            try {
                await setupBrowserPeerConnection(callId, browserSdpOffer, socket, io, callStore);
            } catch (err) {
                console.error(`[Bridge] Failed to set up PC2 for callId=${callId}:`, err);
                socket.emit('call_error', { callId, error: 'WebRTC setup failed' });
                cleanupCall(callId, io, callStore, 'setup_error');
            }
        });

        // ── Agent sends ICE candidate ─────────────────────────────────────────
        socket.on('agent_ice_candidate', (data: { callId: string; candidate: RTCIceCandidateInit }) => {
            const cs = callStore.get(data.callId);
            if (!cs?.pc2) return;
            cs.pc2.addIceCandidate(data.candidate).catch((err: Error) => {
                console.error(`[Bridge] Failed adding browser ICE for callId=${data.callId}:`, err);
            });
        });

        // ── Agent rejects call ───────────────────────────────────────────────
        socket.on('agent_reject_call', async (data: { callId: string }) => {
            const { callId } = data;
            console.log(`[Bridge] agent_reject_call callId=${callId}`);
            const cs = callStore.get(callId);
            if (!cs) return;

            await terminateCall(cs.phoneNumberId, callId).catch(console.error);
            cleanupCall(callId, io, callStore, 'agent_rejected');
        });

        // ── Agent ends active call ───────────────────────────────────────────
        socket.on('agent_end_call', async (data: { callId: string }) => {
            const { callId } = data;
            console.log(`[Bridge] agent_end_call callId=${callId}`);
            const cs = callStore.get(callId);
            if (!cs) return;

            await terminateCall(cs.phoneNumberId, callId).catch(console.error);
            cleanupCall(callId, io, callStore, 'agent_ended');
        });

        // ── Disconnect cleanup ───────────────────────────────────────────────
        socket.on('disconnect', async () => {
            console.log(`[Bridge] Agent disconnected socketId=${socket.id}`);
            // Find any active call this agent owned
            for (const [callId, cs] of callStore) {
                if (cs.agentSocketId === socket.id && cs.status === CallStatus.ACTIVE) {
                    console.log(`[Bridge] Agent owning callId=${callId} disconnected — terminating`);
                    await terminateCall(cs.phoneNumberId, callId).catch(console.error);
                    cleanupCall(callId, io, callStore, 'agent_disconnected');
                }
            }
        });
    });
}

// ── PC2 setup (Bridge ↔ Agent browser) ───────────────────────────────────────

async function setupBrowserPeerConnection(
    callId: string,
    browserSdpOffer: string,
    socket: Socket,
    io: SocketIOServer,
    callStore: CallStore
): Promise<void> {
    const cs = callStore.get(callId)!;
    const iceServers = buildIceConfig();

    const pc2 = new RTCPeerConnection({ iceServers }) as RTCPeerConnection;
    cs.pc2 = pc2;
    callStore.set(callId, cs);

    // Send ICE candidates to the agent browser
    pc2.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
            socket.emit('ice_candidate', { callId, candidate: event.candidate });
        }
    };

    pc2.oniceconnectionstatechange = () => {
        console.log(`[Bridge] PC2 ICE state callId=${callId}: ${pc2.iceConnectionState}`);
        if (pc2.iceConnectionState === 'failed' || pc2.iceConnectionState === 'disconnected') {
            cleanupCall(callId, io, callStore, 'ice_failed');
        }
    };

    pc2.onconnectionstatechange = () => {
        const state = pc2.connectionState;
        console.log(`[Bridge] PC2 connection state callId=${callId}: ${state}`);
        if (state === 'connected') {
            cs.status = CallStatus.ACTIVE;
            cs.startTime = new Date();
            callStore.set(callId, cs);
            io.emit('call_active', { callId, startTime: cs.startTime });
        }
    };

    // When browser's audio arrives on PC2, bridge to PC1 (Meta)
    pc2.ontrack = (event: RTCTrackEvent) => {
        console.log(`[Bridge] PC2 track received callId=${callId} kind=${event.track.kind}`);
        event.streams[0].getTracks().forEach((track: MediaStreamTrack) => {
            if (cs.pc1) {
                cs.pc1.addTrack(track, event.streams[0]);
                console.log(`[Bridge] Bridged browser track → PC1 callId=${callId}`);
            } else {
                cs.pendingBrowserTracks.push({ track, stream: event.streams[0] });
            }
        });
    };

    // Add any Meta tracks that arrived before PC2 was ready
    if (cs.pendingMetaTracks.length > 0) {
        console.log(`[Bridge] Flushing ${cs.pendingMetaTracks.length} pending Meta tracks to PC2`);
        for (const { track, stream } of cs.pendingMetaTracks) {
            pc2.addTrack(track, stream);
        }
        cs.pendingMetaTracks = [];
        callStore.set(callId, cs);
    }

    // Set browser's offer as remote description
    await pc2.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: browserSdpOffer }));

    // Create answer for browser
    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);

    // Wait for ICE gathering
    await waitForIceGathering(pc2);

    const finalSdp = pc2.localDescription?.sdp ?? answer.sdp ?? '';

    // Send SDP answer back to the agent browser
    socket.emit('call_answer', { callId, sdp: finalSdp });
    console.log(`[Bridge] Sent SDP answer to browser for callId=${callId}`);

    // Now accept with Meta using PC1's stored answer SDP
    if (cs.pc1AnswerSdp) {
        const result = await acceptCall(cs.phoneNumberId, callId, cs.pc1AnswerSdp);
        if (!result.success) {
            console.error(`[Bridge] Meta accept failed for callId=${callId}: ${result.error}`);
            socket.emit('call_error', { callId, error: 'Failed to accept call with Meta' });
            cleanupCall(callId, io, callStore, 'meta_accept_failed');
            return;
        }
        console.log(`[Bridge] Meta accept sent for callId=${callId}`);
    } else {
        console.warn(`[Bridge] No PC1 answer SDP for callId=${callId} — cannot accept with Meta`);
    }

    // Flush any browser tracks that arrived before PC1 was ready
    if (cs.pendingBrowserTracks.length > 0 && cs.pc1) {
        for (const { track, stream } of cs.pendingBrowserTracks) {
            cs.pc1.addTrack(track, stream);
        }
        cs.pendingBrowserTracks = [];
        callStore.set(callId, cs);
    }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function cleanupCall(
    callId: string,
    io: SocketIOServer,
    callStore: CallStore,
    reason: string
): void {
    const cs = callStore.get(callId);
    if (!cs) return;

    console.log(`[Bridge] Cleaning up callId=${callId} reason=${reason}`);

    try { cs.pc1?.close(); } catch (_) { /* ignore */ }
    try { cs.pc2?.close(); } catch (_) { /* ignore */ }

    cs.status = CallStatus.TERMINATED;
    callStore.delete(callId);

    io.emit('call_terminated', { callId, reason });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildIceConfig(): RTCIceServer[] {
    const servers: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ];

    const turnUrl = process.env.TURN_SERVER_URL;
    const turnUser = process.env.TURN_USERNAME;
    const turnPass = process.env.TURN_PASSWORD;

    if (turnUrl && turnUser && turnPass) {
        servers.push({ urls: turnUrl, username: turnUser, credential: turnPass });
    }

    return servers;
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const timeout = setTimeout(resolve, 3000);
        pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') { clearTimeout(timeout); resolve(); }
        };
    });
}
