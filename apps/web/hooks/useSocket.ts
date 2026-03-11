"use client";
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

let globalSocket: Socket | null = null;

function getSocket(): Socket {
    if (!globalSocket) {
        globalSocket = io(SERVER_URL, { autoConnect: false });
    }
    return globalSocket;
}

export function useSocket() {
    const socketRef = useRef<Socket>(getSocket());

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket.connected) socket.connect();
        return () => { /* keep socket alive across route changes */ };
    }, []);

    const joinConversation = useCallback((conversationId: string) => {
        socketRef.current.emit('join_conversation', conversationId);
    }, []);

    const leaveConversation = useCallback((conversationId: string) => {
        socketRef.current.emit('leave_conversation', conversationId);
    }, []);

    const onNewMessage = useCallback((handler: (msg: any) => void) => {
        socketRef.current.on('new_message', handler);
        return () => { socketRef.current.off('new_message', handler); };
    }, []);

    const onAlert = useCallback((handler: (alert: any) => void) => {
        socketRef.current.on('new_alert', handler);
        return () => { socketRef.current.off('new_alert', handler); };
    }, []);

    const onConversationUpdated = useCallback((handler: (data: any) => void) => {
        socketRef.current.on('conversation_updated', handler);
        return () => { socketRef.current.off('conversation_updated', handler); };
    }, []);


    return { joinConversation, leaveConversation, onNewMessage, onAlert, onConversationUpdated };
}
