import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from './db';

let io: SocketServer;

export function initSocket(httpServer: HttpServer, corsOrigin: string): SocketServer {
    io = new SocketServer(httpServer, {
        cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    });

    // JWT auth middleware — token required; reject connections without a valid token.
    io.use((socket, next) => {
        const token = (socket.handshake.auth as any)?.token
            || (socket.handshake.headers?.authorization || '').replace('Bearer ', '');
        if (!token) {
            return next(new Error('Authentication required: no token provided'));
        }
        try {
            const secret = process.env.JWT_SECRET || 'secret';
            const payload = jwt.verify(token, secret) as any;
            const agentId = payload.agentId || payload.id || null;
            if (!agentId) {
                return next(new Error('Authentication required: token missing agent identity'));
            }
            (socket as any).agentId = agentId;
            (socket as any).agentRole = payload.role || null;
            next();
        } catch {
            return next(new Error('Authentication required: invalid or expired token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Auto-join agent's personal notification room (used for discount approvals, etc.)
        const connectedAgentId = (socket as any).agentId;
        if (connectedAgentId) {
            socket.join(`agent:${connectedAgentId}`);
        }

        // Agent joins a conversation room after verifying DB-level permissions.
        socket.on('join_conversation', async (conversationId: string) => {
            const agentId = (socket as any).agentId;
            if (!agentId) {
                socket.emit('error', { message: 'Unauthorized: no agent identity' });
                return;
            }
            try {
                // 1. Fetch agent role
                const agentRow = await db.query(
                    `SELECT role FROM agents WHERE id = $1`, [agentId]
                );
                const agentRole: string = agentRow.rows[0]?.role || '';
                const isAdmin = agentRole === 'admin' || agentRole === 'supervisor';

                if (!isAdmin) {
                    // 2. Verify agent has access to this conversation's channel
                    const conv = await db.query(
                        `SELECT c.assigned_agent_id, c.channel_id,
                                ch.id AS ch_id
                         FROM conversations c
                         JOIN channels ch ON ch.id = c.channel_id
                         WHERE c.id = $1`,
                        [conversationId]
                    );
                    if (conv.rows.length === 0) {
                        socket.emit('error', { message: 'Conversation not found' });
                        return;
                    }
                    const row = conv.rows[0];
                    // Agent must be assigned to the conversation OR belong to a team
                    // that has access to the conversation's channel.
                    const isAssigned = String(row.assigned_agent_id) === String(agentId);
                    if (!isAssigned) {
                        const teamAccess = await db.query(
                            `SELECT 1 FROM team_members tm
                             JOIN teams t ON t.id = tm.team_id
                             WHERE tm.agent_id = $1
                               AND (t.channel_id = $2 OR t.channel_id IS NULL)
                             LIMIT 1`,
                            [agentId, row.channel_id]
                        );
                        if (teamAccess.rows.length === 0) {
                            console.warn(`Socket: agent ${agentId} denied join to conv ${conversationId} — no channel access`);
                            socket.emit('error', { message: 'Access denied to this conversation' });
                            return;
                        }
                    }
                }
            } catch (err) {
                // On DB error, allow join rather than block (fail open for resilience)
                console.error(`Socket join_conversation DB check failed:`, err);
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
