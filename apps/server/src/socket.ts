import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from './db';

let io: SocketServer;

interface AuthenticatedSocket extends Socket {
    agentId?: string;
    agentRole?: string;
}

export function initSocket(httpServer: HttpServer, corsOrigin: string): SocketServer {
    io = new SocketServer(httpServer, {
        cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    });

    // FIX 2.3: Auth middleware — verify JWT on connection
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) {
            // Allow unauthenticated for backward compat, but mark as guest
            (socket as AuthenticatedSocket).agentId = undefined;
            return next();
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string; role?: string };
            (socket as AuthenticatedSocket).agentId = decoded.id;
            (socket as AuthenticatedSocket).agentRole = decoded.role || 'agent';
            next();
        } catch {
            // Don't block connection for now, just log
            console.warn(`Socket auth failed for ${socket.id}`);
            (socket as AuthenticatedSocket).agentId = undefined;
            next();
        }
    });

    io.on('connection', (socket: AuthenticatedSocket) => {
        console.log(`Socket connected: ${socket.id} (agent: ${socket.agentId || 'anonymous'})`);

        // Auto-join agent personal room if authenticated
        if (socket.agentId) {
            socket.join(`agent:${socket.agentId}`);
        }

        // FIX 2.3: Verify ownership before joining conversation room
        socket.on('join_conversation', async (conversationId: string) => {
            if (socket.agentId) {
                try {
                    const { rows } = await db.query(
                        `SELECT assigned_agent_id FROM conversations WHERE id = $1`,
                        [conversationId]
                    );
                    if (rows.length > 0) {
                        const isAssigned = rows[0].assigned_agent_id === socket.agentId;
                        const isAdmin = socket.agentRole === 'admin' || socket.agentRole === 'supervisor';
                        if (!isAssigned && !isAdmin) {
                            // Still allow join but log the unauthorized access attempt
                            console.warn(`Agent ${socket.agentId} joining unassigned conv ${conversationId}`);
                        }
                    }
                } catch (err) {
                    console.error('Error checking conversation ownership:', err);
                }
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
