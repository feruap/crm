"use client";
import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { io, Socket } from 'socket.io-client';

const { Send, Bot, Loader2 } = Lucide as any;

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot' | 'human';
}

export default function LiveChatPage() {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', text: '¡Hola! ¿En qué podemos ayudarte?', sender: 'bot' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [contactId, setContactId] = useState<string>('');
    const [conversationId, setConversationId] = useState<string | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initialize contact ID and Socket.io
    useEffect(() => {
        let id = localStorage.getItem('myalice_contact_id');
        if (!id) {
            id = 'chat_' + Math.random().toString(36).substring(2, 11);
            localStorage.setItem('myalice_contact_id', id);
        }
        setContactId(id);

        const socket = io(SERVER_URL);
        socketRef.current = socket;

        socket.on('new_message', (data: any) => {
            // data contains { conversation_id, message: { content, direction, handled_by } }
            if (data.message.direction === 'outbound') {
                setMessages(prev => {
                    // Evitar duplicados si el bot responde muy rápido
                    if (prev.find(m => m.id === data.message.id)) return prev;
                    return [...prev, {
                        id: data.message.id || Date.now().toString(),
                        text: data.message.content,
                        sender: data.message.handled_by === 'bot' ? 'bot' : 'human'
                    }];
                });
                setIsTyping(false);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const userMsgText = inputValue;
        const tempId = Date.now().toString();

        setMessages(prev => [...prev, { id: tempId, text: userMsgText, sender: 'user' }]);
        setInputValue('');
        setIsTyping(true);

        try {
            const res = await fetch(`${SERVER_URL}/api/webhooks/webchat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contact_id: contactId,
                    name: 'Usuario Web',
                    message: userMsgText
                })
            });
            const data = await res.json();
            if (data.conversationId) {
                setConversationId(data.conversationId);
                // Subscribe to this specific conversation room if needed
                socketRef.current?.emit('join_conversation', data.conversationId);
            }
        } catch (err) {
            console.error('Error sending message:', err);
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col h-screen w-full bg-slate-50 relative font-sans">
            {/* Header */}
            <div className="bg-indigo-600 px-4 py-4 flex items-center justify-between shadow-md z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white">
                        <Bot className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="font-bold text-white text-base">Asistencia en Línea</h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                            <span className="text-indigo-100 text-xs font-medium">En línea</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="text-center text-xs text-slate-400 my-4 font-medium uppercase tracking-widest">
                    Hoy
                </div>
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="max-w-[70%] bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-3 bg-white border-t flex items-center gap-2">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Escribe tu mensaje..."
                    className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                    disabled={isTyping}
                />
                <button
                    type="submit"
                    disabled={!inputValue.trim() || isTyping}
                    className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-full flex items-center justify-center transition-colors shrink-0 shadow-sm"
                >
                    <Send className="w-4 h-4 ml-0.5" />
                </button>
            </form>
        </div>
    );
}
