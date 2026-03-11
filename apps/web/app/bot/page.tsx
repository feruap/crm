"use client";
import React, { useState, useEffect, useCallback } from 'react';
import * as Lucide from 'lucide-react';
const {
    Bot, Search, Trash2, Edit2, Check, X, TrendingUp, Plus, Loader2,
    Zap, MessageSquare, Image, ListChecks, Users, UserCheck,
    ClipboardList, GitBranch, StopCircle, ChevronUp, ChevronDown,
    ToggleLeft, ToggleRight, AlertCircle, ArrowRight, Hash,
} = Lucide as any;

import { apiFetch } from '../../hooks/useAuth';

// ── Types ──────────────────────────────────────────────────────────────────────
interface KnowledgeEntry {
    id: string;
    question: string;
    answer: string;
    confidence_score: number;
    use_count: number;
    source_conversation_id: string | null;
    created_at: string;
}

interface FlowStep {
    id: string;
    type: 'send_text' | 'send_image' | 'quick_reply' | 'assign_team' | 'assign_agent' | 'collect_data' | 'condition' | 'end_bot';
    content?: string;
    image_url?: string;
    caption?: string;
    options?: string[];
    team_id?: string;
    agent_id?: string;
    field_name?: string;
    prompt?: string;
}

interface BotFlow {
    id: string;
    name: string;
    is_active: boolean;
    trigger_type: 'keyword' | 'first_message' | 'campaign' | 'after_hours';
    trigger_config: any;
    steps: FlowStep[];
    channel_providers: string[] | null;
    priority: number;
    campaign_name?: string | null;
    created_at: string;
}

interface Team { id: string; name: string; color: string; }
interface Agent { id: string; name: string; }

const TRIGGER_META = {
    keyword:       { label: 'Palabra clave',     icon: <Hash size={12} />,         color: 'bg-blue-100 text-blue-700' },
    first_message: { label: 'Primer mensaje',    icon: <MessageSquare size={12} />, color: 'bg-purple-100 text-purple-700' },
    campaign:      { label: 'Campaña',           icon: <Zap size={12} />,           color: 'bg-orange-100 text-orange-700' },
    after_hours:   { label: 'Fuera de horario',  icon: <StopCircle size={12} />,    color: 'bg-slate-100 text-slate-600' },
};

const STEP_META = {
    send_text:    { label: 'Enviar mensaje',      icon: <MessageSquare size={14} />, color: 'bg-blue-50 border-blue-200' },
    send_image:   { label: 'Enviar imagen',       icon: <Image size={14} />,         color: 'bg-pink-50 border-pink-200' },
    quick_reply:  { label: 'Botones de respuesta',icon: <ListChecks size={14} />,    color: 'bg-violet-50 border-violet-200' },
    assign_team:  { label: 'Asignar equipo',      icon: <Users size={14} />,         color: 'bg-green-50 border-green-200' },
    assign_agent: { label: 'Asignar agente',      icon: <UserCheck size={14} />,     color: 'bg-teal-50 border-teal-200' },
    collect_data: { label: 'Recopilar dato',      icon: <ClipboardList size={14} />, color: 'bg-yellow-50 border-yellow-200' },
    condition:    { label: 'Condición',           icon: <GitBranch size={14} />,     color: 'bg-orange-50 border-orange-200' },
    end_bot:      { label: 'Pasar a humano',      icon: <StopCircle size={14} />,    color: 'bg-red-50 border-red-200' },
};

