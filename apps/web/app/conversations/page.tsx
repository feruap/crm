'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io as socketIO, Socket } from 'socket.io-client';
import { useAuth } from '../../components/AuthProvider';
import {
    Search, Send, Phone, Mail, User, ShoppingCart, Tag, Clock,
    ChevronRight, MessageSquare, AlertCircle, CheckCircle, XCircle,
    ArrowUpRight, RefreshCw, Filter,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

// ─── Types ───────────────────────────────────────────────────
interface Conversation {
    id: string;
    channel_id: string;
    customer_id: string;
    assigned_agent_id: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    customer_name: string;
    customer_phone: string | null;
    customer_email: string | null;
    channel_name: string;
    provider: string;
    last_message: string | null;
    last_message_at: string | null;
    unread_count: number;
    agent_name: string | null;
}

interface Message {
    id: string;
    conversation_id: string;
    sender_type: 'customer' | 'agent' | 'bot';
    sender_id: string | null;
    content_type: string;
    body: string;
    provider_message_id: string | null;
    status: string;
    created_at: string;
}

interface CustomerContext {
    customer: {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
        created_at: string;
    };
    attributes: Record<string, string>;
    orders: Array<{
        id: string;
        wc_order_id: number | null;
        status: string;
        total: string;
        created_at: string;
    }>;
    profile: {
        preferred_products: string[];
        purchase_frequency_days: number | null;
        lifetime_value: string;
        last_purchase_at: string | null;
    } | null;
    segments: Array<{
        segment_type: string;
        segment_value: string;
    }>;
    past_conversations: Array<{
        id: string;
        status: string;
        created_at: string;
        message_count: number;
    }>;
    lifetime_value: string;
}

// ─── Helpers ─────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
}

function statusColor(status: string): string {
    switch (status) {
        case 'open': return 'bg-green-100 text-green-700';
        case 'pending': return 'bg-yellow-100 text-yellow-700';
        case 'resolved': return 'bg-slate-100 text-slate-500';
        case 'escalated': return 'bg-red-100 text-red-700';
        default: return 'bg-slate-100 text-slate-500';
    }
}

function providerIcon(provider: string): string {
    switch (provider) {
        case 'whatsapp': return '🟢';
        case 'facebook': return '🔵';
        case 'instagram': return '🟣';
        case 'webchat': return '🌐';
        default: return '💬';
    }
}

