"use client";
import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
const { Clock, X, Loader2, Send } = Lucide as any;
import { apiFetch } from '../hooks/useAuth';

interface ScheduleMessageModalProps {
    conversationId: string;
    initialContent?: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ScheduleMessageModal({ conversationId, initialContent = '', onClose, onSuccess }: ScheduleMessageModalProps) {
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState(initialContent);
    const [scheduledAt, setScheduledAt] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !scheduledAt) return;
        setLoading(true);
        try {
            await apiFetch('/api/scheduled-messages', {
                method: 'POST',
                body: JSON.stringify({ conversation_id: conversationId, content, scheduled_at: scheduledAt }),
            });
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2 text-slate-700">
                        <Clock className="w-5 h-5" />
                        <span className="font-bold">Programar Mensaje</span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-600" />
                    </button>
                </div>

                <form onSubmit={submit} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Mensaje</label>
                        <textarea
                            required
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={4}
                            placeholder="¿Qué quieres decir?"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-300 outline-none resize-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fecha y Hora de envío</label>
                        <input
                            required
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={e => setScheduledAt(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-300 outline-none"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            disabled={loading || !content.trim() || !scheduledAt}
                            type="submit"
                            className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Programar</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
