"use client";
import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
const { Zap, Search, Plus, Loader2, X, MessageSquare } = Lucide as any;
import { apiFetch } from '../hooks/useAuth';

interface QuickReply {
    id: string;
    shortcut: string;
    content: string;
    title?: string;
    use_count: number;
}

interface QuickRepliesPanelProps {
    onSelect: (content: string, id: string) => void;
    onClose: () => void;
}

export default function QuickRepliesPanel({ onSelect, onClose }: QuickRepliesPanelProps) {
    const [loading, setLoading] = useState(true);
    const [replies, setReplies] = useState<QuickReply[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        apiFetch('/api/quick-replies')
            .then(r => r.json())
            .then(setReplies)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = replies.filter(r =>
        r.shortcut.toLowerCase().includes(search.toLowerCase()) ||
        r.content.toLowerCase().includes(search.toLowerCase()) ||
        r.title?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="absolute bottom-full mb-2 left-0 w-80 bg-white border rounded-xl shadow-2xl z-50 flex flex-col max-h-96 animate-in slide-in-from-bottom-2 duration-200">
            <div className="p-3 border-b flex items-center justify-between bg-amber-50 rounded-t-xl">
                <div className="flex items-center gap-2 text-amber-700">
                    <Zap className="w-4 h-4 fill-amber-500" />
                    <span className="font-bold text-sm">Respuestas Rápidas</span>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-amber-100 rounded-full transition-colors">
                    <X className="w-4 h-4 text-amber-600" />
                </button>
            </div>

            <div className="p-2 border-b">
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        autoFocus
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por /shortcut o texto..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 bg-slate-50"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-xs">No se encontraron respuestas</p>
                    </div>
                ) : (
                    filtered.map(r => (
                        <button
                            key={r.id}
                            onClick={() => onSelect(r.content, r.id)}
                            className="w-full text-left p-3 hover:bg-amber-50 rounded-lg transition-colors group border border-transparent hover:border-amber-100 mb-1"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">/{r.shortcut}</span>
                                <span className="text-[10px] text-slate-400">Usado {r.use_count} veces</span>
                            </div>
                            {r.title && <p className="text-xs font-semibold text-slate-800 mb-0.5">{r.title}</p>}
                            <p className="text-xs text-slate-500 line-clamp-2">{r.content}</p>
                        </button>
                    ))
                )}
            </div>

            <button className="p-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 border-t flex items-center justify-center gap-2 transition-colors rounded-b-xl">
                <Plus className="w-3.5 h-3.5" />
                Nueva respuesta rápida
            </button>
        </div>
    );
}
