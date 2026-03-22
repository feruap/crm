"use client";
import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
const { Calendar, X, Loader2, Info } = Lucide as any;
import { apiFetch } from '../hooks/useAuth';

interface EventModalProps {
    customerId?: string;
    conversationId?: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EventModal({ customerId, conversationId, onClose, onSuccess }: EventModalProps) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        title: '',
        event_type: 'meeting',
        start_at: '',
        end_at: '',
        notes: '',
    });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await apiFetch('/api/events', {
                method: 'POST',
                body: JSON.stringify({ ...form, customer_id: customerId, conversation_id: conversationId }),
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
                <div className="p-4 border-b flex items-center justify-between bg-blue-50">
                    <div className="flex items-center gap-2 text-blue-700">
                        <Calendar className="w-5 h-5" />
                        <span className="font-bold">Agendar Evento</span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-blue-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-blue-600" />
                    </button>
                </div>

                <form onSubmit={submit} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Título del evento</label>
                        <input
                            required
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            placeholder="Ej: Demo comercial, Llamada de seguimiento"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tipo</label>
                            <select
                                value={form.event_type}
                                onChange={e => setForm({ ...form, event_type: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none bg-white"
                            >
                                <option value="meeting">Reunión</option>
                                <option value="call">Llamada</option>
                                <option value="demo">Demo</option>
                                <option value="follow_up">Seguimiento</option>
                                <option value="other">Otro</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Inicio</label>
                            <input
                                required
                                type="datetime-local"
                                value={form.start_at}
                                onChange={e => setForm({ ...form, start_at: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fin (opcional)</label>
                            <input
                                type="datetime-local"
                                value={form.end_at}
                                onChange={e => setForm({ ...form, end_at: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Notas</label>
                        <textarea
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                            rows={3}
                            placeholder="Detalles adicionales..."
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none resize-none"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            disabled={loading}
                            type="submit"
                            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Evento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
