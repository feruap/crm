'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ArrowRightLeft, History, Users, Info } from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface EscalationRule {
    id: number;
    name: string;
    description: string | null;
    condition_type: string;
    condition_config: Record<string, unknown>;
    target_type: string;
    target_id: string | null;
    target_role: string | null;
    priority: number;
    generate_summary: boolean;
    is_active: boolean;
    times_triggered: string;
    created_at: string;
}

interface HandoffEvent {
    id: number;
    conversation_id: string;
    from_handler: string;
    to_agent_id: string | null;
    trigger_reason: string;
    ai_summary: string | null;
    customer_name: string | null;
    agent_name: string | null;
    rule_name: string | null;
    created_at: string;
}

interface SegmentGroup {
    segment_type: string;
    segment_value: string;
    customer_count: string;
    avg_lifetime_spend: string | null;
}

interface FormData {
    name: string;
    description: string;
    condition_type: string;
    condition_config: string; // JSON string for keywords etc.
    target_type: string;
    target_id: string;
    target_role: string;
    priority: number;
    generate_summary: boolean;
}

const CONDITION_TYPES = [
    { value: 'keyword_match', label: 'Palabras clave' },
    { value: 'explicit_request', label: 'Solicitud de humano' },
    { value: 'purchase_intent', label: 'Intención de compra' },
    { value: 'discount_request', label: 'Solicita descuento' },
    { value: 'complaint', label: 'Queja / Reclamo' },
    { value: 'order_issue', label: 'Problema con pedido' },
    { value: 'vip_customer', label: 'Cliente VIP' },
    { value: 'sentiment_negative', label: 'Sentimiento negativo' },
    { value: 'technical_question', label: 'Pregunta técnica' },
];

const TARGET_TYPES = [
    { value: 'any_available', label: 'Cualquier agente disponible' },
    { value: 'agent_group', label: 'Grupo de agentes' },
    { value: 'specific_agent', label: 'Agente específico' },
    { value: 'supervisor', label: 'Supervisor' },
];

const emptyForm: FormData = {
    name: '',
    description: '',
    condition_type: 'keyword_match',
    condition_config: '{}',
    target_type: 'any_available',
    target_id: '',
    target_role: '',
    priority: 0,
    generate_summary: true,
};

// ─────────────────────────────────────────────
// Condition Type Badge
// ─────────────────────────────────────────────

