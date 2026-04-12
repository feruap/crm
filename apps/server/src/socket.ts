import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from './db';

let io: SocketServer;

export function initSocket(httpServer: HttpServer, corsOrigin: string): SocketServer {
    io = new SocketServer(httpServer, {
        cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    });

    // JWT auth middleware — token required; reject connections without a valid token
    io.use((socket, next) => {
        const token = (socket.handshake.auth as any)?.token
            || (socket.handshake.headers?.authorization || '').replace('Bearer ', '');
        if (!token) return next(new Error('Authentication required'));
        try {
            const secret = process.env.JWT_SECRET || 'secret';
            const payload = jwt.verify(token, secret) as any;
            (socket as any).agentId = payload.agentId || payload.id || null;
            next();
        } catch {
            return next(new Error('Invalid or expired token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Auto-join agent's personal notification room (used for discount approvals, etc.)
        const connectedAgentId = (socket as any).agentId;
        if (connectedAgentId) {
            socket.join(`agent:${connectedAgentId}`);
        }

        // Agent joins their personal room and their conversations
        socket.on('join_conversation', async (conversationId: string) => {
            const agentId = (socket as any).agentId;
            if (agentId) {
                try {
                    const agentRow = await db.query(
                        `SELECT role FROM agents WHERE id = $1`, [agentId]
                    );
                    const isAdmin = agentRow.rows[0]?.role === 'admin';
                    if (!isAdmin) {
                        const conv = await db.query(
                            `SELECT assigned_agent_id FROM conversations WHERE id = $1`, [conversationId]
                        );
                        // log unassigned joins but still allow (read-only visibility)
                        if (conv.rows.length > 0 && conv.rows[0].assigned_agent_id !== agentId) {
                            console.log(`Socket: agent ${agentId} joining unassigned conv ${conversationId}`);
                        }
                    }
                } catch { /* allow join on DB error */ }
            }
            socket.join(`conv:${conversationId}`);
        });

        socket.on('leave_conversation', (conversationId: string) => {
            socket.leave(`conv:${conversationId}`);
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
}

export function getIO(): SocketServer {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
}

// ─── Emit helpers ─────────────────────────────────────────────────────────────

export function emitNewMessage(conversationId: string, message: object): void {
    getIO().to(`conv:${conversationId}`).emit('new_message', message);
}

export function emitConversationUpdated(conversationId: string, data: object): void {
    getIO().to(`conv:${conversationId}`).emit('conversation_updated', data);
}

export function emitAlert(alert: object): void {
    getIO().emit('new_alert', alert);
}

export function emitEscalationAlert(
    conversationId: string,
    priority: string,
    customerName: string,
    reason: string,
    slaDeadline: Date
): void {
    getIO().emit('escalation_alert', { conversationId, priority, customerName, reason, slaDeadline });
}
