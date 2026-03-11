"use client";
import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
const {
    Users, Plus, X, Loader2, Save, Trash2, Shield,
    ArrowRightLeft, UserCheck, Settings, Globe,
    Search, Check
} = Lucide as any;

import { apiFetch } from '../../../hooks/useAuth';

interface Rule {
    id: string;
    name: string;
    channel_id: string | null;
    team_id: string | null;
    strategy: 'round_robin' | 'least_busy' | 'random';
    is_active: boolean;
    agent_ids: string[];
}

interface Agent {
    id: string;
    name: string;
    role: string;
}

export default function AssignmentRulesPage() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [channels, setChannels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showNew, setShowNew] = useState(false);

    const [form, setForm] = useState<Partial<Rule>>({
        name: '',
        strategy: 'round_robin',
        is_active: true,
        agent_ids: [],
        channel_id: null
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [rulesRes, agentsRes, channelsRes] = await Promise.all([
                apiFetch('/api/assignment-rules'),
                apiFetch('/api/agents'),
                apiFetch('/api/channels')
            ]);
            setRules(await rulesRes.json());
            setAgents(await agentsRes.json());
            setChannels(await channelsRes.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiFetch('/api/assignment-rules', {
                method: 'POST',
                body: JSON.stringify(form)
            });
            setShowNew(false);
            setForm({ name: '', strategy: 'round_robin', is_active: true, agent_ids: [], channel_id: null });
            fetchData();
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const toggleRuleStatus = async (id: string, currentStatus: boolean) => {
        await apiFetch(`/api/assignment-rules/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_active: !currentStatus })
        });
        fetchData();
    };

    const deleteRule = async (id: string) => {
        if (!confirm('¿Seguro que deseas eliminar esta regla?')) return;
        await apiFetch(`/api/assignment-rules/${id}`, { method: 'DELETE' });
        fetchData();
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8 bg-slate-50 min-h-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <ArrowRightLeft className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Reglas de Asignación</h1>
                        <p className="text-slate-500 text-sm mt-0.5 font-medium italic">Distribución inteligente de leads entrantes</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowNew(true)}
                    className="flex items-center gap-2 bg-slate-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-900 transition-all shadow-xl shadow-slate-200"
                >
                    <Plus className="w-5 h-5" /> Nueva Regla
                </button>
            </div>

            {/* List of existing rules */}
            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="font-bold">Cargando reglas...</span>
                    </div>
                ) : rules.length === 0 ? (
                    <div className="bg-white border-2 border-dashed rounded-3xl p-20 flex flex-col items-center gap-4 text-slate-400">
                        <Settings className="w-12 h-12 opacity-20" />
                        <p className="font-bold italic">No has configurado reglas de auto-asignación aún.</p>
                        <button onClick={() => setShowNew(true)} className="text-blue-600 text-xs font-bold hover:underline">Crear mi primera regla</button>
                    </div>
                ) : (
                    rules.map(rule => (
                        <div key={rule.id} className={`bg-white rounded-2xl border-l-8 p-6 shadow-sm flex items-center justify-between transition-all hover:shadow-md ${rule.is_active ? 'border-blue-600' : 'border-slate-300 opacity-75'}`}>
                            <div className="flex items-center gap-6">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${rule.is_active ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400 shadow-inner'}`}>
                                    {rule.strategy === 'round_robin' ? <Lucide.RotateCw className="w-6 h-6" /> : rule.strategy === 'random' ? <Lucide.Dices className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-slate-800 text-lg">{rule.name}</h3>
                                        {rule.is_active ? (
                                            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">Activo</span>
                                        ) : (
                                            <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">Inactivo</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-1.5">
                                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500 uppercase tracking-tighter">
                                            <Globe className="w-3.5 h-3.5" />
                                            {rule.channel_id ? channels.find(c => c.id === rule.channel_id)?.name : 'Todos los canales'}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500 uppercase tracking-tighter">
                                            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                                            {rule.agent_ids.length} Agentes
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => toggleRuleStatus(rule.id, rule.is_active)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${rule.is_active ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'}`}
                                >
                                    {rule.is_active ? 'Desactivar' : 'Activar'}
                                </button>
                                <button className="p-2.5 rounded-xl border text-slate-400 hover:bg-slate-50 transition-all"><Settings className="w-5 h-5" /></button>
                                <button onClick={() => deleteRule(rule.id)} className="p-2.5 rounded-xl border border-red-100 text-red-300 hover:bg-red-50 hover:text-red-500 transition-all"><Trash2 className="w-5 h-5" /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal for New Rule */}
            {showNew && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
                        <div className="flex items-center justify-between p-8 border-b bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                                    <ArrowRightLeft className="w-5 h-5" />
                                </div>
                                <h3 className="font-black text-xl text-slate-800 tracking-tight">Nueva Regla de Asignación</h3>
                            </div>
                            <button onClick={() => setShowNew(false)} className="p-2.5 rounded-xl hover:bg-slate-200 text-slate-400 transition-all"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">Nombre Descriptivo</label>
                                    <input
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="ej: Ventas WhatsApp México"
                                        className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">Canal Vinculado</label>
                                        <select
                                            value={form.channel_id || ''}
                                            onChange={e => setForm({ ...form, channel_id: e.target.value || null })}
                                            className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none appearance-none bg-slate-50"
                                        >
                                            <option value="">Todos los canales</option>
                                            {channels.map(c => <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">Estrategia</label>
                                        <select
                                            value={form.strategy}
                                            onChange={e => setForm({ ...form, strategy: e.target.value as any })}
                                            className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none bg-slate-50"
                                        >
                                            <option value="round_robin">Round Robin (Turnos)</option>
                                            <option value="random">Aleatorio</option>
                                            <option value="least_busy">Menos ocupado</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-3 tracking-widest">Agentes Seleccionados</label>
                                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-4 rounded-3xl border-2 border-slate-100/50">
                                    {agents.map(agent => {
                                        const selected = form.agent_ids?.includes(agent.id);
                                        return (
                                            <button
                                                key={agent.id}
                                                onClick={() => {
                                                    const ids = form.agent_ids || [];
                                                    setForm({ ...form, agent_ids: selected ? ids.filter(i => i !== agent.id) : [...ids, agent.id] });
                                                }}
                                                className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all font-bold text-xs ${selected ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-white bg-white text-slate-500 hover:border-slate-200'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                        {agent.name[0]}
                                                    </div>
                                                    {agent.name}
                                                </div>
                                                {selected && <Check className="w-3.5 h-3.5" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t bg-slate-50/50 flex gap-4">
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.name || form.agent_ids?.length === 0}
                                className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-2xl shadow-blue-500/20"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Guardar Regla
                            </button>
                            <button onClick={() => setShowNew(false)} className="px-8 py-4 rounded-2xl border-2 border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-100 transition-all">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