function ConditionBadge({ type }: { type: string }) {
    const colors: Record<string, string> = {
        keyword_match: 'bg-purple-100 text-purple-700',
        explicit_request: 'bg-orange-100 text-orange-700',
        purchase_intent: 'bg-green-100 text-green-700',
        discount_request: 'bg-yellow-100 text-yellow-700',
        complaint: 'bg-red-100 text-red-700',
        order_issue: 'bg-red-100 text-red-700',
        vip_customer: 'bg-amber-100 text-amber-700',
        sentiment_negative: 'bg-rose-100 text-rose-700',
        technical_question: 'bg-blue-100 text-blue-700',
    };
    const label = CONDITION_TYPES.find(c => c.value === type)?.label || type;
    return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[type] || 'bg-slate-100 text-slate-600'}`}>
            {label}
        </span>
    );
}

// ─────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────

type TabId = 'rules' | 'handoff-log' | 'segments';

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function EscalationRulesPage() {
    const { authFetch } = useAuth();
    const [tab, setTab] = useState<TabId>('rules');
    const [rules, setRules] = useState<EscalationRule[]>([]);
    const [handoffs, setHandoffs] = useState<HandoffEvent[]>([]);
    const [segments, setSegments] = useState<SegmentGroup[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [recalculating, setRecalculating] = useState(false);

    useEffect(() => {
        fetchRules();
    }, []);

    useEffect(() => {
        if (tab === 'handoff-log') fetchHandoffs();
        if (tab === 'segments') fetchSegments();
    }, [tab]);

    // ── Data Fetching ──

    async function fetchRules() {
        try {
            const res = await authFetch(`${API_URL}/api/escalation-rules`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setError(err.error || `Error cargando reglas (${res.status})`);
                setRules([]);
                return;
            }
            const data = await res.json();
            setRules(Array.isArray(data) ? data : []);
        } catch { setError('Error de conexión al cargar reglas'); setRules([]); }
    }

    async function fetchHandoffs() {
        try {
            const res = await authFetch(`${API_URL}/api/escalation-rules/handoff-log?limit=100`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setError(err.error || `Error cargando historial (${res.status})`);
                setHandoffs([]);
                return;
            }
            const data = await res.json();
            setHandoffs(Array.isArray(data) ? data : []);
        } catch { setError('Error de conexión al cargar historial'); setHandoffs([]); }
    }

    async function fetchSegments() {
        try {
            const res = await authFetch(`${API_URL}/api/escalation-rules/segments`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setError(err.error || `Error cargando segmentos (${res.status})`);
                setSegments([]);
                return;
            }
            const data = await res.json();
            setSegments(Array.isArray(data) ? data : []);
        } catch { setError('Error de conexión al cargar segmentos'); setSegments([]); }
    }

    // ── Form Handlers ──

    function openCreate() {
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(true);
        setError('');
    }

    function openEdit(r: EscalationRule) {
        setForm({
            name: r.name,
            description: r.description || '',
            condition_type: r.condition_type,
            condition_config: JSON.stringify(r.condition_config || {}, null, 2),
            target_type: r.target_type,
            target_id: r.target_id || '',
            target_role: r.target_role || '',
            priority: r.priority,
            generate_summary: r.generate_summary,
        });
        setEditingId(r.id);
        setShowForm(true);
        setError('');
    }

    async function handleSave() {
        if (!form.name || !form.condition_type) {
            setError('Nombre y tipo de condición son requeridos');
            return;
        }

        let parsedConfig: Record<string, unknown> = {};
        try {
            parsedConfig = JSON.parse(form.condition_config || '{}');
        } catch {
            setError('La configuración de condición debe ser JSON válido');
            return;
        }

        setSaving(true);
        setError('');

        const body = {
            name: form.name,
            description: form.description || null,
            condition_type: form.condition_type,
            condition_config: parsedConfig,
            target_type: form.target_type,
            target_id: form.target_id || null,
            target_role: form.target_role || null,
            priority: form.priority,
            generate_summary: form.generate_summary,
        };

        try {
            const url = editingId
                ? `${API_URL}/api/escalation-rules/${editingId}`
                : `${API_URL}/api/escalation-rules`;

            const res = await authFetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.json();
                setError(err.error || 'Error guardando');
                return;
            }

            setShowForm(false);
            fetchRules();
        } catch {
            setError('Error de conexión');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('¿Eliminar esta regla de escalación?')) return;
        try {
            await authFetch(`${API_URL}/api/escalation-rules/${id}`, { method: 'DELETE' });
            fetchRules();
        } catch {
            setError('Error eliminando');
        }
    }

    async function handleToggleActive(rule: EscalationRule) {
        try {
            await authFetch(`${API_URL}/api/escalation-rules/${rule.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !rule.is_active }),
            });
            fetchRules();
        } catch {
            setError('Error cambiando estado');
        }
    }

    async function handleRecalculate() {
        setRecalculating(true);
        try {
            const res = await authFetch(`${API_URL}/api/escalation-rules/recalculate`, { method: 'POST' });
            const data = await res.json();
            alert(`Segmentos recalculados: ${data.updated} clientes actualizados`);
            fetchSegments();
        } catch {
            setError('Error recalculando segmentos');
        } finally {
            setRecalculating(false);
        }
    }

    // ── Tab buttons ──

    const tabs: { id: TabId; label: string; icon: typeof ArrowRightLeft }[] = [
        { id: 'rules', label: 'Reglas', icon: ArrowRightLeft },
        { id: 'handoff-log', label: 'Historial Handoff', icon: History },
        { id: 'segments', label: 'Segmentos', icon: Users },
    ];

    return (
        <div className="p-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Escalación & Handoff</h1>
                    <p className="text-slate-500 mt-1">
                        Reglas de transferencia bot → humano, historial y segmentos de clientes.
                    </p>
                </div>
                {tab === 'rules' && (
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        <Plus size={18} />
                        Nueva Regla
                    </button>
                )}
                {tab === 'segments' && (
                    <button
                        onClick={handleRecalculate}
                        disabled={recalculating}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
                    >
                        {recalculating ? 'Calculando...' : 'Recalcular Segmentos'}
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-slate-200">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                            tab === t.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <t.icon size={16} />
                        {t.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* ═══ RULES TAB ═══ */}
            {tab === 'rules' && (
                <>
                    {/* Instructions */}
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-start gap-3">
                            <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-800 space-y-1">
                                <p className="font-semibold">¿Cómo funcionan las reglas de escalación?</p>
                                <p>Cada regla define <strong>cuándo</strong> transferir una conversación del bot a un agente humano. El bot evalúa todas las reglas activas en orden de <strong>prioridad</strong> (mayor número = se evalúa primero). La primera regla que coincida activa la transferencia.</p>
                                <p><strong>Tipo de condición:</strong> Define qué detectar — palabras clave, intención de compra, quejas, clientes VIP, etc.</p>
                                <p><strong>Configuración JSON:</strong> Para "Palabras clave", usa <code className="bg-blue-100 px-1 rounded">{`{"keywords": ["palabra1", "palabra2"]}`}</code>. Para "Cliente VIP", usa <code className="bg-blue-100 px-1 rounded">{`{"min_lifetime_spend": 50000}`}</code>.</p>
                                <p><strong>Destino:</strong> A quién se transfiere — cualquier agente, un grupo (por rol), un agente específico, o supervisor.</p>
                            </div>
                        </div>
                    </div>

                    {/* Form */}
                    {showForm && (
                        <div className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4">
                                {editingId ? 'Editar Regla' : 'Nueva Regla de Escalación'}
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="Ej: Transferir quejas a supervisor"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Condición</label>
                                    <select
                                        value={form.condition_type}
                                        onChange={e => setForm({ ...form, condition_type: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {CONDITION_TYPES.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Destino</label>
                                    <select
                                        value={form.target_type}
                                        onChange={e => setForm({ ...form, target_type: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {TARGET_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad</label>
                                    <input
                                        type="number"
                                        value={form.priority}
                                        onChange={e => setForm({ ...form, priority: Number(e.target.value) })}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {(form.target_type === 'specific_agent') && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">ID del Agente</label>
                                        <input
                                            type="text"
                                            value={form.target_id}
                                            onChange={e => setForm({ ...form, target_id: e.target.value })}
                                            placeholder="UUID del agente"
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}

                                {(form.target_type === 'agent_group' || form.target_type === 'supervisor') && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Rol del Agente</label>
                                        <input
                                            type="text"
                                            value={form.target_role}
                                            onChange={e => setForm({ ...form, target_role: e.target.value })}
                                            placeholder="Ej: supervisor, admin, ventas"
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                                    <input
                                        type="text"
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                        placeholder="Descripción opcional de la regla"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Configuración de Condición (JSON)
                                    </label>
                                    <textarea
                                        value={form.condition_config}
                                        onChange={e => setForm({ ...form, condition_config: e.target.value })}
                                        rows={4}
                                        placeholder={'{\n  "keywords": ["descuento", "precio especial"]\n}'}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">
                                        keyword_match: {`{"keywords": [...]}`} · vip_customer: {`{"min_lifetime_spend": 50000}`}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, generate_summary: !form.generate_summary })}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            form.generate_summary ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                                        }`}
                                    >
                                        {form.generate_summary ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                        {form.generate_summary ? 'Generar resumen IA al transferir' : 'Sin resumen IA'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                                >
                                    {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
                                </button>
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="bg-slate-100 text-slate-600 px-6 py-2 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Rules Table */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Regla</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Condición</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Destino</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridad</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Activaciones</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rules.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                            No hay reglas de escalación. Crea una para definir cuándo transferir conversaciones a humanos.
                                        </td>
                                    </tr>
                                )}
                                {rules.map(r => (
                                    <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${!r.is_active ? 'opacity-50' : ''}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-medium text-slate-800">{r.name}</span>
                                                {r.description && (
                                                    <span className="text-xs text-slate-400 line-clamp-1">{r.description}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <ConditionBadge type={r.condition_type} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-slate-600">
                                                {TARGET_TYPES.find(t => t.value === r.target_type)?.label || r.target_type}
                                            </span>
                                            {r.target_role && (
                                                <span className="text-xs text-slate-400 ml-1">({r.target_role})</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-sm font-mono text-slate-600">{r.priority}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-sm font-semibold text-slate-700">{r.times_triggered || 0}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleToggleActive(r)} title="Toggle estado">
                                                {r.is_active ? (
                                                    <ToggleRight size={22} className="text-green-500 mx-auto" />
                                                ) : (
                                                    <ToggleLeft size={22} className="text-slate-300 mx-auto" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEdit(r)}
                                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil size={16} className="text-slate-400" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(r.id)}
                                                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} className="text-red-400" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ═══ HANDOFF LOG TAB ═══ */}
            {tab === 'handoff-log' && (
                <>
                <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <div className="flex items-start gap-3">
                        <Info size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-indigo-800 space-y-1">
                            <p className="font-semibold">Historial de transferencias</p>
                            <p>Aquí puedes ver cada vez que el bot transfirió una conversación a un agente humano. Incluye la regla que se activó, la razón, el agente asignado, y un resumen generado por IA del contexto de la conversación. Usa este historial para identificar patrones y ajustar tus reglas de escalación.</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Regla</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Razón</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Agente Asignado</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Resumen IA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {handoffs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                        No hay eventos de handoff registrados todavía.
                                    </td>
                                </tr>
                            )}
                            {handoffs.map(h => (
                                <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-slate-500">
                                            {new Date(h.created_at).toLocaleString('es-MX', {
                                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-slate-700">{h.customer_name || '—'}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-slate-600">{h.rule_name || 'Manual'}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-sm text-slate-600 line-clamp-2 max-w-xs">{h.trigger_reason || '—'}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-slate-700">{h.agent_name || 'Sin asignar'}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {h.ai_summary ? (
                                            <p className="text-xs text-slate-500 line-clamp-3 max-w-sm">{h.ai_summary}</p>
                                        ) : (
                                            <span className="text-xs text-slate-300">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                </>
            )}

            {/* ═══ SEGMENTS TAB ═══ */}
            {tab === 'segments' && (
                <>
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-start gap-3">
                        <Info size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-emerald-800 space-y-1">
                            <p className="font-semibold">Segmentos de clientes</p>
                            <p>Los segmentos clasifican automáticamente a tus clientes según su <strong>ciclo de vida</strong> (nuevo, activo, en riesgo, dormido), <strong>nivel de valor</strong> (VIP, alto, medio, bajo) y <strong>reorden</strong> (vencido, próximo, no aplica). Haz clic en "Recalcular" para actualizar los segmentos con los datos más recientes de compras. Los segmentos se usan en las reglas de escalación (ej: regla "Cliente VIP").</p>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {segments.length === 0 && (
                        <div className="md:col-span-2 lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center text-slate-400">
                            No hay segmentos calculados. Haz clic en "Recalcular Segmentos" para generar.
                        </div>
                    )}
                    {/* Group segments by type */}
                    {['lifecycle_stage', 'value_tier', 'reorder_due'].map(segType => {
                        const typeSegments = segments.filter(s => s.segment_type === segType);
                        if (typeSegments.length === 0) return null;

                        const typeLabels: Record<string, string> = {
                            lifecycle_stage: 'Ciclo de Vida',
                            value_tier: 'Nivel de Valor',
                            reorder_due: 'Reorden',
                        };

                        const valueColors: Record<string, string> = {
                            new: 'bg-green-100 text-green-700',
                            active: 'bg-blue-100 text-blue-700',
                            at_risk: 'bg-yellow-100 text-yellow-700',
                            dormant: 'bg-orange-100 text-orange-700',
                            churned: 'bg-red-100 text-red-700',
                            prospect: 'bg-slate-100 text-slate-600',
                            vip: 'bg-amber-100 text-amber-700',
                            high: 'bg-emerald-100 text-emerald-700',
                            medium: 'bg-blue-100 text-blue-700',
                            low: 'bg-slate-100 text-slate-600',
                            overdue: 'bg-red-100 text-red-700',
                            due_soon: 'bg-yellow-100 text-yellow-700',
                            not_due: 'bg-green-100 text-green-700',
                        };

                        return (
                            <div key={segType} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">{typeLabels[segType] || segType}</h3>
                                <div className="space-y-2">
                                    {typeSegments.map(s => (
                                        <div key={s.segment_value} className="flex items-center justify-between">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${valueColors[s.segment_value] || 'bg-slate-100 text-slate-600'}`}>
                                                {s.segment_value}
                                            </span>
                                            <div className="text-right">
                                                <span className="text-sm font-semibold text-slate-800">{s.customer_count}</span>
                                                <span className="text-xs text-slate-400 ml-1">clientes</span>
                                                {s.avg_lifetime_spend && (
                                                    <div className="text-xs text-slate-400">
                                                        Prom: ${parseFloat(s.avg_lifetime_spend).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                </>
            )}
        </div>
    );
}
