"use client";
import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
const { Sparkles, Loader2, X, Check } = Lucide as any;
import { apiFetch } from '../hooks/useAuth';

interface AIWriterPanelProps {
    conversationId: string;
    draft: string;
    onUse: (suggestion: string) => void;
    onClose: () => void;
}

export default function AIWriterPanel({ conversationId, draft, onUse, onClose }: AIWriterPanelProps) {
    const [loading, setLoading] = useState(false);
    const [suggestion, setSuggestion] = useState('');
    const [tone, setTone] = useState('Profesional');

    const getSuggestion = async (selectedTone: string) => {
        setTone(selectedTone);
        setLoading(true);
        try {
            const res = await apiFetch('/api/ai/suggest', {
                method: 'POST',
                body: JSON.stringify({ conversation_id: conversationId, draft, tone: selectedTone }),
            });
            const data = await res.json();
            setSuggestion(data.suggestion);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b flex items-center justify-between bg-purple-50">
                <div className="flex items-center gap-2 text-purple-700">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-bold">AI Writer</span>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-purple-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-purple-600" />
                </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-4">
                <section>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Borrador actual</label>
                    <div className="p-3 bg-slate-50 border rounded-lg text-sm text-slate-600 italic">
                        {draft || "Escribe algo en el chat para que la IA pueda reformularlo..."}
                    </div>
                </section>

                <section>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Selecciona un tono</label>
                    <div className="grid grid-cols-2 gap-2">
                        {['Profesional', 'Amigable', 'Conciso', 'Persuasivo'].map(t => (
                            <button
                                key={t}
                                onClick={() => getSuggestion(t)}
                                disabled={loading}
                                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all
                                    ${tone === t ? 'bg-purple-600 border-purple-600 text-white' : 'hover:border-purple-300 hover:bg-purple-50 text-slate-600'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </section>

                {loading && (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                        <span className="text-xs text-slate-400">Generando sugerencia...</span>
                    </div>
                )}

                {suggestion && !loading && (
                    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Sugerencia de la IA</label>
                        <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl text-sm text-slate-800 leading-relaxed relative group">
                            {suggestion}
                            <button
                                onClick={() => onUse(suggestion)}
                                className="absolute -bottom-3 -right-3 bg-purple-600 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center gap-1 text-xs px-3"
                            >
                                <Check className="w-4 h-4" /> Use
                            </button>
                        </div>
                    </section>
                )}
            </div>

            <div className="p-4 border-t bg-slate-50">
                <p className="text-[10px] text-slate-400 text-center">
                    La IA puede cometer errores. Revisa siempre el mensaje antes de enviar.
                </p>
            </div>
        </div>
    );
}
