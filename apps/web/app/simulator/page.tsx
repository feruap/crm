"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Lucide from 'lucide-react';
const {
    Send, User, ExternalLink, Bot, Loader2, Plus,
    FlaskConical, ChevronRight, RefreshCw,
    Wifi, WifiOff, Sparkles, Zap,
} = Lucide as any;

import { useAuth } from '../../components/AuthProvider';
import { useSocket } from '../../hooks/useSocket';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Channel {
    id: string;
    name: string;
    provider: string;
    subtype: string | null;
    is_active: boolean;
}

interface SimMessage {
    id: string;
    direction: 'inbound' | 'outbound';
    content: string;
    message_type: string;
    handled_by: 'bot' | 'human' | null;
    created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PROVIDER_EMOJI: Record<string, string> = {
    whatsapp: '📱', facebook: '🔵', instagram: '🩷', tiktok: '⚫',
};

const PROVIDER_COLOR: Record<string, string> = {
    whatsapp: 'bg-green-500',
    facebook: 'bg-blue-500',
    instagram: 'bg-pink-500',
    tiktok: 'bg-slate-700',
};

const SUBTYPE_LABELS: Record<string, string> = {
    messenger: 'Messenger DM',
    feed: 'Feed Comments',
    chat: 'IG Direct',
    comments: 'IG Comments',
};

const QUICK_MESSAGES = [
    'Hola, buenas tardes 👋',
    '¿Cuánto cuestan las pruebas de influenza?',
    'Me interesa una cotización formal',
    '¿Hacen envíos a toda la república?',
    '¿Cuáles son sus horarios de atención?',
    'Somos una farmacia, ¿tienen precios por volumen?',
    '¿Las pruebas están certificadas?',
    '¿Aceptan pago con tarjeta?',
    '¿Cómo funciona la prueba de influenza A y B?',
    'Quiero 20 pruebas de influenza, ¿cuánto sería?',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function generatePhone() {
    const ts = Date.now().toString().slice(-6);
    return `+52sim${ts}`;
}

// ── Page Component ────────────────────────────────────────────────────────────
export default function SimulatorPage() {
    const { authFetch } = useAuth();
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState('');
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [customerName, setCustomerName] = useState('Cliente Test');
    const [customerPhone, setCustomerPhone] = useState('+521234567890');
    const [messages, setMessages] = useState<SimMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingChannels, setLoadingChannels] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [creatingChannel, setCreatingChannel] = useState(false);
    const [error, setError] = useState('');
    const [connected, setConnected] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { joinConversation, leaveConversation, onNewMessage } = useSocket();

    // ── Load active channels + restore previous session ──────────────────────
    useEffect(() => {
        (async () => {
            try {
                const r = await authFetch(`${API_URL}/api/channels`);
                const data: Channel[] = await r.json();
                const active = data.filter(c => c.is_active);

                if (active.length > 0) {
                    setChannels(active);
                    setSelectedChannelId(active[0].id);
                } else {
                    const cr = await authFetch(`${API_URL}/api/channels`, {
                        method: 'POST',
                        body: JSON.stringify({
                            name: 'WhatsApp Demo',
                            provider: 'whatsapp',
                            provider_config: { phone_number_id: 'demo' },
                            sync_comments: false,
                        }),
                    });
                    const ch: Channel = await cr.json();
                    setChannels([ch]);
                    setSelectedChannelId(ch.id);
                }

                // Fetch campaigns
                const cmpR = await authFetch(`${API_URL}/api/campaigns`);
                const cmpData = await cmpR.json();
                setCampaigns(cmpData);

                // ── Restore previous simulator session ──────────────────────
                try {
                    const sessionRes = await authFetch(`${API_URL}/api/simulator/session`);
                    const session = await sessionRes.json();
                    if (session && session.conversation_id) {
                        if (session.channel_id) setSelectedChannelId(session.channel_id);
                        if (session.customer_name) setCustomerName(session.customer_name);
                        if (session.customer_phone) setCustomerPhone(session.customer_phone);
                        if (session.campaign_id) setSelectedCampaignId(session.campaign_id);
                        setConversationId(session.conversation_id);
                        // Load message history
                        const msgRes = await authFetch(`${API_URL}/api/simulator/messages/${session.conversation_id}`);
                        const msgData = await msgRes.json();
                        setMessages(msgData);
                    }
                } catch {
                    // No previous session — that's fine
                }

                setConnected(true);
            } catch {
                setError('No se pudo conectar al servidor');
            } finally {
                setLoadingChannels(false);
            }
        })();
    }, [authFetch]);

    // ── Subscribe to outbound (agent) messages in real time ──────────────────
    useEffect(() => {
        if (!conversationId) return;
        joinConversation(conversationId);

        const off = onNewMessage((msg: SimMessage) => {
            // Only add outbound messages (agent/bot replies) — inbound we insert directly
            if (msg.direction === 'outbound') {
                setMessages(prev =>
                    prev.find(m => m.id === msg.id) ? prev : [...prev, msg]
                );
            }
        });

        return () => {
            leaveConversation(conversationId);
            off();
        };
    }, [conversationId, joinConversation, leaveConversation, onNewMessage]);

    // ── Auto-scroll on new messages ───────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Create a demo WhatsApp channel so the simulator works out-of-the-box ──
    const createTestChannel = useCallback(async () => {
        setCreatingChannel(true);
        setError('');
        try {
            const r = await authFetch(`${API_URL}/api/channels`, {
                method: 'POST',
                body: JSON.stringify({
                    name: 'WhatsApp Demo',
                    provider: 'whatsapp',
                    provider_config: { phone_number_id: 'demo_' + Date.now() },
                    sync_comments: false,
                }),
            });
            const ch = await r.json();
            setChannels([ch]);
            setSelectedChannelId(ch.id);
            setConnected(true);
        } catch (e: any) {
            setError('No se pudo crear el canal: ' + e.message);
        } finally {
            setCreatingChannel(false);
        }
    }, [authFetch]);

    // ── Load full message history for a conversation ──────────────────────────
    const loadMessages = useCallback(async (convId: string) => {
        setLoadingHistory(true);
        try {
            const r = await authFetch(`${API_URL}/api/simulator/messages/${convId}`);
            const data = await r.json();
            setMessages(data);
        } finally {
            setLoadingHistory(false);
        }
    }, [authFetch]);

    // ── Send a message ────────────────────────────────────────────────────────
    const sendMessage = useCallback(async (quickText?: string) => {
        const text = (quickText ?? input).trim();
        if (!text || !selectedChannelId || sending) return;

        setSending(true);
        if (!quickText) setInput('');
        setError('');

        try {
            const r = await authFetch(`${API_URL}/api/simulator/message`, {
                method: 'POST',
                body: JSON.stringify({
                    channel_id: selectedChannelId,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    content: text,
                    campaign_id: selectedCampaignId || undefined,
                }),
            });
            const data = await r.json();

            if (!conversationId || data.conversation_id !== conversationId) {
                // New conversation started — load full history
                setConversationId(data.conversation_id);
                await loadMessages(data.conversation_id);
                // Persist session so it survives page navigation
                authFetch(`${API_URL}/api/simulator/session`, {
                    method: 'POST',
                    body: JSON.stringify({
                        conversation_id: data.conversation_id,
                        channel_id: selectedChannelId,
                        customer_name: customerName,
                        customer_phone: customerPhone,
                        campaign_id: selectedCampaignId || null,
                    }),
                }).catch(() => {});
            } else {
                // Continue existing conversation — append inbound message
                setMessages(prev =>
                    prev.find(m => m.id === data.message.id)
                        ? prev
                        : [...prev, data.message]
                );
            }
        } catch (e: any) {
            setError(e.message || 'Error al enviar mensaje');
        } finally {
            setSending(false);
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    }, [input, selectedChannelId, selectedCampaignId, sending, customerName, customerPhone, conversationId, loadMessages, authFetch]);

    // ── Keyboard: Enter sends, Shift+Enter = new line ─────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // ── Start a brand-new conversation (fresh phone number) ───────────────────
    const startNewConversation = () => {
        if (conversationId) leaveConversation(conversationId);
        setConversationId(null);
        setMessages([]);
        setCustomerPhone(generatePhone());
        // Clear persisted session
        authFetch(`${API_URL}/api/simulator/session`, { method: 'DELETE' }).catch(() => {});
    };

    // ── Reload message history ────────────────────────────────────────────────
    const reloadHistory = () => {
        if (conversationId) loadMessages(conversationId);
    };

    const selectedChannel = channels.find(c => c.id === selectedChannelId);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen bg-slate-50">

            {/* ── Top header bar ─────────────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                        <FlaskConical className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-slate-800">Simulador de Cliente</h1>
                        <p className="text-xs text-slate-400">
                            Prueba el CRM sin conexiones reales · mensajes en tiempo real
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Connection indicator */}
                    <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${connected ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'}`}>
                        {connected
                            ? <><Wifi className="w-3 h-3" /> Conectado</>
                            : <><WifiOff className="w-3 h-3" /> Sin servidor</>
                        }
                    </div>

                    {/* Open in Inbox */}
                    {conversationId && (
                        <Link
                            href="/inbox"
                            className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Ver en Inbox
                        </Link>
                    )}
                </div>
            </div>

            {/* ── Main two-column layout ─────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ─── Left config panel ──────────────────────────────────── */}
                <div className="w-72 bg-white border-r border-slate-200 flex flex-col overflow-y-auto shrink-0">

                    {/* Config ------------------------------------------------ */}
                    <div className="p-5 border-b border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">
                            Configuración del Cliente
                        </p>

                        {/* Channel selector */}
                        <div className="mb-4">
                            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                                Canal de entrada
                            </label>
                            {loadingChannels ? (
                                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando canales…
                                </div>
                            ) : channels.length === 0 ? (
                                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-2">
                                    <p className="text-xs font-bold text-violet-800">Sin canales activos</p>
                                    <p className="text-xs text-violet-700 leading-snug">
                                        Crea un canal demo para empezar a simular al instante, o configura uno real en{' '}
                                        <Link href="/settings" className="underline font-semibold">Configuración</Link>.
                                    </p>
                                    <button
                                        onClick={createTestChannel}
                                        disabled={creatingChannel}
                                        className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                                    >
                                        {creatingChannel
                                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creando…</>
                                            : <><Zap className="w-3.5 h-3.5" /> Crear canal WhatsApp Demo</>
                                        }
                                    </button>
                                </div>
                            ) : (
                                <select
                                    value={selectedChannelId}
                                    onChange={e => setSelectedChannelId(e.target.value)}
                                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 text-slate-800"
                                >
                                    {channels.map(ch => (
                                        <option key={ch.id} value={ch.id}>
                                            {PROVIDER_EMOJI[ch.provider] ?? '📡'} {ch.name}
                                            {ch.subtype ? ` · ${SUBTYPE_LABELS[ch.subtype] ?? ch.subtype}` : ''}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {/* Channel badge */}
                            {selectedChannel && (
                                <div className="flex items-center gap-1.5 mt-2">
                                    <span className={`w-2 h-2 rounded-full ${PROVIDER_COLOR[selectedChannel.provider] ?? 'bg-slate-400'}`} />
                                    <span className="text-[10px] text-slate-500 capitalize">
                                        {selectedChannel.provider}
                                        {selectedChannel.subtype ? ` — ${SUBTYPE_LABELS[selectedChannel.subtype] ?? selectedChannel.subtype}` : ''}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Campaign selector */}
                        <div className="mb-4">
                            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                                Campaña de origen / Atribución
                            </label>
                            <select
                                value={selectedCampaignId}
                                onChange={e => setSelectedCampaignId(e.target.value)}
                                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 text-slate-800"
                            >
                                <option value="">Ninguna / Directo</option>
                                {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Customer name */}
                        <div className="mb-4">
                            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                                Nombre del cliente
                            </label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                placeholder="Cliente Test"
                            />
                        </div>

                        {/* Customer phone */}
                        <div className="mb-5">
                            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                                Teléfono / ID del cliente
                            </label>
                            <input
                                type="text"
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                placeholder="+521234567890"
                            />
                            <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                                Mismo teléfono = continúa la conversación existente
                            </p>
                        </div>

                        {/* New conversation button */}
                        <button
                            onClick={startNewConversation}
                            className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-violet-600 hover:bg-violet-50 border border-violet-200 hover:border-violet-300 px-3 py-2.5 rounded-xl transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva conversación (nuevo cliente)
                        </button>
                    </div>

                    {/* Quick messages ---------------------------------------- */}
                    <div className="p-5 border-b border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                            Mensajes Rápidos
                        </p>
                        <div className="space-y-1">
                            {QUICK_MESSAGES.map((msg, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(msg)}
                                    disabled={!selectedChannelId || sending}
                                    title={msg}
                                    className="w-full text-left text-xs text-slate-600 hover:text-violet-700 hover:bg-violet-50 px-3 py-2 rounded-lg transition-colors border border-transparent hover:border-violet-100 disabled:opacity-40 truncate"
                                >
                                    <ChevronRight className="w-3 h-3 inline-block mr-1 opacity-40 shrink-0" />
                                    {msg}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Active conversation info ------------------------------- */}
                    {conversationId && (
                        <div className="p-5 border-b border-slate-100">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    Conversación activa
                                </p>
                                <button
                                    onClick={reloadHistory}
                                    disabled={loadingHistory}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Recargar historial"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                                <p className="text-[10px] text-slate-400 mb-0.5 font-medium">ID de conversación</p>
                                <p className="text-[10px] font-mono text-violet-700 break-all leading-relaxed">
                                    {conversationId}
                                </p>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">
                                {messages.filter(m => m.direction === 'inbound').length} mensajes enviados ·{' '}
                                {messages.filter(m => m.direction === 'outbound').length} respuestas recibidas
                            </p>
                        </div>
                    )}

                    {/* Legend ----------------------------------------------- */}
                    <div className="p-5 mt-auto">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Leyenda</p>
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2.5">
                                <div className="w-3 h-3 rounded-full bg-violet-500 shrink-0" />
                                <span className="text-xs text-slate-500">Tú — cliente simulado</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                                <span className="text-xs text-slate-500">Agente humano</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-3 h-3 rounded-full bg-slate-300 shrink-0" />
                                <span className="text-xs text-slate-500">Bot / IA</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Right chat panel ────────────────────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0">

                    {/* Chat header */}
                    <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 shrink-0">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                            <User className="w-4.5 h-4.5 text-violet-600" />
                        </div>

                        {/* Identity */}
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-800 truncate">
                                {customerName || 'Cliente Test'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                                {customerPhone}
                                {selectedChannel && (
                                    <>
                                        {' · '}
                                        {PROVIDER_EMOJI[selectedChannel.provider] ?? '📡'}{' '}
                                        <span className="font-medium text-slate-600">{selectedChannel.name}</span>
                                        {selectedChannel.subtype &&
                                            ` (${SUBTYPE_LABELS[selectedChannel.subtype] ?? selectedChannel.subtype})`
                                        }
                                    </>
                                )}
                            </p>
                        </div>

                        {/* Provider badge */}
                        {selectedChannel && (
                            <span className={`shrink-0 text-[10px] font-bold text-white px-2.5 py-1 rounded-full uppercase tracking-wider ${PROVIDER_COLOR[selectedChannel.provider] ?? 'bg-slate-500'}`}>
                                {selectedChannel.provider}
                            </span>
                        )}
                    </div>

                    {/* ── Messages area ──────────────────────────────────────── */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3 bg-slate-50">

                        {/* Loading history skeleton */}
                        {loadingHistory && (
                            <div className="flex items-center justify-center py-8 gap-2 text-sm text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin" /> Cargando historial…
                            </div>
                        )}

                        {/* Empty state */}
                        {!loadingHistory && messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12">
                                <div className="w-20 h-20 bg-violet-50 rounded-3xl flex items-center justify-center mb-5 shadow-inner">
                                    <FlaskConical className="w-10 h-10 text-violet-300" />
                                </div>
                                <h3 className="text-base font-bold text-slate-700 mb-2">
                                    Listo para simular
                                </h3>
                                <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                                    Escribe un mensaje o usa los atajos de la izquierda para simular un cliente real contactando tu negocio.
                                </p>
                                <div className="mt-5 bg-white border border-slate-200 rounded-xl px-5 py-3 text-xs text-slate-500 text-left max-w-xs space-y-1.5 shadow-sm">
                                    <div className="flex items-start gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                                        <span>Los mensajes aparecen al instante en el <Link href="/inbox" className="text-blue-500 font-semibold hover:underline">Inbox</Link> del agente</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                                        <span>Las respuestas del agente aparecen aquí en tiempo real</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                                        <span>Mismo teléfono = misma conversación</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Message bubbles */}
                        {!loadingHistory && messages.map((msg, idx) => {
                            const isInbound = msg.direction === 'inbound';
                            const isBot = msg.handled_by === 'bot';
                            const prevMsg = idx > 0 ? messages[idx - 1] : null;
                            const showAvatar = !prevMsg || prevMsg.direction !== msg.direction;

                            return (
                                <div
                                    key={msg.id}
                                    className={`flex items-end gap-2 ${isInbound ? 'justify-end' : 'justify-start'}`}
                                >
                                    {/* Left avatar (outbound — agent/bot) */}
                                    {!isInbound && (
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-opacity ${showAvatar ? 'opacity-100' : 'opacity-0'} ${isBot ? 'bg-slate-200' : 'bg-blue-100'}`}>
                                            {isBot
                                                ? <Bot className="w-3.5 h-3.5 text-slate-500" />
                                                : <User className="w-3.5 h-3.5 text-blue-600" />
                                            }
                                        </div>
                                    )}

                                    {/* Bubble + meta */}
                                    <div className="max-w-[70%] flex flex-col">
                                        {/* Sender label (show on first in group) */}
                                        {showAvatar && !isInbound && (
                                            <span className="text-[10px] text-slate-400 mb-1 ml-1">
                                                {isBot ? '🤖 Bot' : '👤 Agente'}
                                            </span>
                                        )}

                                        {/* Bubble */}
                                        <div
                                            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${isInbound
                                                ? 'bg-violet-600 text-white rounded-br-sm'
                                                : isBot
                                                    ? 'bg-white text-slate-700 rounded-bl-sm border border-slate-200'
                                                    : 'bg-blue-500 text-white rounded-bl-sm'
                                                }`}
                                        >
                                            {msg.content}
                                        </div>

                                        {/* Timestamp */}
                                        <div className={`flex items-center gap-1 mt-0.5 ${isInbound ? 'justify-end' : 'justify-start'}`}>
                                            {isInbound && (
                                                <span className="text-[10px] text-violet-400 font-medium">Tú</span>
                                            )}
                                            <span className="text-[10px] text-slate-400">
                                                {formatTime(msg.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right avatar (inbound — simulated customer) */}
                                    {isInbound && (
                                        <div className={`w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 transition-opacity ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                                            <User className="w-3.5 h-3.5 text-violet-600" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Sending indicator */}
                        {sending && (
                            <div className="flex justify-end items-end gap-2">
                                <div className="max-w-[70%]">
                                    <div className="bg-violet-400 text-white px-4 py-2.5 rounded-2xl rounded-br-sm text-sm flex items-center gap-2 opacity-70">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Enviando…
                                    </div>
                                </div>
                                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                                    <User className="w-3.5 h-3.5 text-violet-600" />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* ── Error bar ──────────────────────────────────────────── */}
                    {error && (
                        <div className="bg-red-50 border-t border-red-200 px-6 py-2.5 text-xs text-red-600 flex items-center gap-2 shrink-0">
                            <span className="font-bold">⚠</span> {error}
                            <button
                                onClick={() => setError('')}
                                className="ml-auto text-red-400 hover:text-red-600"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* ── Input area ─────────────────────────────────────────── */}
                    <div className="bg-white border-t border-slate-200 px-6 py-4 shrink-0">
                        <div className="flex items-end gap-3">
                            <div className="flex-1">
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={
                                        channels.length === 0
                                            ? 'Primero configura un canal activo en Configuración…'
                                            : 'Escribe como cliente… (Enter envía · Shift+Enter = nueva línea)'
                                    }
                                    disabled={channels.length === 0 || sending}
                                    rows={2}
                                    className="w-full resize-none border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-slate-50 disabled:opacity-50 leading-relaxed"
                                />
                            </div>
                            <button
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || !selectedChannelId || sending}
                                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm"
                            >
                                {sending
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Send className="w-4 h-4" />
                                }
                                <span className="hidden sm:inline">
                                    {sending ? 'Enviando' : 'Enviar'}
                                </span>
                            </button>
                        </div>

                        <p className="text-[10px] text-slate-400 mt-2 text-center">
                            Mensajes aparecen en el{' '}
                            <Link href="/inbox" className="text-blue-500 hover:underline font-medium">
                                Inbox del agente
                            </Link>{' '}
                            en tiempo real vía Socket.io
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
