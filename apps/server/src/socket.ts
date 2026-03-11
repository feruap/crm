import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

let io: SocketServer;

export function initSocket(httpServer: HttpServer, corsOrigin: string): SocketServer {
    io = new SocketServer(httpServer, {
        cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    });

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Agent joins their personal room and their conversations
        socket.on('join_conversation', (conversationId: string) => {
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
