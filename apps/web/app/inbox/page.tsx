'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../components/AuthProvider';
import CatalogPanel from '../../components/CatalogPanel';
import CustomerPanel from '../../components/CustomerPanel';
import QuickRepliesPanel from '../../components/QuickRepliesPanel';
import ScheduleMessageModal from '../../components/ScheduleMessageModal';
import {
    Search, Send, Phone, Mail, User, ShoppingCart, ShoppingBag, Tag, Clock,
    ChevronRight, MessageSquare, AlertCircle, CheckCircle, XCircle,
    ArrowUpRight, RefreshCw, Filter, Zap,
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

interface RawMessage {
    id: string;
    conversation_id: string;
    direction: 'inbound' | 'outbound';
    content: string;
    message_type: string;
    handled_by: string | null;
    provider_message_id: string | null;
    is_read: boolean;
    created_at: string;
    media_url: string | null;
    bot_action: string | null;
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

// Map raw DB message to frontend Message format
function mapMessage(raw: RawMessage): Message {
    let sender_type: 'customer' | 'agent' | 'bot' = 'customer';
    if (raw.direction === 'outbound') {
        sender_type = raw.handled_by === 'bot' || raw.bot_action ? 'bot' : 'agent';
    }
    return {
        id: raw.id,
        conversation_id: raw.conversation_id,
        sender_type,
        sender_id: null,
        body: raw.content || '',
        content_type: raw.message_type || 'text',
        provider_message_id: raw.provider_message_id,
        status: raw.is_read ? 'delivered' : 'sent',
        created_at: raw.created_at,
    };
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
export default function InboxPage() {
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
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Context panel
    const [context, setContext] = useState<CustomerContext | null>(null);
    const [showContext, setShowContext] = useState(false);
    const [loadingContext, setLoadingContext] = useState(false);

    // Composer panels
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showCatalog, setShowCatalog] = useState(false);

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
                const raw: RawMessage[] = await res.json();
                const data = raw.map(mapMessage);
                if (afterTs && data.length > 0) {
                    setMessages(prev => [...prev, ...data]);
                } else if (!afterTs) {
                    setMessages(data);
                }
            }
        } catch {
            // silent
        }
    }, [authFetch]);

    // ─── Select a conversation ───────────────────────────────
    const selectConversation = useCallback(async (conv: Conversation) => {
        setSelectedId(conv.id);
        setSelectedConv(conv);
        setLoadingMessages(true);
        setMessages([]);
        setContext(null);
        setShowContext(false);
        setShowCatalog(false);

        // Mark as read
        authFetch(`${API}/api/conversations/${conv.id}/read`, { method: 'POST' }).catch(() => {});

        // Fetch messages
        await fetchMessages(conv.id);
        setLoadingMessages(false);

        // Start polling
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(() => {
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg) {
                    fetchMessages(conv.id, lastMsg.created_at);
                }
                return prev;
            });
        }, 5000);
    }, [authFetch, fetchMessages]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

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
                setMessages(prev => [...prev, mapMessage(msg)]);
                setNewMessage('');
            }
        } catch {
            // silent
        } finally {
            setSending(false);
        }
    };

    // ─── Send cart link as message ───────────────────────────
    const handleSendCartLink = async (text: string) => {
        if (!selectedId) return;
        try {
            const res = await authFetch(`${API}/api/conversations/${selectedId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ body: text, content_type: 'text' }),
            });
            if (res.ok) {
                const msg = await res.json();
                setMessages(prev => [...prev, mapMessage(msg)]);
            }
        } catch {
            // silent
        }
    };

    // ─── Quick reply selected ─────────────────────────────────
    const handleQuickReplySelect = (content: string, id: string) => {
        setNewMessage(content);
        setShowQuickReplies(false);
        authFetch(`${API}/api/quick-replies/${id}/use`, { method: 'POST' }).catch(() => {});
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
        <div className="flex h-full relative">
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

                        {/* Catalog Panel (floating over messages) */}
                        {showCatalog && selectedId && (
                            <div className="absolute bottom-20 left-96 z-50 ml-4">
                                <CatalogPanel
                                    conversationId={selectedId}
                                    onSendCartLink={handleSendCartLink}
                                    onClose={() => setShowCatalog(false)}
                                />
                            </div>
                        )}

                        {/* Composer */}
                        <div className="bg-white border-t border-slate-200 p-3 relative">
                            {/* Quick Replies Panel (floats above composer) */}
                            {showQuickReplies && (
                                <QuickRepliesPanel
                                    onSelect={handleQuickReplySelect}
                                    onClose={() => setShowQuickReplies(false)}
                                />
                            )}

                            {/* Text input with action buttons inline */}
                            <div className="flex items-end gap-2">
                                {/* Action buttons (beside textarea) */}
                                <div className="flex items-center gap-0.5 shrink-0 pb-1">
                                    <button
                                        onClick={() => setShowQuickReplies(prev => !prev)}
                                        className={`p-2 rounded-lg transition-colors ${
                                            showQuickReplies ? 'bg-amber-100 text-amber-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                        }`}
                                        title="Respuestas rapidas"
                                    >
                                        <Zap className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setShowScheduleModal(true)}
                                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                        title="Programar mensaje"
                                    >
                                        <Clock className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setShowCatalog(prev => !prev)}
                                        className={`p-2 rounded-lg transition-colors ${
                                            showCatalog ? 'bg-purple-100 text-purple-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                        }`}
                                        title="Catalogo de productos"
                                    >
                                        <ShoppingBag className="w-4 h-4" />
                                    </button>
                                </div>
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

                        {/* Schedule Message Modal */}
                        {showScheduleModal && selectedId && (
                            <ScheduleMessageModal
                                conversationId={selectedId}
                                initialContent={newMessage}
                                onClose={() => setShowScheduleModal(false)}
                                onSuccess={() => {
                                    setNewMessage('');
                                    fetchConversations();
                                }}
                            />
                        )}
                    </>
                )}
            </div>

            {/* ─── RIGHT: Customer Panel (with tabs: Perfil, Compras, Historial) ─── */}
            {showContext && selectedId && (
                <div className="w-96 border-l border-slate-200 bg-white overflow-y-auto shrink-0">
                    <CustomerPanel conversationId={selectedId} />
                </div>
            )}
        </div>
    );
}
