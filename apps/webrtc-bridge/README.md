# WebRTC Bridge — WhatsApp Business Calling

Server-side WebRTC bridge that connects Meta's WhatsApp Calling API to CRM agents in the browser.

## Architecture

```
WhatsApp Caller
      │  (WebRTC + TURN)
      ▼
[Meta WebRTC endpoint]
      │  (SDP offer via webhook)
      ▼
[webrtc-bridge] ──── PC1 (wrtc, server-side) ──── Meta audio
      │
      │  Socket.IO (SDP signalling)
      ▼
[CRM browser] ──── PC2 (standard WebRTC) ──── agent mic/speaker
```

**Two RTCPeerConnections on the bridge server:**
- **PC1** — bridge ↔ Meta (uses `@roamhq/wrtc` Node.js WebRTC)
- **PC2** — bridge ↔ agent browser (standard browser WebRTC, signalled via Socket.IO)

Audio tracks are bridged: PC1 tracks → PC2, PC2 tracks → PC1.

## Call Flow

1. Meta POSTs call webhook to `/webhook/call`
2. Bridge calls `pre_accept` (< 5 s, required by Meta)
3. Bridge creates PC1, sets Meta's SDP offer, generates answer
4. Bridge emits `incoming_call` via Socket.IO → all agents see notification
5. Agent clicks **Accept** in CRM browser
6. Browser creates RTCPeerConnection, sends SDP offer via Socket.IO `agent_accept_call`
7. Bridge creates PC2, sends SDP answer back to browser
8. Bridge calls Meta `accept` with PC1's SDP answer — WebRTC established
9. Audio flows: caller ↔ PC1 ↔ PC2 ↔ agent browser

## Socket.IO Events

### Bridge → Browser
| Event | Payload | Description |
|-------|---------|-------------|
| `incoming_call` | `{ callId, from, phoneNumberId, timestamp }` | New call arrived |
| `call_ready` | `{ callId, from }` | PC1 SDP ready, safe to accept |
| `call_answer` | `{ callId, sdp }` | SDP answer for browser's PC |
| `ice_candidate` | `{ callId, candidate }` | ICE candidate from bridge PC2 |
| `call_active` | `{ callId, startTime }` | Both sides connected |
| `call_terminated` | `{ callId, reason }` | Call ended |
| `call_error` | `{ callId, error }` | Error during call setup |

### Browser → Bridge
| Event | Payload | Description |
|-------|---------|-------------|
| `agent_accept_call` | `{ callId, sdp }` | Agent accepts; SDP offer from browser |
| `agent_ice_candidate` | `{ callId, candidate }` | ICE candidate from browser |
| `agent_reject_call` | `{ callId }` | Agent rejects incoming call |
| `agent_end_call` | `{ callId }` | Agent hangs up active call |

## HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check + active call count |
| `POST` | `/webhook/call` | Meta call webhook receiver |
| `GET` | `/calls` | List active calls (debug) |

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `META_ACCESS_TOKEN` | ✅ | WhatsApp Business permanent token |
| `META_APP_SECRET` | ✅ | App secret for webhook verification |
| `META_PHONE_NUMBER_ID` | ✅ | WhatsApp phone number ID |
| `TURN_SERVER_URL` | ✅ | e.g. `turn:rtc1.botonmedico.com:3478` |
| `TURN_USERNAME` | ✅ | TURN credential username |
| `TURN_PASSWORD` | ✅ | TURN credential password |
| `PORT` | — | Default: `4000` |
| `CORS_ORIGIN` | — | Default: `http://localhost:3000` |

## Deploy on Coolify

1. Create a new **Docker Compose** service in Coolify
2. Point it to this directory (`apps/webrtc-bridge/`)
3. Set environment variables in Coolify's env panel
4. Assign domain `rtc.botonmedico.com` → port 4000
5. **Important**: ensure UDP ports 10000–10100 are open in the server firewall

```bash
# Firewall (run on server 217.76.52.85)
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp
ufw allow 5349/udp
ufw allow 10000:10100/udp
ufw allow 4000/tcp
```

## Configure Meta Webhook

In [Meta for Developers](https://developers.facebook.com/apps/):
1. Go to WhatsApp → Configuration → Webhooks
2. Add webhook URL: `https://rtc.botonmedico.com/webhook/call`
3. Subscribe to field: `calls`

> Alternatively, the CRM's existing `/api/webhooks/whatsapp` can forward call events to the bridge (already implemented in `apps/server/src/routes/webhooks.ts`).

## Development

```bash
cd apps/webrtc-bridge
cp .env.example .env   # fill in your values
npm install
npm run dev            # ts-node-dev with hot reload
```

## Notes

- **wrtc**: Uses `@roamhq/wrtc` (maintained fork of `wrtc`) which ships prebuilt binaries for Linux x64/arm64. The Dockerfile uses `node:20-slim` (glibc) not Alpine (musl) for binary compatibility.
- **TURN**: The bundled coturn service uses `network_mode: host` which is required for TURN to correctly relay media between clients behind NAT.
- **Call state**: Stored in-memory (`Map`). Restarting the bridge terminates all active calls. For HA deployments, replace with Redis.
