/**
 * index.ts — WebRTC Bridge main server
 * Binds Express + Socket.IO, registers call webhook and bridge handlers.
 */
import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';

import { CallStore } from './webrtc-bridge';
import { createCallRouter } from './call-handler';
import { registerBridgeHandlers } from './webrtc-bridge';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();
const httpServer = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// ── In-memory call store ──────────────────────────────────────────────────────
// For production at scale, replace with Redis-backed store.
const callStore: CallStore = new Map();

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        activeCalls: callStore.size,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
    });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', createCallRouter(io, callStore));

// ── Socket.IO bridge handlers ─────────────────────────────────────────────────
registerBridgeHandlers(io, callStore);

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] WebRTC Bridge listening on port ${PORT}`);
    console.log(`[Server] CORS origin: ${CORS_ORIGIN}`);
    console.log(`[Server] TURN server: ${process.env.TURN_SERVER_URL ?? '(none)'}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received — shutting down');
    httpServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('[Server] SIGINT received — shutting down');
    httpServer.close(() => process.exit(0));
});
