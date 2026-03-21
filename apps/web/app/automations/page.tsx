'use client';

import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
const {
    Bot, Search, Trash2, Edit2, Check, TrendingUp, Plus, Loader2, Zap, X, Users, GitBranch
} = Lucide as any;
import { useAuth } from '../../components/AuthProvider';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

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

export default function AutomationsPage() {
    const [tab, setTab] = useState<'flujos' | 'conocimiento' | 'enrutamiento'>('flujos');

    return (
        <div>
            <div className="border-b bg-white px-6 flex gap-1 pt-4 sticky top-0 z-10">
                {[
                    { key: 'flujos', label: 'Reglas de Flujo Automático', icon: <Zap className="w-4 h-4" /> },
                    { key: 'conocimiento', label: 'Base de Conocimiento (RAG)', icon: <Bot className="w-4 h-4" /> },
                    { key: 'enrutamiento', label: 'Enrutamiento de Agentes', icon: <Users className="w-4 h-4" /> },
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

            {tab === 'flujos' && <FlujosTab />}
            {tab === 'conocimiento' && <ConocimientoTab />}
            {tab === 'enrutamiento' && <GruposAgentesTab />}
        </div>
    );
}

// ── Flujos Tab (New Automations UI) ───────────────────────────────────────────
function FlujosTab() {
    const { authFetch } = useAuth();
    const [rules, setRules] = useState<any[]>([]);
    const [visualFlows, setVisualFlows] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const defaultRule = {
        name: '',
        trigger_type: 'new_conversation',
        conditions: { has_attribution: false, active_order_days: 0 },
        actions: { type: 'menu_options', options: [] as string[], prompt: '* FLUJO PRINCIPAL: Preséntale OBLIGATORIAMENTE un menú con: 1. Ventas (promociones, última compra), 2. Envíos (rastreo), 3. Información Técnica (manuales, videos adaptados).' },
        is_active: true
    };

    const [newRule, setNewRule] = useState(defaultRule);

    useEffect(() => {
        fetchAutomations();
        fetchVisualFlows();
    }, []);

    const fetchAutomations = async () => {
        try {
            const res = await authFetch(`${API_URL}/api/automations`);
            if (res.ok) {
                const data = await res.json();
                setRules(data);
            }
        } catch (error) {
            console.error('Failed to fetch automations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchVisualFlows = async () => {
        try {
            const res = await authFetch(`${API_URL}/api/flows`);
            if (res.ok) {
                const data = await res.json();
                setVisualFlows(data.filter((f: any) => f.flow_type === 'visual'));
            }
        } catch {}
    };

    const handleDeleteVisualFlow = async (id: string) => {
        if (!confirm('¿Eliminar este flujo visual?')) return;
        await authFetch(`${API_URL}/api/flows/${id}`, { method: 'DELETE' });
        fetchVisualFlows();
    };

    const handleSaveRule = async () => {
        try {
            const isEdit = editingId !== null;
            const url = isEdit ? `${API_URL}/api/automations/${editingId}` : `${API_URL}/api/automations`;
            const method = isEdit ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRule)
            });
            if (res.ok) {
                setIsAdding(false);
                setEditingId(null);
                fetchAutomations();
            }
        } catch (error) {
            console.error('Error saving automation:', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Seguro de eliminar este flujo?')) return;
        try {
            const res = await authFetch(`${API_URL}/api/automations/${id}`, { method: 'DELETE' });
            if (res.ok) fetchAutomations();
        } catch (error) {
            console.error('Error deleting automation:', error);
        }
    };

    const handleEdit = (rule: any) => {
        setNewRule({
            name: rule.name,
            trigger_type: rule.trigger_type,
            conditions: rule.conditions || defaultRule.conditions,
            actions: rule.actions || defaultRule.actions,
            is_active: rule.is_active
        });
        setEditingId(rule.id);
        setIsAdding(true);
    };

    const cancelEdit = () => {
        setNewRule(defaultRule);
        setEditingId(null);
        setIsAdding(false);
    };

    return (
        <div style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
            {/* ── Visual Flows Section ───────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', fontWeight: '800' }}>Flujos Visuales (n8n) 🔀</h1>
                    <p style={{ color: '#64748b', margin: 0 }}>Editor visual de flujos: configura qué pasa con cada canal, botón y acción.</p>
                </div>
                <Link
                    href="/automations/flow-editor"
                    style={{
                        background: '#8b5cf6', color: 'white', padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                    <GitBranch size={16} /> Crear Flujo Visual
                </Link>
            </div>

            {visualFlows.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                    {visualFlows.map((f: any) => (
                        <div key={f.id} style={{ background: 'white', border: '2px solid #ddd6fe', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{f.name}</h3>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ background: '#ede9fe', color: '#7c3aed', padding: '0.2rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.65rem', fontWeight: 'bold' }}>VISUAL</span>
                                    <span style={{ background: f.is_active ? '#dcfce7' : '#fee2e2', color: f.is_active ? '#166534' : '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.65rem', fontWeight: 'bold' }}>
                                        {f.is_active ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                Trigger: {f.trigger_type} · {(f.nodes || []).length} nodos
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                                <Link href={`/automations/flow-editor?id=${f.id}`} style={{ background: '#f1f5f9', color: '#334155', textDecoration: 'none', padding: '0.5rem', borderRadius: '0.5rem', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px', flex: 1, justifyContent: 'center' }}>
                                    <Edit2 size={16} /> Editar
                                </Link>
                                <button onClick={() => handleDeleteVisualFlow(f.id)} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.5rem', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px', flex: 1, justifyContent: 'center' }}>
                                    <Trash2 size={16} /> Eliminar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {visualFlows.length === 0 && (
                <div style={{ background: '#faf5ff', border: '1px dashed #c4b5fd', borderRadius: '1rem', padding: '2rem', textAlign: 'center', marginBottom: '3rem' }}>
                    <p style={{ color: '#7c3aed', fontWeight: 'bold', marginBottom: '0.5rem' }}>Sin flujos visuales</p>
                    <p style={{ color: '#8b5cf6', fontSize: '0.85rem' }}>Crea un flujo visual para programar visualmente qué sucede cuando un cliente te contacta por cada canal.</p>
                </div>
            )}

            {/* ── Simple Rules Section ──────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', fontWeight: '800' }}>Reglas Simples ⚡</h2>
                    <p style={{ color: '#64748b', margin: 0 }}>Reglas básicas del bot basadas en condiciones de origen.</p>
                </div>
                <button
                    onClick={() => { setNewRule(defaultRule); setEditingId(null); setIsAdding(true); }}
                    style={{
                        background: '#2563eb', color: 'white', padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                    <Plus size={16} /> Nueva Regla Simple
                </button>
            </div>

            {isAdding && (
                <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '2rem', animation: 'fadeIn 0.3s ease' }}>
                    <h3 style={{ marginTop: 0 }}>{editingId ? 'Editar Flujo' : 'Crear Nuevo Flujo'}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Nombre del Flujo</label>
                            <input
                                value={newRule.name}
                                onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                                placeholder="Ej. Bienvenida sin Atribución..."
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Disparador (Trigger)</label>
                            <select
                                value={newRule.trigger_type}
                                onChange={e => setNewRule({ ...newRule, trigger_type: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                                <option value="new_conversation">Nueva Conversación de Cliente</option>
                                <option value="abandoned_cart">Carrito Abandonado</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                                <input type="checkbox" checked={newRule.is_active} onChange={e => setNewRule({ ...newRule, is_active: e.target.checked })} />
                                Flujo Activo
                            </label>
                        </div>

                        <div style={{ gridColumn: '1 / -1', background: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                            <h4 style={{ marginTop: 0 }}>Condiciones de Origen (Atribución):</h4>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <input
                                    type="checkbox"
                                    checked={newRule.conditions.has_attribution}
                                    onChange={e => setNewRule({ ...newRule, conditions: { ...newRule.conditions, has_attribution: e.target.checked } })}
                                />
                                El cliente viene de una Campaña o Post (Atribución)
                            </label>

                            {!newRule.conditions.has_attribution && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                                    Tiene Pedidos Activos en <input type="number"
                                        onChange={e => setNewRule({ ...newRule, conditions: { ...newRule.conditions, active_order_days: parseInt(e.target.value) || 0 } })}
                                        value={newRule.conditions.active_order_days} style={{ width: '60px', padding: '0.25rem', border: '1px solid #ccc', borderRadius: '0.25rem' }} /> últimos días. (0 = no importa)
                                </label>
                            )}
                        </div>

                        <div style={{ gridColumn: '1 / -1', background: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                            <h4 style={{ marginTop: 0 }}>Acciones del Bot e Instrucción (Prompt):</h4>
                            <select
                                value={newRule.actions.type}
                                onChange={e => {
                                    const type = e.target.value;
                                    let defaultPrompt = newRule.actions.prompt;
                                    if (type === 'sales_bot' && (!defaultPrompt || defaultPrompt.includes('* FLUJO'))) defaultPrompt = '* ATRIBUCIÓN DETECTADA: El cliente viene de origin publicitario. Inicia un FLUJO DE VENTAS. Da información sobre el producto de la campaña y luego intentar hacer cross-selling (venta cruzada) o up-selling. Mantén un tono comercial y persuasivo.';
                                    if (type === 'menu_options' && (!defaultPrompt || defaultPrompt.includes('* ATRIBUCIÓN'))) defaultPrompt = '* FLUJO PRINCIPAL: Preséntale un menú con: 1. Ventas, 2. Envíos, 3. Ayuda Técnica.';
                                    if (type === 'support_bot' && (!defaultPrompt || defaultPrompt.includes('* FLUJO'))) defaultPrompt = '* PEDIDO ACTIVO: El cliente tiene un pedido reciente. Mantén una conversación sobre su pedido o dudas de envío.';

                                    setNewRule({ ...newRule, actions: { ...newRule.actions, type, prompt: defaultPrompt } });
                                }}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', marginBottom: '1rem' }}>
                                <option value="menu_options">Mostrar Menú Clásico (Generico o Tienda)</option>
                                <option value="sales_bot">Activar Prompt "Comercial de Cierre" / Up-selling (Campaña/Post)</option>
                                <option value="support_bot">Activar Prompt "Atención al Cliente Post-Venta" (Pedido)</option>
                            </select>

                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>Instrucciones Personalizadas (Prompt para el AI):</label>
                            <textarea
                                value={newRule.actions.prompt || ''}
                                onChange={e => setNewRule({ ...newRule, actions: { ...newRule.actions, prompt: e.target.value } })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', resize: 'vertical' }}
                                rows={6}
                                placeholder="Escribe aquí las instrucciones de comportamiento para el bot..."
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button onClick={handleSaveRule} style={{ background: '#10b981', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                            {editingId ? 'Guardar Cambios' : 'Crear Flujo'}
                        </button>
                        <button onClick={cancelEdit} style={{ background: '#e2e8f0', color: '#475569', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? <div className="p-10 flex"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {rules.map((r: any) => (
                        <div key={r.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{r.name}</h3>
                                <span style={{ background: r.is_active ? '#dcfce7' : '#fee2e2', color: r.is_active ? '#166534' : '#991b1b', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    {r.is_active ? 'ACTIVO' : 'INACTIVO'}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.5rem' }}><strong>Disparador:</strong> {r.trigger_type}</div>
                            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', margin: '0.5rem 0', fontSize: '0.85rem', flex: 1 }}>
                                <strong>Condiciones de Activación:</strong><br />
                                • Origen: {r.conditions?.has_attribution ? 'De Campaña/Post' : 'Orgánico / Tienda'}<br />
                                {!r.conditions?.has_attribution && `• Pedido Reciente: ${r.conditions?.active_order_days ? `<= ${r.conditions?.active_order_days} días` : 'No importa'}`}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                                <strong>Perfil de Bot:</strong> {r.actions?.type === 'sales_bot' ? 'Cierre / Ventas' : r.actions?.type === 'support_bot' ? 'Soporte Post-Venta' : 'Menú Generico'}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                                <button onClick={() => handleEdit(r)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.5rem', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px', flex: 1, justifyContent: 'center' }}>
                                    <Edit2 size={16} /> Editar
                                </button>
                                <button onClick={() => handleDelete(r.id)} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.5rem', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px', flex: 1, justifyContent: 'center' }}>
                                    <Trash2 size={16} /> Eliminar
                                </button>
                            </div>
                        </div>
                    ))}
                    {rules.length === 0 && !isAdding && (
                        <p style={{ color: '#64748b', gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>No hay flujos configurados. Haz clic en "Nuevo Flujo" para empezar.</p>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Grupos de Agentes Tab (reemplaza EnrutamientoTab) ─────────────────────────
function GruposAgentesTab() {
    const { authFetch } = useAuth();
    const [groups, setGroups] = useState<any[]>([]);
    const [channels, setChannels] = useState<any[]>([]);
    const [agents, setAgents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const defaultForm = {
        name: '',
        channel_id: null as string | null,
        strategy: 'round_robin',
        agent_ids: [] as string[],
    };
    const [form, setForm] = useState(defaultForm);

    useEffect(() => {
        Promise.all([
            authFetch(`${API_URL}/api/agent-groups`).then(r => r.json()),
            authFetch(`${API_URL}/api/channels`).then(r => r.json()),
            authFetch(`${API_URL}/api/agents`).then(r => r.json())
        ]).then(([groupsData, channelsData, agentsData]) => {
            setGroups(groupsData || []);
            setChannels(channelsData || []);
            setAgents(agentsData || []);
        }).finally(() => setIsLoading(false));
    }, [authFetch]);

    const fetchGroups = async () => {
        const res = await authFetch(`${API_URL}/api/agent-groups`);
        setGroups(await res.json());
    };

    const handleSave = async () => {
        if (!form.name || form.agent_ids.length === 0) return alert('Nombre y al menos un agente requeridos');

        if (editingId) {
            await authFetch(`${API_URL}/api/agent-groups/${editingId}`, {
                method: 'PATCH',
                body: JSON.stringify(form)
            });
        } else {
            await authFetch(`${API_URL}/api/agent-groups`, {
                method: 'POST',
                body: JSON.stringify(form)
            });
        }

        setIsAdding(false);
        setEditingId(null);
        setForm(defaultForm);
        fetchGroups();
    };

    const handleEdit = (group: any) => {
        setForm({
            name: group.name,
            channel_id: group.channel_id,
            strategy: group.strategy,
            agent_ids: group.members?.map((m: any) => m.id) || [],
        });
        setEditingId(group.id);
        setIsAdding(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este grupo de agentes?')) return;
        await authFetch(`${API_URL}/api/agent-groups/${id}`, { method: 'DELETE' });
        fetchGroups();
    };

    const cancelEdit = () => {
        setForm(defaultForm);
        setEditingId(null);
        setIsAdding(false);
    };

    const toggleAgent = (agentId: string) => {
        setForm(prev => {
            const arr = prev.agent_ids.includes(agentId)
                ? prev.agent_ids.filter(id => id !== agentId)
                : [...prev.agent_ids, agentId];
            return { ...prev, agent_ids: arr };
        });
    };

    const STRATEGY_LABELS: Record<string, string> = {
        round_robin: 'Round Robin (Turnos)',
        least_busy: 'Menos Ocupado',
        random: 'Aleatorio',
    };

    return (
        <div style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', fontWeight: '800' }}>Grupos de Agentes 👥</h1>
                    <p style={{ color: '#64748b', margin: 0 }}>Crea grupos de agentes por canal. Los flujos visuales dirigen clientes a estos grupos.</p>
                </div>
                <button
                    onClick={() => { setForm(defaultForm); setEditingId(null); setIsAdding(true); }}
                    style={{
                        background: '#2563eb', color: 'white', padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                    <Plus size={16} /> Nuevo Grupo
                </button>
            </div>

            {isAdding && (
                <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
                    <h3 style={{ marginTop: 0 }}>{editingId ? 'Editar Grupo' : 'Crear Grupo de Agentes'}</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Nombre del Grupo</label>
                            <input
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                                placeholder="Ej. Ventas GDL, Soporte CDMX..."
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Canal Asociado</label>
                            <select
                                value={form.channel_id || ''}
                                onChange={e => setForm({ ...form, channel_id: e.target.value === '' ? null : e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                                <option value="">Cualquier canal</option>
                                {channels.map(c => <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Estrategia de Asignación</label>
                            <select
                                value={form.strategy}
                                onChange={e => setForm({ ...form, strategy: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                                <option value="round_robin">Round Robin (Turnos)</option>
                                <option value="least_busy">Menos Ocupado</option>
                                <option value="random">Aleatorio</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                        <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Integrantes del Grupo</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                            {agents.map(a => (
                                <label key={a.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                                    background: form.agent_ids.includes(a.id) ? '#dbeafe' : '#f1f5f9',
                                    border: form.agent_ids.includes(a.id) ? '2px solid #3b82f6' : '2px solid transparent',
                                    padding: '0.5rem 1rem', borderRadius: '2rem', transition: 'all 0.15s'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={form.agent_ids.includes(a.id)}
                                        onChange={() => toggleAgent(a.id)}
                                    />
                                    {a.name}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button onClick={handleSave} style={{ background: '#10b981', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                            {editingId ? 'Guardar Cambios' : 'Crear Grupo'}
                        </button>
                        <button onClick={cancelEdit} style={{ background: '#e2e8f0', color: '#475569', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? <div className="p-10 flex"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                    {groups.map((g: any) => (
                        <div key={g.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0 }}>{g.name}</h3>
                                <span style={{ background: g.is_active ? '#dcfce7' : '#fee2e2', color: g.is_active ? '#166534' : '#991b1b', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    {g.is_active ? 'ACTIVO' : 'INACTIVO'}
                                </span>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', margin: '0.5rem 0', fontSize: '0.85rem' }}>
                                <strong>Canal:</strong> {g.channel_name ? `${g.channel_name} (${g.channel_provider})` : 'Cualquier canal'}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem' }}>
                                <strong>Estrategia:</strong> {STRATEGY_LABELS[g.strategy] || g.strategy}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                                <strong>Integrantes ({g.members?.length || 0}):</strong><br />
                                {g.members?.map((m: any) => m.name).join(', ') || 'Sin integrantes'}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                                <button onClick={() => handleEdit(g)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.5rem', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px', flex: 1, justifyContent: 'center' }}>
                                    <Edit2 size={16} /> Editar
                                </button>
                                <button onClick={() => handleDelete(g.id)} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.5rem', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px', flex: 1, justifyContent: 'center' }}>
                                    <Trash2 size={16} /> Eliminar
                                </button>
                            </div>
                        </div>
                    ))}
                    {groups.length === 0 && !isAdding && (
                        <p style={{ color: '#64748b', gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>No hay grupos de agentes configurados. Crea uno para usarlo en los flujos visuales.</p>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Conocimiento Tab (Tabla de RAG) ────────────────
function ConocimientoTab() {
    const { authFetch } = useAuth();
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [showScrape, setShowScrape] = useState(false);
    const [scrapeUrl, setScrapeUrl] = useState('');

    const [editForm, setEditForm] = useState({ question: '', answer: '', upsell: '' });
    const [newForm, setNewForm] = useState({ question: '', answer: '', upsell: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        authFetch(`${API_URL}/api/bot/knowledge`)
            .then(r => r.json())
            .then(setEntries)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [authFetch]);

    const filtered = entries.filter(e =>
        e.question.toLowerCase().includes(search.toLowerCase()) ||
        e.answer.toLowerCase().includes(search.toLowerCase())
    );

    const saveEdit = async (id: string, metadata: any) => {
        setSaving(true);
        try {
            const updatedMetadata = { ...metadata, upsell: editForm.upsell };
            await authFetch(`${API_URL}/api/bot/knowledge/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ question: editForm.question, answer: editForm.answer, metadata: updatedMetadata })
            });
            setEntries(prev => prev.map(e => e.id === id ? { ...e, question: editForm.question, answer: editForm.answer, metadata: updatedMetadata } : e));
            setEditing(null);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const deleteEntry = async (id: string) => {
        if (!confirm('¿Seguro de eliminar esta entrada?')) return;
        setSaving(true);
        try {
            await authFetch(`${API_URL}/api/bot/knowledge/${id}`, { method: 'DELETE' });
            setEntries(prev => prev.filter(e => e.id !== id));
        } finally {
            setSaving(false);
        }
    };

    const addEntry = async () => {
        if (!newForm.question.trim() || !newForm.answer.trim()) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_URL}/api/bot/knowledge`, {
                method: 'POST',
                body: JSON.stringify({ question: newForm.question, answer: newForm.answer })
            });
            const entry = await res.json();

            if (newForm.upsell) {
                // PATCH if there's upsell/metadata right away
                await authFetch(`${API_URL}/api/bot/knowledge/${entry.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ metadata: { upsell: newForm.upsell } })
                });
                entry.metadata = { upsell: newForm.upsell };
            }

            setEntries(prev => [entry, ...prev]);
            setNewForm({ question: '', answer: '', upsell: '' }); setShowAdd(false);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const handleScrape = async () => {
        if (!scrapeUrl.trim()) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_URL}/api/bot/knowledge/scrape`, {
                method: 'POST',
                body: JSON.stringify({ url: scrapeUrl })
            });
            if (res.ok) {
                const data = await res.json();
                setEntries(prev => [data.entry, ...prev]);
                setScrapeUrl(''); setShowScrape(false);
                alert('Página scrapeada y guardada con éxito.');
            } else {
                alert('No se pudo extraer texto de esa URL.');
            }
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const handleSyncWC = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_URL}/api/bot/knowledge/sync-wc`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                alert(`Sincronización completada. Se añadieron ${data.synced} productos.`);
                const r = await authFetch(`${API_URL}/api/bot/knowledge`);
                setEntries(await r.json());
            } else {
                alert('Hubo un error al sincronizar con WooCommerce.');
            }
        } catch (err) {
            console.error(err);
            alert('Error de red al sincronizar.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', fontWeight: '800' }}>Base de Datos RAG 🤖</h1>
                    <p style={{ color: '#64748b', margin: 0 }}>Gestiona la información base que el bot utiliza para generar sus respuestas contextuales.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={handleSyncWC} disabled={saving}
                        style={{ background: '#e2e8f0', color: '#475569', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />} Sincronizar Tienda
                    </button>
                    <button onClick={() => { setShowScrape(v => !v); setShowAdd(false); }}
                        style={{ background: '#e2e8f0', color: '#475569', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Search size={16} /> Scrapear Web
                    </button>
                    <button onClick={() => { setShowAdd(v => !v); setShowScrape(false); }}
                        style={{ background: '#2563eb', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={16} /> Nueva Fila Manual
                    </button>
                </div>
            </div>

            {!loading && (
                <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contexto, productos o información..."
                        style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 3rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1', fontSize: '1rem' }} />
                </div>
            )}

            {showScrape && (
                <div style={{ background: '#fffbeb', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #fde68a', marginBottom: '2rem' }}>
                    <h3 style={{ marginTop: 0, color: '#92400e' }}>Extraer y guardar contenido web</h3>
                    <p style={{ fontSize: '0.85rem', color: '#b45309', marginBottom: '1rem' }}>Ingresa una URL pública. El sistema leerá el texto principal de la página, creará el embedding y lo almacenará para el RAG.</p>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <input value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} placeholder="https://ejemplo.com/producto"
                            style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #fcd34d', fontSize: '0.85rem' }} />
                        <button onClick={handleScrape} disabled={saving} style={{ background: '#d97706', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                            {saving ? 'Cargando...' : 'Scrapear'}
                        </button>
                        <button onClick={() => setShowScrape(false)} style={{ background: 'transparent', color: '#92400e', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Cancelar</button>
                    </div>
                </div>
            )}

            {showAdd && (
                <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
                    <h3 style={{ marginTop: 0 }}>Agregar Información a la Base (RAG)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#475569' }}>Contexto / Nombre / Pregunta:</label>
                            <input value={newForm.question} onChange={e => setNewForm({ ...newForm, question: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} placeholder="Ej: Playera Oversize" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#475569' }}>Info Principal (Para responder):</label>
                            <textarea value={newForm.answer} onChange={e => setNewForm({ ...newForm, answer: e.target.value })} rows={2}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} placeholder="Ej: Material 100% algodón..." />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem', color: '#475569' }}>Upsell / Cross sell / Ofertas (Opcional):</label>
                            <textarea value={newForm.upsell} onChange={e => setNewForm({ ...newForm, upsell: e.target.value })} rows={2}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} placeholder="Ej: Si le gusta ofrécele un pantalón matching." />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button onClick={addEntry} disabled={saving} style={{ background: '#10b981', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Guardar</button>
                        <button onClick={() => setShowAdd(false)} style={{ background: '#e2e8f0', color: '#475569', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Cancelar</button>
                    </div>
                </div>
            )}

            {loading ? <div className="p-10 flex"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
                <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                                <th style={{ padding: '1rem', color: '#475569', fontWeight: 'bold', fontSize: '0.85rem', width: '25%' }}>Contexto / Producto</th>
                                <th style={{ padding: '1rem', color: '#475569', fontWeight: 'bold', fontSize: '0.85rem', width: '40%' }}>Info Principal (RAG)</th>
                                <th style={{ padding: '1rem', color: '#475569', fontWeight: 'bold', fontSize: '0.85rem', width: '25%' }}>Reglas (Upsell/Cross sell)</th>
                                <th style={{ padding: '1rem', color: '#475569', fontWeight: 'bold', fontSize: '0.85rem', width: '10%' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No hay información en la base de datos RAG.</td></tr>
                            ) : filtered.map(entry => (
                                <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    {editing === entry.id ? (
                                        <>
                                            <td style={{ padding: '1rem' }}>
                                                <input value={editForm.question} onChange={e => setEditForm(prev => ({ ...prev, question: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <textarea value={editForm.answer} onChange={e => setEditForm(prev => ({ ...prev, answer: e.target.value }))} rows={2} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <textarea value={editForm.upsell} onChange={e => setEditForm(prev => ({ ...prev, upsell: e.target.value }))} rows={2} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button disabled={saving} onClick={() => saveEdit(entry.id, entry.metadata)} style={{ background: '#10b981', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}><Check size={14} /> Guardar</button>
                                                    <button onClick={() => setEditing(null)} style={{ background: '#e2e8f0', color: '#475569', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>Cancelar</button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td style={{ padding: '1rem', verticalAlign: 'top', fontSize: '0.85rem', color: '#1e293b' }}>
                                                <strong>{entry.question}</strong>
                                                <div style={{ marginTop: '0.25rem', color: '#64748b', fontSize: '0.75rem' }}>Conf: {Math.round(entry.confidence_score * 100)}% | Usos: {entry.use_count}</div>
                                            </td>
                                            <td style={{ padding: '1rem', verticalAlign: 'top', fontSize: '0.85rem', color: '#334155' }}>
                                                {entry.answer}
                                            </td>
                                            <td style={{ padding: '1rem', verticalAlign: 'top', fontSize: '0.85rem', color: '#0f766e', fontStyle: 'italic' }}>
                                                {entry.metadata?.upsell || '-'}
                                            </td>
                                            <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button onClick={() => {
                                                        setEditForm({ question: entry.question, answer: entry.answer, upsell: entry.metadata?.upsell || '' });
                                                        setEditing(entry.id);
                                                    }} style={{ padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><Edit2 size={16} /></button>
                                                    <button onClick={() => deleteEntry(entry.id)} style={{ padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }} disabled={saving}><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

