"use client";
import React, { useState } from 'react';
import { MessageSquare, User, Clock, Bot, ChevronRight } from 'lucide-react';

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
    status: Status;
}

// ── Mock data — replace with fetch('/api/conversations') ──────────────────────
const MOCK: Conversation[] = [
    { id: '1', customer_name: 'Ana García',    channel_provider: 'whatsapp',  last_message: '¿Tienen envío gratis?',           last_message_at: '10:32', agent_name: null,          unread_count: 3, handled_by: 'bot',   status: 'open'     },
    { id: '2', customer_name: 'Luis Torres',   channel_provider: 'instagram', last_message: 'Quiero cambiar mi pedido',        last_message_at: '10:15', agent_name: 'María López', unread_count: 1, handled_by: 'human', status: 'open'     },
    { id: '3', customer_name: 'Sofía Ruiz',    channel_provider: 'facebook',  last_message: 'Gracias, ya llegó mi paquete',   last_message_at: '09:50', agent_name: 'Carlos R.',   unread_count: 0, handled_by: 'human', status: 'pending'  },
    { id: '4', customer_name: 'Jorge Medina',  channel_provider: 'whatsapp',  last_message: '¿Cuándo llega mi orden #4521?',  last_message_at: '09:20', agent_name: null,          unread_count: 2, handled_by: 'bot',   status: 'open'     },
    { id: '5', customer_name: 'Carmen Vidal',  channel_provider: 'instagram', last_message: 'Problema con mi pago',           last_message_at: 'Ayer',  agent_name: 'María López', unread_count: 0, handled_by: 'human', status: 'snoozed'  },
    { id: '6', customer_name: 'Roberto Díaz',  channel_provider: 'whatsapp',  last_message: 'Todo resuelto, gracias',         last_message_at: 'Ayer',  agent_name: 'Carlos R.',   unread_count: 0, handled_by: 'human', status: 'resolved' },
];

const COLUMNS: { status: Status; label: string; color: string; dot: string }[] = [
    { status: 'open',     label: 'Nuevos / Abiertos', color: 'border-blue-400',   dot: 'bg-blue-400'   },
    { status: 'pending',  label: 'En espera',          color: 'border-yellow-400', dot: 'bg-yellow-400' },
    { status: 'snoozed',  label: 'Pospuestos',         color: 'border-purple-400', dot: 'bg-purple-400' },
    { status: 'resolved', label: 'Resueltos',          color: 'border-green-400',  dot: 'bg-green-400'  },
];

const PROVIDER_BADGE: Record<string, { label: string; bg: string }> = {
    whatsapp: { label: 'WhatsApp', bg: 'bg-green-100 text-green-700'   },
    facebook: { label: 'Facebook', bg: 'bg-blue-100 text-blue-700'     },
    instagram:{ label: 'Instagram',bg: 'bg-pink-100 text-pink-700'     },
};

export default function KanbanPage() {
    const [conversations, setConversations] = useState<Conversation[]>(MOCK);
    const [dragging, setDragging] = useState<string | null>(null);

    const moveCard = (id: string, newStatus: Status) => {
        setConversations(prev =>
            prev.map(c => c.id === id ? { ...c, status: newStatus } : c)
        );
        // TODO: PATCH /api/conversations/:id/status
    };

    const onDragOver = (e: React.DragEvent) => e.preventDefault();

    const onDrop = (e: React.DragEvent, status: Status) => {
        e.preventDefault();
        if (dragging) moveCard(dragging, status);
        setDragging(null);
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Seguimiento de Conversaciones</h1>
                <p className="text-slate-500 text-sm mt-1">Arrastra las tarjetas para cambiar el estado</p>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
                {COLUMNS.map(col => {
                    const cards = conversations.filter(c => c.status === col.status);
                    return (
                        <div
                            key={col.status}
                            className={`flex flex-col w-72 shrink-0 bg-slate-100 rounded-xl border-t-4 ${col.color}`}
                            onDragOver={onDragOver}
                            onDrop={e => onDrop(e, col.status)}
                        >
                            {/* Column header */}
                            <div className="px-4 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                                    <span className="font-semibold text-slate-700 text-sm">{col.label}</span>
                                </div>
                                <span className="text-xs bg-white border rounded-full px-2 py-0.5 text-slate-500 font-medium">
                                    {cards.length}
                                </span>
                            </div>

                            {/* Cards */}
                            <div className="flex flex-col gap-2 px-3 pb-3 overflow-y-auto">
                                {cards.map(card => (
                                    <KanbanCard
                                        key={card.id}
                                        card={card}
                                        onDragStart={() => setDragging(card.id)}
                                        onDragEnd={() => setDragging(null)}
                                    />
                                ))}
                                {cards.length === 0 && (
                                    <div className="text-center py-8 text-slate-400 text-sm">
                                        Sin conversaciones
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function KanbanCard({
    card,
    onDragStart,
    onDragEnd,
}: {
    card: Conversation;
    onDragStart: () => void;
    onDragEnd: () => void;
}) {
    const badge = PROVIDER_BADGE[card.channel_provider];

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="bg-white rounded-lg p-3 shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
        >
            {/* Top row */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                        {card.customer_name[0]}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{card.customer_name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.bg}`}>
                            {badge.label}
                        </span>
                    </div>
                </div>
                {card.unread_count > 0 && (
                    <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0">
                        {card.unread_count}
                    </span>
                )}
            </div>

            {/* Last message */}
            <p className="text-xs text-slate-500 truncate mb-3">{card.last_message}</p>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1">
                    {card.handled_by === 'bot'
                        ? <><Bot className="w-3 h-3 text-purple-500" /><span className="text-purple-500">Bot</span></>
                        : card.agent_name
                            ? <><User className="w-3 h-3" /><span>{card.agent_name}</span></>
                            : <><MessageSquare className="w-3 h-3" /><span>Sin asignar</span></>
                    }
                </div>
                <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{card.last_message_at}</span>
                </div>
            </div>
        </div>
    );
}