// ─── Main Component ──────────────────────────────────────────
export default function ConversationsPage() {
    const { authFetch, agent } = useAuth();

    // Conversation list state
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [loadingList, setLoadingList] = useState(true);

    // Selected conversation
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);

    // Messages
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastMsgTsRef = useRef<string | undefined>(undefined);
    const socketRef = useRef<Socket | null>(null);

    // Context panel
    const [context, setContext] = useState<CustomerContext | null>(null);
    const [showContext, setShowContext] = useState(false);
    const [loadingContext, setLoadingContext] = useState(false);

    // ─── Fetch conversation list ─────────────────────────────
    const fetchConversations = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (statusFilter) params.set('status', statusFilter);
            const res = await authFetch(`${API}/api/conversations?${params}`);
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
            }
        } catch {
            // silent
        } finally {
            setLoadingList(false);
        }
    }, [authFetch, search, statusFilter]);

    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 15000);
        return () => clearInterval(interval);
    }, [fetchConversations]);

    // ─── Fetch messages for selected conversation ────────────
    const fetchMessages = useCallback(async (convId: string, afterTs?: string) => {
        try {
            const params = new URLSearchParams();
            if (afterTs) params.set('after', afterTs);
            const res = await authFetch(`${API}/api/conversations/${convId}/messages?${params}`);
            if (res.ok) {
                const data: Message[] = await res.json();
                if (afterTs && data.length > 0) {
                    setMessages(prev => {
                        const updated = [...prev, ...data];
                        lastMsgTsRef.current = updated[updated.length - 1]?.created_at;
                        return updated;
                    });
                } else if (!afterTs) {
                    setMessages(data);
                    lastMsgTsRef.current = data[data.length - 1]?.created_at;
                }
            }
        } catch {
            // silent
        }
    }, [authFetch]);

    // ─── Socket.io connection (replaces 5-second polling) ───
    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null;
        if (!token) return;

        const socket = socketIO(API, { auth: { token }, transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('new_message', (msg: Message) => {
            setMessages(prev => {
                // Deduplicate by id
                if (prev.some(m => m.id === msg.id)) return prev;
                const updated = [...prev, msg];
                lastMsgTsRef.current = updated[updated.length - 1]?.created_at;
                return updated;
            });
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);  // only once on mount; token read from localStorage

    // ─── Select a conversation ───────────────────────────────
    const selectConversation = useCallback(async (conv: Conversation) => {
        setSelectedId(conv.id);
        setSelectedConv(conv);
        setLoadingMessages(true);
        setMessages([]);
        lastMsgTsRef.current = undefined;
        setContext(null);
        setShowContext(false);

        // Mark as read
        authFetch(`${API}/api/conversations/${conv.id}/read`, { method: 'POST' }).catch(() => {});

        // Fetch full message history
        await fetchMessages(conv.id);
        setLoadingMessages(false);

        // Join the conversation room so socket.io delivers new_message events
        socketRef.current?.emit('join_conversation', conv.id);
    }, [authFetch, fetchMessages]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ─── Fetch context ───────────────────────────────────────
    const fetchContext = useCallback(async (convId: string) => {
        setLoadingContext(true);
        try {
            const res = await authFetch(`${API}/api/conversations/${convId}/context`);
            if (res.ok) {
                setContext(await res.json());
            }
        } catch {
            // silent
        } finally {
            setLoadingContext(false);
        }
    }, [authFetch]);

    const toggleContext = () => {
        if (!showContext && selectedId && !context) {
            fetchContext(selectedId);
        }
        setShowContext(prev => !prev);
    };

    // ─── Send message ────────────────────────────────────────
    const handleSend = async () => {
        if (!newMessage.trim() || !selectedId || sending) return;
        setSending(true);
        try {
            const res = await authFetch(`${API}/api/conversations/${selectedId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ body: newMessage.trim(), content_type: 'text' }),
            });
            if (res.ok) {
                const msg = await res.json();
                setMessages(prev => [...prev, msg]);
                setNewMessage('');
            }
        } catch {
            // silent
        } finally {
            setSending(false);
        }
    };

    // ─── Assign to me ────────────────────────────────────────
    const assignToMe = async () => {
        if (!selectedId || !agent) return;
        try {
            await authFetch(`${API}/api/conversations/${selectedId}/assign`, {
                method: 'PATCH',
                body: JSON.stringify({ agent_id: agent.id }),
            });
            fetchConversations();
            if (selectedConv) {
                setSelectedConv({ ...selectedConv, assigned_agent_id: agent.id, agent_name: agent.name });
            }
        } catch {
            // silent
        }
    };

    // ─── Change status ───────────────────────────────────────
    const changeStatus = async (newStatus: string) => {
        if (!selectedId) return;
        try {
            await authFetch(`${API}/api/conversations/${selectedId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus }),
            });
            fetchConversations();
            if (selectedConv) {
                setSelectedConv({ ...selectedConv, status: newStatus });
            }
        } catch {
            // silent
        }
    };

    // ─── Render ──────────────────────────────────────────────
    return (
        <div className="flex h-full">
            {/* ─── LEFT: Conversation List ─── */}
            <div className="w-80 border-r border-slate-200 flex flex-col bg-white shrink-0">
                {/* Search & Filter */}
                <div className="p-3 border-b border-slate-200 space-y-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex gap-1">
                        {['', 'open', 'pending', 'escalated', 'resolved'].map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    statusFilter === s
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {s || 'Todos'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {loadingList ? (
                        <div className="p-4 text-center text-slate-400 text-sm">Cargando...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">Sin conversaciones</div>
                    ) : (
                        conversations.map(conv => (
                            <button
                                key={conv.id}
                                onClick={() => selectConversation(conv)}
                                className={`w-full text-left p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                                    selectedId === conv.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs">{providerIcon(conv.provider)}</span>
                                            <span className="font-medium text-sm text-slate-800 truncate">
                                                {conv.customer_name || 'Sin nombre'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 truncate mt-0.5">
                                            {conv.last_message || 'Sin mensajes'}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className="text-xs text-slate-400">
                                            {conv.last_message_at ? timeAgo(conv.last_message_at) : ''}
                                        </span>
                                        {conv.unread_count > 0 && (
                                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                                                {conv.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor(conv.status)}`}>
                                        {conv.status}
                                    </span>
                                    {conv.agent_name && (
                                        <span className="text-xs text-slate-400 truncate">
                                            → {conv.agent_name}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* ─── CENTER: Message Thread ─── */}
            <div className="flex-1 flex flex-col bg-slate-50 min-w-0">
                {!selectedId ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                        <div className="text-center">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">Selecciona una conversacion</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-slate-500" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-sm text-slate-800 truncate">
                                        {selectedConv?.customer_name || 'Cliente'}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span>{providerIcon(selectedConv?.provider || '')} {selectedConv?.channel_name}</span>
                                        <span className={`px-1.5 py-0.5 rounded ${statusColor(selectedConv?.status || '')}`}>
                                            {selectedConv?.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedConv && !selectedConv.assigned_agent_id && (
                                    <button
                                        onClick={assignToMe}
                                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Tomar
                                    </button>
                                )}
                                {selectedConv?.status === 'open' && (
                                    <button
                                        onClick={() => changeStatus('resolved')}
                                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                                    >
                                        <CheckCircle className="w-3.5 h-3.5" /> Resolver
                                    </button>
                                )}
                                {selectedConv?.status === 'resolved' && (
                                    <button
                                        onClick={() => changeStatus('open')}
                                        className="text-xs bg-yellow-500 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-600 transition-colors"
                                    >
                                        Reabrir
                                    </button>
                                )}
                                <button
                                    onClick={toggleContext}
                                    className={`p-2 rounded-lg transition-colors ${
                                        showContext ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'
                                    }`}
                                    title="Ver contexto del cliente"
                                >
                                    <ChevronRight className={`w-4 h-4 transition-transform ${showContext ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {loadingMessages ? (
                                <div className="text-center text-slate-400 text-sm py-8">Cargando mensajes...</div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-slate-400 text-sm py-8">Sin mensajes aun</div>
                            ) : (
                                messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.sender_type === 'customer' ? 'justify-start' : 'justify-end'}`}
                                    >
                                        <div
                                            className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                                                msg.sender_type === 'customer'
                                                    ? 'bg-white border border-slate-200 text-slate-800'
                                                    : msg.sender_type === 'bot'
                                                    ? 'bg-purple-100 text-purple-900'
                                                    : 'bg-blue-600 text-white'
                                            }`}
                                        >
                                            {msg.sender_type === 'bot' && (
                                                <div className="text-xs font-medium mb-1 opacity-70">🤖 Bot</div>
                                            )}
                                            <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                                            <div className={`text-xs mt-1 ${
                                                msg.sender_type === 'customer' ? 'text-slate-400' :
                                                msg.sender_type === 'bot' ? 'text-purple-400' : 'text-blue-200'
                                            }`}>
                                                {new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                                {msg.sender_type === 'agent' && msg.status === 'sent' && ' ✓'}
                                                {msg.sender_type === 'agent' && msg.status === 'delivered' && ' ✓✓'}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Composer */}
                        <div className="bg-white border-t border-slate-200 p-3">
                            <div className="flex items-end gap-2">
                                <textarea
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder="Escribe un mensaje..."
                                    rows={1}
                                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
                                    style={{ minHeight: '42px' }}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!newMessage.trim() || sending}
                                    className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ─── RIGHT: Context Panel ─── */}
            {showContext && selectedId && (
                <div className="w-80 border-l border-slate-200 bg-white overflow-y-auto shrink-0">
                    {loadingContext ? (
                        <div className="p-4 text-center text-slate-400 text-sm">Cargando contexto...</div>
                    ) : context ? (
                        <div className="p-4 space-y-5">
                            {/* Customer Info */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cliente</h4>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-sm">
                                        <User className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-800 font-medium">{context.customer.name}</span>
                                    </div>
                                    {context.customer.phone && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Phone className="w-4 h-4 text-slate-400" />
                                            <span className="text-slate-600">{context.customer.phone}</span>
                                        </div>
                                    )}
                                    {context.customer.email && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Mail className="w-4 h-4 text-slate-400" />
                                            <span className="text-slate-600">{context.customer.email}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-sm">
                                        <Clock className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-600">
                                            Cliente desde {new Date(context.customer.created_at).toLocaleDateString('es-MX')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Segments */}
                            {context.segments.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Segmentos</h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {context.segments.map((seg, i) => (
                                            <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                                                {seg.segment_type}: {seg.segment_value}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Profile */}
                            {context.profile && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Perfil</h4>
                                    <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Valor de vida</span>
                                            <span className="font-medium text-slate-800">${context.lifetime_value}</span>
                                        </div>
                                        {context.profile.purchase_frequency_days && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Frecuencia compra</span>
                                                <span className="text-slate-800">{context.profile.purchase_frequency_days} dias</span>
                                            </div>
                                        )}
                                        {context.profile.preferred_products?.length > 0 && (
                                            <div>
                                                <span className="text-slate-500 text-xs">Productos preferidos:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {context.profile.preferred_products.map((p, i) => (
                                                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                                            {p}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Orders */}
                            {context.orders.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                        Ordenes ({context.orders.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {context.orders.slice(0, 5).map(order => (
                                            <div key={order.id} className="bg-slate-50 rounded-lg p-2.5 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium text-slate-800">
                                                        {order.wc_order_id ? `#${order.wc_order_id}` : order.id.slice(0, 8)}
                                                    </span>
                                                    <span className="font-medium text-slate-800">${order.total}</span>
                                                </div>
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor(order.status)}`}>
                                                        {order.status}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(order.created_at).toLocaleDateString('es-MX')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {context.orders.length > 5 && (
                                            <p className="text-xs text-slate-400 text-center">
                                                +{context.orders.length - 5} ordenes mas
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Attributes */}
                            {Object.keys(context.attributes).length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Atributos</h4>
                                    <div className="space-y-1">
                                        {Object.entries(context.attributes).map(([key, val]) => (
                                            <div key={key} className="flex justify-between text-sm">
                                                <span className="text-slate-500">{key}</span>
                                                <span className="text-slate-800 text-right max-w-[60%] truncate">{val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Past Conversations */}
                            {context.past_conversations.length > 1 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                        Historial ({context.past_conversations.length})
                                    </h4>
                                    <div className="space-y-1.5">
                                        {context.past_conversations
                                            .filter(c => c.id !== selectedId)
                                            .slice(0, 5)
                                            .map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => {
                                                        const conv = conversations.find(x => x.id === c.id);
                                                        if (conv) selectConversation(conv);
                                                    }}
                                                    className="w-full text-left bg-slate-50 rounded p-2 text-xs hover:bg-slate-100 transition-colors"
                                                >
                                                    <div className="flex justify-between">
                                                        <span className={`px-1.5 py-0.5 rounded ${statusColor(c.status)}`}>{c.status}</span>
                                                        <span className="text-slate-400">{c.message_count} msgs</span>
                                                    </div>
                                                    <div className="text-slate-400 mt-1">
                                                        {new Date(c.created_at).toLocaleDateString('es-MX')}
                                                    </div>
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-slate-400 text-sm">Sin datos de contexto</div>
                    )}
                </div>
            )}
        </div>
    );
}
