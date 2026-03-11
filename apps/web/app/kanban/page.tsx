"use client";
import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
const { MessageSquare, User, Clock, Bot, ChevronRight, X, Loader2, Send, Filter, Users, RefreshCw, AlertCircle } = Lucide as any;

import { apiFetch } from '../../hooks/useAuth';

type Status = 'open' | 'pending' | 'resolved' | 'snoozed';

interface Conversation {
    id: string;
    customer_name: string;
    channel_provider: 'whatsapp' | 'facebook' | 'instagram';
    last_message: string;
    last_message_at: string;
    agent_name: string | null;
    unread_count: number;
    handled_by: 'bot' | 'human' | null;
    status: Status; // Legacy status
    pipeline_id?: string;
    pipeline_stage_id?: string;
    is_stagnant?: boolean;
}

// Keeping legacy fallback colors if needed
const DEFAULT_COLOR = 'border-slate-400';
const DEFAULT_BG = 'bg-slate-400';

const PROVIDER_BADGE: Record<string, { label: string; bg: string }> = {
    whatsapp: { label: 'WhatsApp', bg: 'bg-green-100 text-green-700' },
    facebook: { label: 'Facebook', bg: 'bg-blue-100 text-blue-700' },
    instagram: { label: 'Instagram', bg: 'bg-pink-100 text-pink-700' },
};

function BulkSendModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [label, setLabel] = useState('');
    const [channelId, setChannelId] = useState('');
    const [channels, setChannels] = useState<any[]>([]);
    const [sending, setSending] = useState(false);
    const [step, setStep] = useState(1);
    const [recipientCount, setRecipientCount] = useState<number | null>(null);

    useEffect(() => {
        const fetchChannels = async () => {
            try {
                const res = await apiFetch('/api/channels');
                const data = await res.json();
                setChannels(data.filter((c: any) => c.is_active));
                if (data.length > 0) setChannelId(data[0].id);
            } catch (e) {
                console.error(e);
            }
        };
        fetchChannels();
    }, []);

    const checkRecipients = async () => {
        if (!label || !channelId) return;
        setSending(true);
        try {
            // Updated preview logic: count customers with given label and on given channel
            const res = await apiFetch(`/api/customers?limit=1&label=${encodeURIComponent(label)}&channel_id=${channelId}`);
            const data = await res.json();
            setRecipientCount(data.total);
            setStep(2);
        } catch (e) {
            console.error(e);
        } finally {
            setSending(false);
        }
    };

    const handleSend = async () => {
        setSending(true);
        try {
            const res = await apiFetch('/api/bulk-campaigns', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    message_content: message,
                    channel_id: channelId,
                    filter_criteria: { label }
                })
            });
            const campaign = await res.json();

            // Start it immediately
            await apiFetch(`/api/bulk-campaigns/${campaign.id}/start`, { method: 'POST' });

            onSent();
        } catch (e) {
            console.error(e);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="font-bold text-lg text-slate-800">Campaña Masiva (Outbound)</h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 space-y-4">
                    {step === 1 ? (
                        <>
                            <p className="text-sm text-slate-600">Paso 1: Define los destinatarios y el canal de salida.</p>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre de la campaña</label>
                                <input value={name} onChange={e => setName(e.target.value)} placeholder="ej: Seguimiento Promo" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Canal</label>
                                <select value={channelId} onChange={e => setChannelId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                                    {channels.map(c => <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Etiqueta del Lead</label>
                                <div className="relative">
                                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input value={label} onChange={e => setLabel(e.target.value)} placeholder="ej: Nuevo Cliente" className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-slate-50" />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                                <Users className="w-5 h-5 text-blue-600" />
                                <div>
                                    <p className="text-sm font-bold text-blue-800">{recipientCount} leads encontrados</p>
                                    <p className="text-xs text-blue-600">Para el canal seleccionado con etiqueta "{label}"</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mensaje de Salida</label>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    rows={5}
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="Hola, te escribimos para..."
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Usa {"{{name}}"} para personalizar.</p>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex gap-3 p-6 border-t bg-slate-50">
                    {step === 1 ? (
                        <button
                            onClick={checkRecipients}
                            disabled={!name || !label || sending}
                            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                            Siguiente
                        </button>
                    ) : (
                        <>
                            <button onClick={() => setStep(1)} className="px-6 py-2.5 rounded-lg border bg-white text-slate-600 hover:bg-slate-50 font-bold">Atrás</button>
                            <button
                                onClick={handleSend}
                                disabled={!message || sending}
                                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Lanzar Campaña
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function KanbanPage() {
    const [pipelines, setPipelines] = useState<any[]>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dragging, setDragging] = useState<string | null>(null);
    const [showBulk, setShowBulk] = useState(false);

    const fetchPipelines = async () => {
        try {
            const res = await apiFetch('/api/pipelines');
            const data = await res.json();
            setPipelines(data);
            if (data.length > 0) {
                // If there's a LEADS pipeline, select it, else the first one
                const leads = data.find((p: any) => p.name === 'LEADS');
                setSelectedPipelineId(leads ? leads.id : data[0].id);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchConvs = async () => {
        if (!selectedPipelineId) return;
        setLoading(true);
        try {
            const res = await apiFetch(`/api/conversations?limit=200&pipeline_id=${selectedPipelineId}`);
            const data = await res.json();
            setConversations(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPipelines();
    }, []);

    useEffect(() => {
        if (selectedPipelineId) {
            fetchConvs();
        }
    }, [selectedPipelineId]);

    const moveCard = async (id: string, newStageId: string) => {
        if (!selectedPipelineId) return;
        // Optimistic update
        setConversations(prev => prev.map(c => c.id === id ? { ...c, pipeline_stage_id: newStageId } : c));
        try {
            await apiFetch(`/api/conversations/${id}/stage`, {
                method: 'PATCH',
                body: JSON.stringify({ pipeline_id: selectedPipelineId, pipeline_stage_id: newStageId }),
            });
        } catch (err) {
            console.error(err);
            fetchConvs(); // Revert on error
        }
    };

    const onDragOver = (e: React.DragEvent) => e.preventDefault();

    const onDrop = (e: React.DragEvent, stageId: string) => {
        e.preventDefault();
        if (dragging) moveCard(dragging, stageId);
        setDragging(null);
    };

    const currentPipeline = pipelines.find(p => p.id === selectedPipelineId);
    const stages = currentPipeline?.stages || [];

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-800">Pipeline</h1>
                        <select
                            value={selectedPipelineId || ''}
                            onChange={(e) => setSelectedPipelineId(e.target.value)}
                            className="bg-white border rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20"
                        >
                            {pipelines.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <p className="text-slate-500 text-sm mt-1">{currentPipeline?.description || 'Arrastra las tarjetas para cambiar el estado'}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            setLoading(true);
                            try {
                                await apiFetch('/api/pipelines/sync-woocommerce', { method: 'POST' });
                                await fetchPipelines();
                            } catch (e) {
                                console.error(e);
                            } finally {
                                setLoading(false);
                            }
                        }}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sincronizar WC
                    </button>
                    <button
                        onClick={() => setShowBulk(true)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                    >
                        <Send className="w-4 h-4" /> Envío Masivo
                    </button>
                </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
                {!currentPipeline ? (
                    <div className="flex items-center justify-center w-full h-full text-slate-400">Cargando embudo...</div>
                ) : stages.length === 0 ? (
                    <div className="flex items-center justify-center w-full h-full text-slate-400">Este embudo aún no tiene etapas configuradas.</div>
                ) : stages.map((stage: any) => {
                    const cards = conversations.filter(c => c.pipeline_stage_id === stage.id);
                    return (
                        <div
                            key={stage.id}
                            className={`flex flex-col w-80 shrink-0 bg-slate-100/50 rounded-xl border-t-4 border shadow-sm`}
                            style={{ borderTopColor: stage.color || '#e2e8f0' }}
                            onDragOver={onDragOver}
                            onDrop={e => onDrop(e, stage.id)}
                        >
                            <div className="px-4 py-3 flex items-center justify-between bg-white/50 border-b">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color || '#94a3b8' }} />
                                    <span className="font-bold text-slate-700 text-xs uppercase tracking-wider">{stage.name}</span>
                                </div>
                                <span className="text-[10px] bg-white border rounded-full px-2 py-0.5 text-slate-500 font-bold">
                                    {cards.length}
                                </span>
                            </div>

                            <div className="flex flex-col gap-3 px-3 py-3 overflow-y-auto flex-1">
                                {cards.map(card => (
                                    <KanbanCard
                                        key={card.id}
                                        card={card}
                                        onDragStart={() => setDragging(card.id)}
                                        onDragEnd={() => setDragging(null)}
                                    />
                                ))}
                                {cards.length === 0 && (
                                    <div className="text-center py-12 text-slate-400 text-xs italic">
                                        Sin conversaciones
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {showBulk && <BulkSendModal onClose={() => setShowBulk(false)} onSent={() => { setShowBulk(false); fetchConvs(); }} />}
        </div>
    );
}

function KanbanCard({ card, onDragStart, onDragEnd }: { card: any; onDragStart: () => void; onDragEnd: () => void }) {
    const badge = PROVIDER_BADGE[card.channel_provider] || PROVIDER_BADGE.whatsapp;

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => window.location.href = `/inbox?c=${card.id}`}
            className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-200 transition-all group"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 border border-blue-100">
                        {card.customer_name?.[0] || '?'}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-slate-800 leading-tight truncate">{card.customer_name}</p>
                            {card.is_stagnant && <Lucide.AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter ${badge.bg}`}>
                                {badge.label}
                            </span>
                            {card.is_stagnant && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter bg-red-100 text-red-700 animate-pulse">
                                    Estancado
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {card.unread_count > 0 && (
                    <span className="bg-blue-600 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0 shadow-md shadow-blue-100">
                        {card.unread_count}
                    </span>
                )}
            </div>

            <p className="text-xs text-slate-500 line-clamp-2 mb-4 h-8">{card.last_message}</p>

            <div className="flex items-center justify-between text-[10px] font-medium border-t pt-3">
                <div className="flex items-center gap-1.5 text-slate-400 overflow-hidden">
                    {card.handled_by === 'bot'
                        ? <><Bot className="w-3 h-3 text-purple-500" /><span className="text-purple-600 font-bold">BOT</span></>
                        : card.agent_name
                            ? <><User className="w-3 h-3" /><span className="truncate">{card.agent_name}</span></>
                            : <><MessageSquare className="w-3 h-3" /><span>Sin asignar</span></>
                    }
                </div>
                <div className="flex items-center gap-1 text-slate-400 shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(card.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        </div>
    );
}
