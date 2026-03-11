"use client";
import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
const {
    Calendar, Clock, User, MessageSquare, Plus, X, Loader2,
    ChevronLeft, ChevronRight, CalendarDays, MoreVertical, Search,
    Filter, AlertCircle, CheckCircle2, Users
} = Lucide as any;

import { apiFetch } from '../../hooks/useAuth';

interface Event {
    id: string;
    title: string;
    description: string;
    start_at: string;
    end_at: string;
    event_type: 'meeting' | 'call' | 'demo' | 'follow_up' | 'other';
    status: 'scheduled' | 'completed' | 'cancelled';
    customer_name: string;
    agent_name: string;
    notes: string;
}

const EVENT_TYPE_STYLE: Record<string, { label: string; bg: string; text: string; icon: any }> = {
    meeting: { label: 'Reunión', bg: 'bg-blue-100', text: 'text-blue-700', icon: Calendar },
    call: { label: 'Llamada', bg: 'bg-green-100', text: 'text-green-700', icon: Lucide.Phone },
    demo: { label: 'Demo', bg: 'bg-purple-100', text: 'text-purple-700', icon: Lucide.Monitor },
    follow_up: { label: 'Seguimiento', bg: 'bg-orange-100', text: 'text-orange-700', icon: Lucide.History },
    other: { label: 'Otro', bg: 'bg-slate-100', text: 'text-slate-700', icon: MoreVertical },
};

function NewEventModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const [title, setTitle] = useState('');
    const [type, setType] = useState('meeting');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await apiFetch('/api/events', {
                method: 'POST',
                body: JSON.stringify({ title, event_type: type, start_at: start, end_at: end, notes })
            });
            onSaved();
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="font-bold text-lg text-slate-800">Agendar Nuevo Evento</h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Título de la actividad</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ej: Revisión de presupuesto con cliente" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Tipo</label>
                            <select value={type} onChange={e => setType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                                {Object.entries(EVENT_TYPE_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Prioridad</label>
                            <div className="flex gap-2">
                                <div className="w-4 h-4 rounded-full bg-red-500 cursor-pointer shadow-sm"></div>
                                <div className="w-4 h-4 rounded-full bg-yellow-500 cursor-pointer shadow-sm"></div>
                                <div className="w-4 h-4 rounded-full bg-blue-500 cursor-pointer shadow-sm"></div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Inicio</label>
                            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Fin (Opcional)</label>
                            <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Notas internas</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" placeholder="Detalles relevantes para el equipo..." />
                    </div>
                </div>
                <div className="flex gap-3 p-6 border-t bg-slate-50">
                    <button onClick={save} disabled={saving || !title || !start} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                        Confirmar Evento
                    </button>
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl border bg-white text-slate-600 hover:bg-slate-50 font-bold transition-all">Cancelar</button>
                </div>
            </div>
        </div>
    );
}

export default function AgendaPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [view, setView] = useState<'list' | 'calendar'>('list');

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/events');
            const data = await res.json();
            setEvents(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchEvents(); }, []);

    const markCompleted = async (id: string) => {
        await apiFetch(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'completed' }) });
        fetchEvents();
    };

    return (
        <div className="p-8 space-y-8 bg-slate-50 min-h-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Agenda & Actividades</h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium italic">Gestión de reuniones y seguimientos comerciales</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex bg-white rounded-xl p-1 border shadow-sm">
                        <button onClick={() => setView('list')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Lista</button>
                        <button onClick={() => setView('calendar')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'calendar' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Calendario</button>
                    </div>
                    <button onClick={() => setShowNew(true)} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200">
                        <Plus className="w-5 h-5" /> Nueva Actividad
                    </button>
                </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Próximos eventos', value: events.filter(e => e.status === 'scheduled').length, icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Llamadas hoy', value: events.filter(e => e.event_type === 'call').length, icon: Lucide.Phone, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Reuniones esta semana', value: events.filter(e => e.event_type === 'meeting').length, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'Tareas pendientes', value: events.filter(e => e.status === 'scheduled').length, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border shadow-sm border-slate-200/60">
                        <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-4 shadow-sm`}>
                            <stat.icon className="w-5 h-5 transition-transform hover:scale-110" />
                        </div>
                        <p className="text-2xl font-black text-slate-800">{stat.value}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {view === 'list' ? (
                <div className="bg-white rounded-2xl border shadow-xl shadow-slate-200/50 overflow-hidden min-h-[400px]">
                    <div className="px-6 py-4 border-b flex items-center justify-between bg-white sticky top-0 z-10">
                        <div className="relative w-72">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input placeholder="Buscar actividad..." className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div className="flex gap-2">
                            <button className="p-2 border rounded-xl text-slate-500 hover:bg-slate-50 shadow-sm transition-all"><Filter className="w-4 h-4" /></button>
                            <button onClick={fetchEvents} className="p-2 border rounded-xl text-slate-500 hover:bg-slate-50 shadow-sm transition-all"><Lucide.RefreshCw className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actividad</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha & Hora</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente / Agente</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-8 py-6"><div className="h-6 bg-slate-100 rounded"></div></td>
                                        </tr>
                                    ))
                                ) : events.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <Calendar className="w-12 h-12 text-slate-200" />
                                                <p className="text-sm font-bold text-slate-400">No hay actividades programadas</p>
                                                <button onClick={() => setShowNew(true)} className="text-blue-600 text-xs font-bold hover:underline">Click aquí para agendar</button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    events.map((e) => {
                                        const style = EVENT_TYPE_STYLE[e.event_type] || EVENT_TYPE_STYLE.other;
                                        return (
                                            <tr key={e.id} className="hover:bg-slate-50/50 transition-all group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 ${style.bg} ${style.text} rounded-xl flex items-center justify-center shrink-0`}>
                                                            <style.icon className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-slate-800 text-sm leading-tight truncate">{e.title}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{style.label}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                                            {new Date(e.start_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {new Date(e.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="space-y-1">
                                                        <div title="Cliente" className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                            <User className="w-3.5 h-3.5 text-blue-400" />
                                                            {e.customer_name || 'Sin cliente'}
                                                        </div>
                                                        <div title="Asignado" className="flex items-center gap-2 text-xs font-medium text-slate-400">
                                                            <Lucide.UserCheck className="w-3.5 h-3.5 text-slate-300" />
                                                            {e.agent_name || 'Admin'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    {e.status === 'completed' ? (
                                                        <span className="flex items-center gap-1.5 text-green-600 font-black text-[10px] uppercase tracking-widest bg-green-50 px-2.5 py-1 rounded-full border border-green-100 italic">
                                                            <CheckCircle2 className="w-3 h-3" /> Completado
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-blue-600 font-black text-[10px] uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 italic glow-pulsate">
                                                            <Clock className="w-3 h-3" /> Programado
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                        {e.status !== 'completed' && (
                                                            <button onClick={() => markCompleted(e.id)} title="Completar" className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-xl transition-all shadow-sm">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button className="p-2 bg-slate-50 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-xl transition-all shadow-sm">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-20 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-slate-400 italic">
                    <CalendarDays className="w-16 h-16 text-slate-200" />
                    <p className="font-bold">Vista de calendario en desarrollo</p>
                </div>
            )}

            {showNew && <NewEventModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); fetchEvents(); }} />}
        </div>
    );
}
