"use client";
/* v4-catalog-fix */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Lucide from 'lucide-react';
const {
    Send, Bot, User, Users, Search, Megaphone, Loader2,
    CheckCircle, Plus, X, Check, Trash2, Tag, Star, Archive,
    MessageCircle, Image, FileText, Calendar, Clock, Sparkles,
    Zap, UserCheck, MessageSquare, ChevronDown, CheckCheck, MailCheck, MoreVertical, Filter,
    DollarSign,
} = Lucide as any;

import CustomerPanel from '../../components/CustomerPanel';
import AIWriterPanel from '../../components/AIWriterPanel';
import QuickRepliesPanel from '../../components/QuickRepliesPanel';
import EventModal from '../../components/EventModal';
import ScheduleMessageModal from '../../components/ScheduleMessageModal';
import CatalogPanel from '../../components/CatalogPanel';
import { apiFetch } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
    id: string;
    direction: 'inbound' | 'outbound';
    content: string;
    created_at: string;
    handled_by: 'bot' | 'human' | null;
}

interface Conversation {
    id: string;
    customer_name: string;
    channel_provider: string;
    last_message: string;
    last_message_at: string;
    unread_count: number;
    status: string;
    customer_id: string;
    campaign_name?: string;
    campaign_platform?: string;
    handled_by?: 'bot' | 'human' | null;
    assigned_agent_id?: string | null;
    agent_name?: string | null;
    is_starred?: boolean;
    conversation_label?: string;
}

// ── Filter state ──────────────────────────────────────────────────────────────
type TabFilter = 'all' | 'mine' | 'unread' | 'archived' | 'starred';
type ChannelFilter = 'all' | 'whatsapp' | 'facebook' | 'instagram' | 'tiktok';
type HandlerFilter = 'all' | 'bot' | 'human';

// ── Helpers ───────────────────────────────────────────────────────────────────
const PROVIDER_COLOR: Record<string, string> = {
    whatsapp: 'bg-green-500',
    instagram: 'bg-pink-500',
    facebook: 'bg-blue-500',
    tiktok: 'bg-slate-800',
};
const PLATFORM_EMOJI: Record<string, string> = {
    facebook: '🔵', instagram: '🩷', tiktok: '⚫', google: '🔴', whatsapp: '🟢',
};

// Status labels removed as we use TabFilter now