const PROVIDERS = ['whatsapp', 'facebook', 'instagram', 'tiktok'];
const PROVIDER_LABELS: Record<string, string> = { whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' };

function uid() { return Math.random().toString(36).slice(2, 10); }

// ── Main ───────────────────────────────────────────────────────────────────────
export default function BotPage() {
    const [tab, setTab] = useState<'flujos' | 'conocimiento'>('flujos');

    return (
        <div>
            {/* Sticky tab bar */}
            <div className="border-b bg-white px-6 flex gap-1 pt-4 sticky top-0 z-10">
                {[
                    { key: 'flujos',       label: 'Flujos Automáticos', icon: <Zap className="w-4 h-4" /> },
                    { key: 'conocimiento', label: 'Base de Conocimiento', icon: <Bot className="w-4 h-4" /> },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as any)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors
                            ${tab === t.key
                                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {tab === 'flujos'       && <FlujosTab />}
            {tab === 'conocimiento' && <ConocimientoTab />}
        </div>
    );
}

// ── Flujos Tab ─────────────────────────────────────────────────────────────────
function FlujosTab() {
    const [flows, setFlows]       = useState<BotFlow[]>([]);
    const [loading, setLoading]   = useState(true);
    const [teams, setTeams]       = useState<Team[]>([]);
    const [agents, setAgents]     = useState<Agent[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [editing, setEditing]   = useState<BotFlow | null>(null);
    const [showBuilder, setShowBuilder] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [fr, tr, ar, cr] = await Promise.all([
                apiFetch('/api/flows').then(r => r.json()),
                apiFetch('/api/teams').then(r => r.json()),
                apiFetch('/api/agents').then(r => r.json()),
                apiFetch('/api/campaigns').then(r => r.json()),
            ]);
            setFlows(fr); setTeams(tr); setAgents(ar); setCampaigns(cr);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openNew = () => { setEditing(null); setShowBuilder(true); };
    const openEdit = (f: BotFlow) => { setEditing(f); setShowBuilder(true); };

    const toggleActive = async (f: BotFlow) => {
        await apiFetch(`/api/flows/${f.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_active: !f.is_active }),
        });
        setFlows(prev => prev.map(fl => fl.id === f.id ? { ...fl, is_active: !fl.is_active } : fl));
    };

    const deleteFlow = async (id: string) => {
        if (!confirm('¿Eliminar este flujo?')) return;
        await apiFetch(`/api/flows/${id}`, { method: 'DELETE' });
        setFlows(prev => prev.filter(f => f.id !== id));
    };

    if (loading) return <div className="p-10 flex items-center gap-2 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /> Cargando flujos...</div>;

    return (
        <div className="p-6 space-y-5 max-w-4xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Flujos de Automatización</h2>
                    <p className="text-slate-500 text-sm mt-0.5">Crea secuencias automáticas que el bot ejecuta ante diferentes disparadores.</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    <Plus className="w-4 h-4" /> Crear flujo
                </button>
            </div>

            {flows.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 text-center text-slate-400">
                    <Zap className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium">No hay flujos creados</p>
                    <p className="text-xs mt-1">Los flujos permiten al bot responder automáticamente según disparadores como palabras clave, primer mensaje, o fuera del horario de atención.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {flows.map(flow => {
                        const trigger = TRIGGER_META[flow.trigger_type];
                        const stepCount = (flow.steps ?? []).length;
                        const providers = flow.channel_providers ?? PROVIDERS;
                        return (
                            <div key={flow.id} className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4 transition-opacity ${!flow.is_active ? 'opacity-60' : ''}`}>
                                {/* Trigger badge */}
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${trigger.color}`}>
                                    {trigger.icon} {trigger.label}
                                </div>
                                {/* Name */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-slate-800 truncate">{flow.name}</h4>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                                        <span>{stepCount} paso{stepCount !== 1 ? 's' : ''}</span>
                                        {flow.trigger_type === 'keyword' && flow.trigger_config?.keywords?.length > 0 && (
                                            <span>"{flow.trigger_config.keywords.slice(0, 2).join('", "')}{flow.trigger_config.keywords.length > 2 ? `... +${flow.trigger_config.keywords.length - 2}` : ''}"</span>
                                        )}
                                        {flow.trigger_type === 'campaign' && flow.campaign_name && (
                                            <span>Campaña: {flow.campaign_name}</span>
                                        )}
                                        <span className="flex gap-1">
                                            {providers.slice(0, 4).map(p => (
                                                <span key={p} className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{PROVIDER_LABELS[p] ?? p}</span>
                                            ))}
                                        </span>
                                    </div>
                                </div>
                                {/* Priority */}
                                {flow.priority > 0 && (
                                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full shrink-0">P{flow.priority}</span>
                                )}
                                {/* Active toggle */}
                                <button onClick={() => toggleActive(flow)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${flow.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                    {flow.is_active ? 'Activo' : 'Pausado'}
                                </button>
                                {/* Actions */}
                                <button onClick={() => openEdit(flow)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => deleteFlow(flow.id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Flow Builder Modal */}
            {showBuilder && (
                <FlowBuilder
                    flow={editing}
                    teams={teams}
                    agents={agents}
                    campaigns={campaigns}
                    onClose={() => setShowBuilder(false)}
                    onSaved={() => { setShowBuilder(false); load(); }}
                />
            )}
        </div>
    );
}

// ── Flow Builder ──────────────────────────────────────────────────────────────
function FlowBuilder({ flow, teams, agents, campaigns, onClose, onSaved }: {
    flow: BotFlow | null;
    teams: Team[];
    agents: Agent[];
    campaigns: any[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [name, setName]           = useState(flow?.name ?? '');
    const [triggerType, setTriggerType] = useState<BotFlow['trigger_type']>(flow?.trigger_type ?? 'keyword');
    const [keywords, setKeywords]   = useState<string[]>(flow?.trigger_config?.keywords ?? []);
    const [keywordMatch, setKeywordMatch] = useState<'any'|'all'>(flow?.trigger_config?.match ?? 'any');
    const [campaignId, setCampaignId] = useState(flow?.trigger_config?.campaign_id ?? '');
    const [providers, setProviders] = useState<string[]>(flow?.channel_providers ?? [...PROVIDERS]);
    const [priority, setPriority]   = useState(flow?.priority ?? 0);
    const [steps, setSteps]         = useState<FlowStep[]>(flow?.steps ?? []);
    const [newKw, setNewKw]         = useState('');
    const [saving, setSaving]       = useState(false);

    const addStep = (type: FlowStep['type']) => {
        const step: FlowStep = { id: uid(), type };
        if (type === 'quick_reply') step.options = ['Opción 1', 'Opción 2'];
        setSteps(prev => [...prev, step]);
    };

    const updateStep = (id: string, patch: Partial<FlowStep>) => {
        setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    };

    const removeStep = (id: string) => setSteps(prev => prev.filter(s => s.id !== id));

    const moveStep = (id: string, dir: -1 | 1) => {
        setSteps(prev => {
            const idx = prev.findIndex(s => s.id === id);
            if (idx < 0) return prev;
            const next = idx + dir;
            if (next < 0 || next >= prev.length) return prev;
            const arr = [...prev];
            [arr[idx], arr[next]] = [arr[next], arr[idx]];
            return arr;
        });
    };

    const addKeyword = () => {
        const kw = newKw.trim();
        if (kw && !keywords.includes(kw)) { setKeywords(prev => [...prev, kw]); setNewKw(''); }
    };

    const toggleProvider = (p: string) => {
        setProviders(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    };

    const save = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const trigger_config: any = {};
            if (triggerType === 'keyword')  { trigger_config.keywords = keywords; trigger_config.match = keywordMatch; }
            if (triggerType === 'campaign') { trigger_config.campaign_id = campaignId; }

            const body = {
                name: name.trim(),
                trigger_type: triggerType,
                trigger_config,
                steps,
                channel_providers: providers.length < PROVIDERS.length ? providers : null,
                priority,
                is_active: true,
            };

            if (flow) {
                await apiFetch(`/api/flows/${flow.id}`, { method: 'PATCH', body: JSON.stringify(body) });
            } else {
                await apiFetch('/api/flows', { method: 'POST', body: JSON.stringify(body) });
            }
            onSaved();
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex">
            {/* Sidebar (trigger + settings) */}
            <div className="w-80 bg-white border-r flex flex-col h-full shrink-0 shadow-xl">
                <div className="flex items-center justify-between p-5 border-b">
                    <h3 className="font-bold text-base">{flow ? 'Editar flujo' : 'Nuevo flujo'}</h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nombre</label>
                        <input value={name} onChange={e => setName(e.target.value)}
                            placeholder="ej: Bienvenida nuevos clientes"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>

                    {/* Trigger type */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Disparador</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(TRIGGER_META) as BotFlow['trigger_type'][]).map(t => (
                                <button key={t} onClick={() => setTriggerType(t)}
                                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${triggerType === t ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                    <span className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full mb-1 ${TRIGGER_META[t].color}`}>
                                        {TRIGGER_META[t].icon} {TRIGGER_META[t].label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Trigger config */}
                    {triggerType === 'keyword' && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Palabras clave</label>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {keywords.map(kw => (
                                        <span key={kw} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                                            {kw}
                                            <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))} className="hover:text-blue-900"><X className="w-3 h-3" /></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input value={newKw} onChange={e => setNewKw(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addKeyword()}
                                        placeholder="Escribe y presiona Enter"
                                        className="flex-1 border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
                                    <button onClick={addKeyword} className="px-2 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Activar cuando el mensaje contenga:</label>
                                <div className="flex gap-2">
                                    {(['any', 'all'] as const).map(v => (
                                        <button key={v} onClick={() => setKeywordMatch(v)}
                                            className={`px-3 py-1 text-xs rounded-lg border transition-colors ${keywordMatch === v ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                                            {v === 'any' ? 'Cualquier palabra' : 'Todas las palabras'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {triggerType === 'campaign' && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Campaña</label>
                            <select value={campaignId} onChange={e => setCampaignId(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                                <option value="">— Seleccionar campaña —</option>
                                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name || c.platform_campaign_id}</option>)}
                            </select>
                        </div>
                    )}
                    {triggerType === 'after_hours' && (
                        <div className="bg-slate-50 border rounded-lg px-3 py-2.5 text-xs text-slate-500 flex gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            Este flujo se activará cuando un cliente escriba fuera del horario configurado en Ajustes → Horarios.
                        </div>
                    )}
                    {triggerType === 'first_message' && (
                        <div className="bg-slate-50 border rounded-lg px-3 py-2.5 text-xs text-slate-500 flex gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            Se activa la primera vez que un cliente contacta a través de cualquiera de los canales seleccionados.
                        </div>
                    )}

                    {/* Channels */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Canales</label>
                        <div className="flex flex-wrap gap-2">
                            {PROVIDERS.map(p => (
                                <button key={p} onClick={() => toggleProvider(p)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${providers.includes(p) ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                    {PROVIDER_LABELS[p]}
                                </button>
                            ))}
                        </div>
                        {providers.length === 0 && <p className="text-xs text-red-500 mt-1">Selecciona al menos un canal</p>}
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Prioridad: <span className="font-mono normal-case text-slate-700">{priority}</span>
                            <span className="font-normal ml-1 text-slate-400">(mayor = primero)</span>
                        </label>
                        <input type="range" min={0} max={10} step={1} value={priority} onChange={e => setPriority(Number(e.target.value))} className="w-full" />
                    </div>
                </div>

                {/* Save button */}
                <div className="p-5 border-t">
                    <button onClick={save} disabled={saving || !name.trim() || providers.length === 0}
                        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {flow ? 'Guardar cambios' : 'Crear flujo'}
                    </button>
                </div>
            </div>

            {/* Step builder (main area) */}
            <div className="flex-1 overflow-auto bg-slate-50 flex flex-col">
                <div className="p-6 border-b bg-white flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-slate-800">Secuencia de pasos</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Los pasos se ejecutan en orden cuando se activa el disparador.</p>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                        {steps.length} paso{steps.length !== 1 ? 's' : ''}
                    </span>
                </div>

                <div className="flex-1 p-6">
                    <div className="max-w-lg mx-auto space-y-3">
                        {/* Start node */}
                        <div className="flex justify-center">
                            <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl px-6 py-3 text-xs text-slate-400 font-medium">
                                ⚡ Disparador: {TRIGGER_META[triggerType].label}
                            </div>
                        </div>

                        {steps.length > 0 && <div className="flex justify-center"><div className="w-0.5 h-4 bg-slate-300" /></div>}

                        {steps.map((step, idx) => (
                            <React.Fragment key={step.id}>
                                <StepCard
                                    step={step}
                                    index={idx}
                                    isFirst={idx === 0}
                                    isLast={idx === steps.length - 1}
                                    teams={teams}
                                    agents={agents}
                                    onChange={patch => updateStep(step.id, patch)}
                                    onDelete={() => removeStep(step.id)}
                                    onMoveUp={() => moveStep(step.id, -1)}
                                    onMoveDown={() => moveStep(step.id, 1)}
                                />
                                {idx < steps.length - 1 && <div className="flex justify-center"><div className="w-0.5 h-3 bg-slate-300" /></div>}
                            </React.Fragment>
                        ))}

                        {/* Add step */}
                        <div className="flex justify-center">
                            {steps.length > 0 && <div className="w-0.5 h-4 bg-slate-300 mr-[calc(50%-0.5px)] absolute" style={{ position: 'relative' }} />}
                        </div>
                        <StepPicker onAdd={addStep} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Step Card ──────────────────────────────────────────────────────────────────
function StepCard({ step, index, isFirst, isLast, teams, agents, onChange, onDelete, onMoveUp, onMoveDown }: {
    step: FlowStep;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    teams: Team[];
    agents: Agent[];
    onChange: (patch: Partial<FlowStep>) => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    const meta = STEP_META[step.type];
    const [optInput, setOptInput] = useState('');

    return (
        <div className={`rounded-xl border-2 p-4 ${meta.color} bg-white shadow-sm`}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">{index + 1}</span>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 flex-1">
                    {meta.icon} {meta.label}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={onMoveUp} disabled={isFirst} className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button onClick={onMoveDown} disabled={isLast} className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                    <button onClick={onDelete} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
            </div>

            {/* Content based on type */}
            {step.type === 'send_text' && (
                <textarea
                    value={step.content ?? ''}
                    onChange={e => onChange({ content: e.target.value })}
                    placeholder="Escribe el mensaje que el bot enviará..."
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
            )}

            {step.type === 'send_image' && (
                <div className="space-y-2">
                    <input value={step.image_url ?? ''} onChange={e => onChange({ image_url: e.target.value })}
                        placeholder="URL de la imagen (https://...)"
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <input value={step.caption ?? ''} onChange={e => onChange({ caption: e.target.value })}
                        placeholder="Descripción / pie de imagen (opcional)"
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
            )}

            {step.type === 'quick_reply' && (
                <div className="space-y-3">
                    <textarea
                        value={step.content ?? ''}
                        onChange={e => onChange({ content: e.target.value })}
                        placeholder="Texto del mensaje (ej: ¿En qué te puedo ayudar?)"
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    />
                    <div>
                        <p className="text-xs text-slate-500 mb-1.5">Opciones de respuesta:</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {(step.options ?? []).map((opt, i) => (
                                <div key={i} className="flex items-center gap-1 bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full text-xs">
                                    <input value={opt}
                                        onChange={e => { const opts = [...(step.options ?? [])]; opts[i] = e.target.value; onChange({ options: opts }); }}
                                        className="bg-transparent w-24 focus:outline-none text-xs" />
                                    <button onClick={() => onChange({ options: (step.options ?? []).filter((_, j) => j !== i) })}
                                        className="hover:text-violet-900"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input value={optInput} onChange={e => setOptInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && optInput.trim()) { onChange({ options: [...(step.options ?? []), optInput.trim()] }); setOptInput(''); }}}
                                placeholder="Agregar opción..."
                                className="flex-1 border rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400" />
                            <button onClick={() => { if (optInput.trim()) { onChange({ options: [...(step.options ?? []), optInput.trim()] }); setOptInput(''); }}}
                                className="px-2 py-1 bg-violet-600 text-white rounded-lg text-xs hover:bg-violet-700">
                                <Plus className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {step.type === 'assign_team' && (
                <select value={step.team_id ?? ''} onChange={e => onChange({ team_id: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">— Seleccionar equipo —</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            )}

            {step.type === 'assign_agent' && (
                <select value={step.agent_id ?? ''} onChange={e => onChange({ agent_id: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">— Seleccionar agente —</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
            )}

            {step.type === 'collect_data' && (
                <div className="space-y-2">
                    <input value={step.field_name ?? ''} onChange={e => onChange({ field_name: e.target.value })}
                        placeholder="Nombre del campo (ej: email, telefono, nombre)"
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <textarea value={step.prompt ?? ''} onChange={e => onChange({ prompt: e.target.value })}
                        placeholder="Pregunta al cliente (ej: ¿Cuál es tu correo electrónico?)"
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
                </div>
            )}

            {step.type === 'end_bot' && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600 flex items-center gap-2">
                    <StopCircle className="w-4 h-4 shrink-0" />
                    El bot cede el control al equipo de agentes humanos. La conversación queda en estado "pendiente".
                </div>
            )}

            {step.type === 'condition' && (
                <div className="space-y-2">
                    <textarea value={step.content ?? ''} onChange={e => onChange({ content: e.target.value })}
                        placeholder="Describe la condición (ej: si el cliente dijo 'comprar', enviar oferta...)"
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
                    <p className="text-xs text-slate-400">Las condiciones avanzadas con ramificaciones estarán disponibles próximamente.</p>
                </div>
            )}
        </div>
    );
}

// ── Step Picker ────────────────────────────────────────────────────────────────
function StepPicker({ onAdd }: { onAdd: (type: FlowStep['type']) => void }) {
    const [open, setOpen] = useState(false);
    const types: FlowStep['type'][] = ['send_text', 'send_image', 'quick_reply', 'assign_team', 'assign_agent', 'collect_data', 'end_bot'];

    return (
        <div className="relative flex flex-col items-center">
            <button onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 bg-white border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 text-slate-500 hover:text-blue-600 px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
                <Plus className="w-4 h-4" /> Agregar paso
            </button>
            {open && (
                <div className="absolute top-12 bg-white border rounded-2xl shadow-2xl z-10 p-3 w-72">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2 mb-2">Tipo de paso</p>
                    <div className="grid grid-cols-2 gap-1.5">
                        {types.map(t => {
                            const m = STEP_META[t];
                            return (
                                <button key={t} onClick={() => { onAdd(t); setOpen(false); }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 text-left transition-all">
                                    <span className={`p-1.5 rounded-lg ${m.color} border`}>{m.icon}</span>
                                    <span className="text-xs font-medium text-slate-700">{m.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Conocimiento Tab ───────────────────────────────────────────────────────────
function ConocimientoTab() {
    const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch]   = useState('');
    const [editing, setEditing] = useState<string | null>(null);
    const [editAnswer, setEditAnswer] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [newQ, setNewQ]       = useState('');
    const [newA, setNewA]       = useState('');
    const [saving, setSaving]   = useState(false);

    useEffect(() => {
        apiFetch('/api/bot/knowledge')
            .then(r => r.json())
            .then(setEntries)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = entries.filter(e =>
        e.question.toLowerCase().includes(search.toLowerCase()) ||
        e.answer.toLowerCase().includes(search.toLowerCase())
    );

    const saveEdit = async (id: string) => {
        setSaving(true);
        try {
            await apiFetch(`/api/bot/knowledge/${id}`, { method: 'PATCH', body: JSON.stringify({ answer: editAnswer }) });
            setEntries(prev => prev.map(e => e.id === id ? { ...e, answer: editAnswer } : e));
            setEditing(null);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const deleteEntry = async (id: string) => {
        await apiFetch(`/api/bot/knowledge/${id}`, { method: 'DELETE' });
        setEntries(prev => prev.filter(e => e.id !== id));
    };

    const addEntry = async () => {
        if (!newQ.trim() || !newA.trim()) return;
        setSaving(true);
        try {
            const res = await apiFetch('/api/bot/knowledge', { method: 'POST', body: JSON.stringify({ question: newQ, answer: newA }) });
            const entry: KnowledgeEntry = await res.json();
            setEntries(prev => [entry, ...prev]);
            setNewQ(''); setNewA(''); setShowAdd(false);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const topUsed = [...entries].sort((a, b) => b.use_count - a.use_count).slice(0, 3);
    const lowConf = entries.filter(e => e.confidence_score < 0.75).length;
    const totalUse = entries.reduce((s, e) => s + e.use_count, 0);

    return (
        <div className="p-6 space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Bot className="w-5 h-5 text-purple-600" /> Base de Conocimiento del Bot
                    </h2>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {entries.length} respuestas · {totalUse} usos totales · {lowConf} con baja confianza
                    </p>
                </div>
                <button onClick={() => setShowAdd(v => !v)}
                    className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
                    <Plus className="w-4 h-4" /> Agregar respuesta
                </button>
            </div>

            {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>}

            {!loading && topUsed.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    {topUsed.map((e, i) => (
                        <div key={e.id} className="bg-white border rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp className="w-4 h-4 text-purple-500" />
                                <span className="text-xs text-slate-500">#{i + 1} más usada</span>
                                <span className="ml-auto text-xs font-bold text-slate-700">{e.use_count}x</span>
                            </div>
                            <p className="text-sm font-medium text-slate-800 truncate">{e.question}</p>
                        </div>
                    ))}
                </div>
            )}

            {showAdd && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-3">
                    <h3 className="font-semibold text-purple-800 text-sm">Nueva respuesta manual</h3>
                    <input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Pregunta del cliente..."
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    <textarea value={newA} onChange={e => setNewA(e.target.value)} placeholder="Respuesta del bot..." rows={3}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    <div className="flex gap-2">
                        <button onClick={addEntry} disabled={saving}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60 flex items-center gap-2">
                            {saving && <Loader2 className="w-3 h-3 animate-spin" />} Guardar
                        </button>
                        <button onClick={() => setShowAdd(false)} className="text-slate-500 text-sm px-4 py-2 rounded-lg hover:bg-slate-100">Cancelar</button>
                    </div>
                </div>
            )}

            {!loading && (
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pregunta o respuesta..."
                        className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
            )}

            {!loading && entries.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                    <Bot className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">No hay entradas en la base de conocimiento.</p>
                    <p className="text-xs mt-1">Las respuestas se aprenden automáticamente al resolver conversaciones.</p>
                </div>
            )}

            <div className="space-y-3">
                {filtered.map(entry => {
                    const confColor = entry.confidence_score >= 0.85 ? 'text-green-600 bg-green-100'
                        : entry.confidence_score >= 0.70 ? 'text-yellow-600 bg-yellow-100' : 'text-red-600 bg-red-100';
                    return (
                        <div key={entry.id} className="bg-white border rounded-xl p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 mb-2">💬 {entry.question}</p>
                                    {editing === entry.id ? (
                                        <div className="space-y-2">
                                            <textarea value={editAnswer} onChange={e => setEditAnswer(e.target.value)} rows={3}
                                                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                            <div className="flex gap-2">
                                                <button onClick={() => saveEdit(entry.id)} disabled={saving}
                                                    className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                                                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Guardar
                                                </button>
                                                <button onClick={() => setEditing(null)} className="text-xs text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancelar</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">🤖 {entry.answer}</p>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditing(entry.id); setEditAnswer(entry.answer); }}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => deleteEntry(entry.id)}
                                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confColor}`}>{Math.round(entry.confidence_score * 100)}% conf.</span>
                                    <span className="text-xs text-slate-400">{entry.use_count} usos</span>
                                </div>
                            </div>
                            <div className="mt-3">
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${entry.confidence_score >= 0.85 ? 'bg-green-400' : entry.confidence_score >= 0.70 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                        style={{ width: `${entry.confidence_score * 100}%` }} />
                                </div>
                                {entry.source_conversation_id && (
                                    <p className="text-xs text-slate-400 mt-1">Aprendido de conversación #{entry.source_conversation_id.slice(0, 8)}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
