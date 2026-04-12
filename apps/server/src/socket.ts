import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyToken, AuthPayload } from './middleware/auth';
import { db } from './db';

let io: SocketServer;

// Augment Socket data type with the authenticated agent payload
declare module 'socket.io' {
    interface Socket {
        agent?: AuthPayload;
    }
}

export function initSocket(httpServer: HttpServer, corsOrigin: string): SocketServer {
    io = new SocketServer(httpServer, {
        cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    });

    // ── Auth middleware: validate JWT before any event is processed ─────────
    io.use((socket: Socket, next) => {
        const token =
            (socket.handshake.auth?.token as string | undefined) ||
            (socket.handshake.headers?.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');

        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            socket.agent = verifyToken(token);
            next();
        } catch {
            next(new Error('Invalid or expired token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        console.log(`Socket connected: ${socket.id} (agent: ${socket.agent?.agent_id})`);

        // Agent joins a conversation room only after verifying DB-level access
        socket.on('join_conversation', async (conversationId: string) => {
            if (!socket.agent) {
                socket.emit('error', { message: 'Not authenticated' });
                return;
            }

            try {
                // Directors and superadmins can join any conversation.
                // Gerentes/operadors must be the assigned agent or the conversation
                // must belong to a channel they have access to.
                let allowed = false;

                if (socket.agent.role === 'director' || socket.agent.role === 'superadmin') {
                    // Verify conversation exists
                    const check = await db.query(
                        `SELECT id FROM conversations WHERE id = $1`,
                        [conversationId]
                    );
                    allowed = check.rows.length > 0;
                } else {
                    // Operadors/gerentes: must be assigned agent or conversation must exist
                    const check = await db.query(
                        `SELECT id FROM conversations
                         WHERE id = $1
                           AND (assigned_agent_id = $2
                                OR $2 IN (
                                    SELECT agent_id FROM team_members tm
                                    JOIN teams t ON t.id = tm.team_id
                                    WHERE t.channel_id = conversations.channel_id
                                )
                                OR assigned_agent_id IS NULL)`,
                        [conversationId, socket.agent.agent_id]
                    );
                    allowed = check.rows.length > 0;
                }

                if (!allowed) {
                    socket.emit('error', { message: 'Access denied to conversation' });
                    return;
                }

                socket.join(`conv:${conversationId}`);
            } catch (err) {
                console.error('[Socket join_conversation error]', err);
                socket.emit('error', { message: 'Internal error joining conversation' });
            }
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