function buildQuery(tab: TabFilter, channel: ChannelFilter, handler: HandlerFilter) {
    const params = new URLSearchParams();

    if (tab === 'archived') {
        params.set('archived', 'true');
    } else {
        if (tab === 'starred') params.set('starred', 'true');
        if (tab === 'mine') params.set('agent_id', 'me'); // The backend should handle 'me' or we get it from auth
        // For 'unread', the backend currently doesn't have a direct filter, 
        // but we can add one or filter client-side. Let's assume backend can handle it or we use 'open' as default.
        params.set('status', 'open');
    }

    if (channel !== 'all') params.set('channel_provider', channel);
    if (handler !== 'all') params.set('handled_by', handler);
    return `/api/conversations?${params}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function InboxPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [search, setSearch] = useState('');
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [sending, setSending] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null); // 'resolve'|'snooze'|'takeover'

    // Multi-feature UI states
    const [showAI, setShowAI] = useState(false);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [showEventModal, setShowEventModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showCatalog, setShowCatalog] = useState(false);


    // Filters
    const [tabFilter, setTabFilter] = useState<TabFilter>('all');
    const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
    const [handlerFilter, setHandlerFilter] = useState<HandlerFilter>('all');

    // Agent assignment
    const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
    const [showAssignDropdown, setShowAssignDropdown] = useState(false);
    const assignDropdownRef = useRef<HTMLDivElement>(null);

    const bottomRef = useRef<HTMLDivElement>(null);
    const { joinConversation, leaveConversation, onNewMessage } = useSocket();

    // ── Load conversations when filters change ─────────────────────────────────
    const loadConversations = useCallback(async () => {
        setLoadingConvs(true);
        try {
            let url = buildQuery(tabFilter, channelFilter, handlerFilter);
            const r = await apiFetch(url);
            const data = await r.json();

            if (!Array.isArray(data)) {
                throw new Error('Data is not an array');
            }

            let finalData = data;
            if (tabFilter === 'unread') {
                finalData = data.filter((c: any) => c.unread_count > 0);
            }

            setConversations(finalData);
            setSelected(prev => finalData.find((c: Conversation) => c.id === prev) ? prev : (finalData[0]?.id ?? null));
        } catch (err) {
            console.error('Error loading conversations:', err);
            setConversations([]);
        } finally {
            setLoadingConvs(false);
        }
    }, [tabFilter, channelFilter, handlerFilter]);

    useEffect(() => { loadConversations(); }, [loadConversations]);

    // Handle deep link to specific conversation
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const convId = params.get('c');
            if (convId) setSelected(convId);
        }
    }, []);

    // ── Load agents for assignment dropdown ───────────────────────────────────
    useEffect(() => {
        apiFetch('/api/agents').then(r => r.json()).then(data => {
            if (Array.isArray(data)) setAgents(data.map((a: any) => ({ id: a.id, name: a.name })));
        }).catch(console.error);
    }, []);

    // ── Close assign dropdown on outside click ────────────────────────────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target as Node)) {
                setShowAssignDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Load messages when conversation changes ────────────────────────────────
    useEffect(() => {
        if (!selected) return;
        setLoadingMsgs(true);
        apiFetch(`/api/conversations/${selected}/messages`)
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) setMessages(data);
                else setMessages([]);
            })
            .catch(err => {
                console.error('Error loading messages:', err);
                setMessages([]);
            })
            .finally(() => setLoadingMsgs(false));

        joinConversation(selected);
        return () => leaveConversation(selected);
    }, [selected]);

    // ── Real-time new messages via Socket.io ───────────────────────────────────
    useEffect(() => {
        return onNewMessage((msg: Message) => {
            setMessages(prev => [...prev, msg]);
        });
    }, [onNewMessage]);

    // ── Scroll to bottom on new messages ──────────────────────────────────────
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Send message ───────────────────────────────────────────────────────────
    const send = async () => {
        if (!input.trim() || !selected || sending) return;
        setSending(true);
        try {
            const res = await apiFetch(`/api/conversations/${selected}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content: input, message_type: 'text' }),
            });
            const msg = await res.json();
            setMessages(prev => [...prev, msg]);
            setInput('');
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    // ── Quick actions ──────────────────────────────────────────────────────────
    const doStatusChange = async (newStatus: 'resolved' | 'snoozed') => {
        if (!selected) return;
        setActionLoading(newStatus);
        try {
            await apiFetch(`/api/conversations/${selected}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus }),
            });
            setConversations(prev => {
                const idx = prev.findIndex(c => c.id === selected);
                const next = prev.filter(c => c.id !== selected);
                setSelected(next[idx] ? next[idx].id : (next[0]?.id ?? null));
                return next;
            });
        } catch (err) { console.error(err); } finally { setActionLoading(null); }
    };

    const doTakeover = async () => {
        if (!selected) return;
        setActionLoading('takeover');
        try {
            await apiFetch(`/api/conversations/${selected}/takeover`, { method: 'PATCH' });
            setConversations(prev => prev.map(c => c.id === selected ? { ...c, handled_by: 'human' } : c));
        } catch (err) { console.error(err); } finally { setActionLoading(null); }
    };

    const doAssign = async (agentId: string | null) => {
        if (!selected) return;
        setShowAssignDropdown(false);
        try {
            await apiFetch(`/api/conversations/${selected}/assign`, {
                method: 'PATCH',
                body: JSON.stringify({ agent_id: agentId }),
            });
            setConversations(prev => prev.map(c => {
                if (c.id !== selected) return c;
                const agent = agents.find(a => a.id === agentId);
                return { ...c, assigned_agent_id: agentId, agent_name: agent?.name ?? null };
            }));
        } catch (err) { console.error(err); }
    };

    const toggleStar = async () => {
        if (!selected) return;
        try {
            const res = await apiFetch(`/api/conversations/${selected}/star`, { method: 'PATCH' });
            const data = await res.json();
            setConversations(prev => prev.map(c => c.id === selected ? { ...c, is_starred: data.is_starred } : c));
        } catch (err) { console.error(err); }
    };

    const toggleArchive = async () => {
        if (!selected) return;
        try {
            await apiFetch(`/api/conversations/${selected}/archive`, { method: 'PATCH' });
            setConversations(prev => prev.filter(c => c.id !== selected));
            setSelected(null);
        } catch (err) { console.error(err); }
    };

    const setLabel = async (label: string) => {
        if (!selected) return;
        try {
            await apiFetch(`/api/conversations/${selected}/label`, {
                method: 'PATCH',
                body: JSON.stringify({ label }),
            });
            setConversations(prev => prev.map(c => c.id === selected ? { ...c, conversation_label: label } : c));
        } catch (err) { console.error(err); }
    };

    const markRead = async () => {
        if (!selected) return;
        try {
            await apiFetch(`/api/conversations/${selected}/read`, { method: 'PATCH' });
            setConversations(prev => prev.map(c => c.id === selected ? { ...c, unread_count: 0 } : c));
        } catch (err) { console.error(err); }
    };

    const onSelectQuickReply = async (content: string, id: string) => {
        setInput(content);
        setShowQuickReplies(false);
        try {
            apiFetch(`/api/quick-replies/${id}/use`, { method: 'POST' });
        } catch (err) { console.error(err); }
    };

    // ── Derived ────────────────────────────────────────────────────────────────
    const filtered = conversations.filter(c =>
        c.customer_name?.toLowerCase().includes(search.toLowerCase())
    );
    const conv = conversations.find(c => c.id === selected);

    return (
        <div className="flex h-full">
            {/* ── Column 1: Conversation list ── */}
            <div className="w-72 shrink-0 border-r bg-white flex flex-col">
                {/* Header + search */}
                <div className="p-4 border-b space-y-3">
                    <h2 className="font-bold text-slate-800">Inbox</h2>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar conversación..."
                            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                    </div>

                    {/* Tabs system */}
                    <div className="flex border-b -mx-4 px-4 overflow-x-auto no-scrollbar">
                        {[
                            { id: 'all', label: 'Todos' },
                            { id: 'mine', label: 'Míos' },
                            { id: 'unread', label: 'No leídos' },
                            { id: 'archived', label: 'Archivados' },
                            { id: 'starred', label: '⭐' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setTabFilter(tab.id as TabFilter)}
                                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap
                                    ${tabFilter === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Channel + handler filter row */}
                    <div className="flex gap-2">
                        {/* Channel dropdown */}
                        <div className="relative flex-1">
                            <select
                                value={channelFilter}
                                onChange={e => setChannelFilter(e.target.value as ChannelFilter)}
                                className="w-full appearance-none pl-2 pr-6 py-1.5 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 text-slate-600"
                            >
                                <option value="all">Todos canales</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="facebook">Facebook</option>
                                <option value="instagram">Instagram</option>
                                <option value="tiktok">TikTok</option>
                            </select>
                            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Handler filter pills */}
                        <div className="flex gap-1 items-center">
                            {(['all', 'bot', 'human'] as HandlerFilter[]).map(h => (
                                <button
                                    key={h}
                                    onClick={() => setHandlerFilter(h)}
                                    title={h === 'all' ? 'Todos' : h === 'bot' ? 'Solo bot' : 'Solo agente'}
                                    className={`p-1.5 rounded-md transition-colors ${handlerFilter === h ? 'bg-purple-100 text-purple-700' : 'text-slate-400 hover:bg-slate-100'}`}
                                >
                                    {h === 'all' && <Filter className="w-3.5 h-3.5" />}
                                    {h === 'bot' && <Bot className="w-3.5 h-3.5" />}
                                    {h === 'human' && <User className="w-3.5 h-3.5" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Conversation list */}
                <div className="overflow-y-auto flex-1">
                    {loadingConvs && (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        </div>
                    )}
                    {!loadingConvs && filtered.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                            <MessageCircle className="w-8 h-8" />
                            <p className="text-sm">Sin conversaciones</p>
                        </div>
                    )}
                    {filtered.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setSelected(c.id)}
                            className={`w-full text-left px-4 py-3 border-b flex items-start gap-3 hover:bg-slate-50 transition-colors
                                ${selected === c.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                        >
                            <div className={`w-9 h-9 rounded-full ${PROVIDER_COLOR[c.channel_provider] ?? 'bg-slate-400'} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                                {c.customer_name?.[0] ?? '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-slate-800 truncate">{c.customer_name}</span>
                                    <span className="text-xs text-slate-400 shrink-0 ml-1">
                                        {c.last_message_at
                                            ? new Date(c.last_message_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                                            : ''}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">{c.last_message}</p>
                                {c.campaign_name && (
                                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                        <Megaphone className="w-3 h-3 shrink-0" />
                                        {PLATFORM_EMOJI[c.campaign_platform ?? '']} {c.campaign_name}
                                    </p>
                                )}
                                <span className={`text-xs flex items-center gap-0.5 mt-0.5 ${(c as any).handled_by === 'bot' ? 'text-purple-500' : 'text-slate-400'}`}>
                                    {(c as any).handled_by === 'bot'
                                        ? <><Bot className="w-3 h-3" />Bot</>
                                        : <><User className="w-3 h-3" />{c.agent_name ?? 'Agente'}</>}
                                </span>
                                {(c as any).is_starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 absolute right-4 bottom-3" />}
                            </div>
                            {c.unread_count > 0 && (
                                <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0">
                                    {c.unread_count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Column 2: Chat ── */}
            <div className="flex-1 flex flex-col min-w-0">
                {conv && (
                    <div className="px-6 py-3 border-b bg-white flex items-center shrink-0 gap-3">
                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-full ${PROVIDER_COLOR[conv.channel_provider] ?? 'bg-slate-400'} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                            {conv.customer_name?.[0] ?? '?'}
                        </div>

                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800">{conv.customer_name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-2 capitalize">
                                {conv.channel_provider} · {conv.status}
                                {conv.campaign_name && (
                                    <span className="flex items-center gap-1 text-slate-400">
                                        · <Megaphone className="w-3 h-3" />
                                        {PLATFORM_EMOJI[conv.campaign_platform ?? '']} {conv.campaign_name}
                                    </span>
                                )}
                            </p>
                        </div>

                        {/* Quick action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                            {/* Label dropdown */}
                            <div className="relative group">
                                <button className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium border rounded-lg hover:bg-slate-50 transition-colors">
                                    <Tag className="w-3.5 h-3.5" />
                                    <span>{(conv as any).conversation_label || 'Etiqueta'}</span>
                                </button>
                                <div className="absolute right-0 top-full mt-1 w-40 bg-white border rounded-lg shadow-lg hidden group-hover:block z-50">
                                    {['Nuevo Cliente', 'Negociación', 'Seguimiento', 'Cerrado', 'Sin interés'].map(l => (
                                        <button
                                            key={l}
                                            onClick={() => setLabel(l)}
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                                        >
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Assign agent */}
                            <div className="relative" ref={assignDropdownRef}>
                                <button
                                    onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium border rounded-lg hover:bg-slate-50 transition-colors"
                                    title="Asignar agente"
                                >
                                    <Users className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="max-w-[80px] truncate text-slate-600">
                                        {(conv as any).agent_name ?? 'Asignar'}
                                    </span>
                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                </button>
                                {showAssignDropdown && (
                                    <div className="absolute right-0 top-full mt-1 w-52 bg-white border rounded-lg shadow-lg z-50">
                                        <button
                                            onClick={() => doAssign(null)}
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 rounded-t-lg text-slate-500 border-b"
                                        >
                                            Sin asignar
                                        </button>
                                        {agents.map(agent => (
                                            <button
                                                key={agent.id}
                                                onClick={() => doAssign(agent.id)}
                                                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 last:rounded-b-lg flex items-center gap-2
                                                    ${(conv as any).assigned_agent_id === agent.id ? 'text-blue-600 bg-blue-50' : 'text-slate-700'}`}
                                            >
                                                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                                                    {agent.name[0]?.toUpperCase()}
                                                </div>
                                                <span className="flex-1 truncate">{agent.name}</span>
                                                {(conv as any).assigned_agent_id === agent.id && <Check className="w-3 h-3 text-blue-600 shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Take over from bot — only visible when bot is handling */}
                            {(conv as any).handled_by === 'bot' && (
                                <button
                                    onClick={doTakeover}
                                    disabled={actionLoading === 'takeover'}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-60"
                                >
                                    {actionLoading === 'takeover' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                                    Tomar control
                                </button>
                            )}

                            {/* Importance */}
                            <button
                                onClick={toggleStar}
                                className={`p-1.5 rounded-lg border transition-colors ${(conv as any).is_starred ? 'bg-amber-50 border-amber-200 text-amber-500' : 'hover:bg-slate-50'}`}
                            >
                                <Star className={`w-4 h-4 ${(conv as any).is_starred ? 'fill-amber-500' : ''}`} />
                            </button>

                            {/* Archive */}
                            <button
                                onClick={toggleArchive}
                                className="p-1.5 rounded-lg border hover:bg-slate-50 transition-colors"
                                title="Archivar"
                            >
                                <Archive className="w-4 h-4 text-slate-500" />
                            </button>

                            {/* Mark Read */}
                            <button
                                onClick={markRead}
                                className="p-1.5 rounded-lg border hover:bg-slate-50 transition-colors"
                                title="Marcar como leído"
                            >
                                <MailCheck className="w-4 h-4 text-slate-500" />
                            </button>

                            <div className="w-px h-6 bg-slate-200 mx-1" />

                            {/* Agenda */}
                            <button
                                onClick={() => setShowEventModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                Agenda
                            </button>

                            {/* Resolve */}
                            <button
                                onClick={() => doStatusChange('resolved')}
                                disabled={!!actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-60"
                            >
                                {actionLoading === 'resolved' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                Resolver
                            </button>
                        </div>
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50">
                    {loadingMsgs && (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        </div>
                    )}
                    {!loadingMsgs && !selected && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                            <MessageCircle className="w-12 h-12" />
                            <p>Selecciona una conversación</p>
                        </div>
                    )}
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm shadow-sm
                                ${msg.direction === 'outbound'
                                    ? 'bg-blue-600 text-white rounded-br-sm'
                                    : 'bg-white border text-slate-800 rounded-bl-sm'}`}>
                                <p>{msg.content}</p>
                                <div className={`flex items-center gap-1 mt-1 text-xs ${msg.direction === 'outbound' ? 'text-blue-200 justify-end' : 'text-slate-400'}`}>
                                    <span>{new Date(msg.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                                    {msg.handled_by === 'bot' && <><Bot className="w-3 h-3" /><span>Bot</span></>}
                                    {msg.handled_by === 'human' && <><User className="w-3 h-3" /><span>Agente</span></>}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                {/* Compose */}
                {selected && (
                    <div className="px-4 py-3 border-t bg-white shrink-0">
                        <div className="flex items-center gap-2">
                            {/* Action Toolbar */}
                            <div className="flex items-center gap-1.5 border-r pr-2 mr-1 relative">
                                <button
                                    onClick={() => setShowAI(!showAI)}
                                    className={`p-2 rounded-lg transition-colors ${showAI ? 'bg-purple-600 text-white' : 'text-purple-600 hover:bg-purple-50'}`}
                                    title="AI Writer"
                                >
                                    <Sparkles className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                                    className={`p-2 rounded-lg transition-colors ${showQuickReplies ? 'bg-amber-500 text-white' : 'text-amber-600 hover:bg-amber-50'}`}
                                    title="Respuestas Rápidas"
                                >
                                    <Zap className="w-4 h-4" />
                                </button>

                                {showQuickReplies && (
                                    <QuickRepliesPanel
                                        onSelect={onSelectQuickReply}
                                        onClose={() => setShowQuickReplies(false)}
                                    />
                                )}

                                <button
                                    onClick={() => setShowCatalog(!showCatalog)}
                                    className={`p-2 rounded-lg transition-colors ${showCatalog ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-50'}`}
                                    title="Catálogo de Productos"
                                >
                                    <Lucide.ShoppingBag className="w-4 h-4" />
                                </button>

                                {showCatalog && selected && (
                                    <CatalogPanel
                                        conversationId={selected}
                                        onSendCartLink={(text) => {
                                            setInput(text);
                                            setShowCatalog(false);
                                        }}
                                        onClose={() => setShowCatalog(false)}
                                    />
                                )}

                                <button
                                    onClick={() => setShowEventModal(true)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Agendar Evento"
                                >
                                    <Calendar className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setShowScheduleModal(true)}
                                    className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                                    title="Programar Mensaje"
                                >
                                    <Clock className="w-4 h-4" />
                                </button>
                            </div>

                            <input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                                placeholder="Escribe un mensaje..."
                                className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <button
                                onClick={send}
                                disabled={sending}
                                className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
                            >
                                {sending
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Send className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Column 3: Customer Panel ── */}
            {selected && <CustomerPanel conversationId={selected} />}

            {/* ── Overlays ── */}
            {selected && showAI && (
                <AIWriterPanel
                    conversationId={selected}
                    draft={input}
                    onUse={(s) => { setInput(s); setShowAI(false); }}
                    onClose={() => setShowAI(false)}
                />
            )}

            {showEventModal && (
                <EventModal
                    customerId={conv?.customer_id}
                    conversationId={selected || undefined}
                    onClose={() => setShowEventModal(false)}
                    onSuccess={() => { /* maybe show a toast or message */ }}
                />
            )}

            {showScheduleModal && selected && (
                <ScheduleMessageModal
                    conversationId={selected}
                    initialContent={input}
                    onClose={() => setShowScheduleModal(false)}
                    onSuccess={() => { setInput(''); /* maybe refresh scheduled list */ }}
                />
            )}

        </div>
    );
}
