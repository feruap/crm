'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { Users, Plus, Edit2, Shield, CheckCircle, XCircle, X } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

interface Agent {
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

export default function AgentsPage() {
    const { authFetch, agent: currentAgent, hasRole } = useAuth();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editAgent, setEditAgent] = useState<Agent | null>(null);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'operador' });
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const isDirector = hasRole('director');

    const fetchAgents = useCallback(async () => {
        try {
            const res = await authFetch(`${API}/api/auth/agents`);
            if (res.ok) {
                setAgents(await res.json());
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    useEffect(() => {
        fetchAgents();
    }, [fetchAgents]);

    const openCreate = () => {
        setModalMode('create');
        setEditAgent(null);
        setForm({ name: '', email: '', password: '', role: 'operador' });
        setFormError('');
        setShowModal(true);
    };

    const openEdit = (a: Agent) => {
        setModalMode('edit');
        setEditAgent(a);
        setForm({ name: a.name, email: a.email, password: '', role: a.role });
        setFormError('');
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setSaving(true);
        try {
            if (modalMode === 'create') {
                const res = await authFetch(`${API}/api/auth/register`, {
                    method: 'POST',
                    body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role }),
                });
                const data = await res.json();
                if (!res.ok) {
                    setFormError(data.error || 'Error al crear agente');
                    return;
                }
            } else if (editAgent) {
                const body: Record<string, string | boolean> = { name: form.name };
                if (isDirector) body.role = form.role;
                const res = await authFetch(`${API}/api/auth/agents/${editAgent.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) {
                    setFormError(data.error || 'Error al actualizar');
                    return;
                }
            }
            setShowModal(false);
            fetchAgents();
        } catch {
            setFormError('Error de conexion');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (a: Agent) => {
        try {
            await authFetch(`${API}/api/auth/agents/${a.id}`, {
                method: 'PUT',
                body: JSON.stringify({ active: !a.is_active }),
            });
            fetchAgents();
        } catch {
            // silent
        }
    };

    const roleBadge = (role: string) => {
        switch (role) {
            case 'director': return 'bg-purple-100 text-purple-700';
            case 'gerente': return 'bg-blue-100 text-blue-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Agentes</h1>
                    <p className="text-sm text-slate-500 mt-1">Gestion del equipo de trabajo</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" /> Nuevo Agente
                </button>
            </div>

            {loading ? (
                <div className="text-center text-slate-400 py-12">Cargando...</div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Nombre</th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Email</th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Rol</th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Estado</th>
                                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Desde</th>
                                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agents.map(a => (
                                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                                                <Users className="w-4 h-4 text-slate-500" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-800">{a.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{a.email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${roleBadge(a.role)}`}>
                                            {a.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {a.is_active ? (
                                            <span className="flex items-center gap-1 text-xs text-green-600">
                                                <CheckCircle className="w-3.5 h-3.5" /> Activo
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs text-slate-400">
                                                <XCircle className="w-3.5 h-3.5" /> Inactivo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-400">
                                        {new Date(a.created_at).toLocaleDateString('es-MX')}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => openEdit(a)}
                                                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {isDirector && a.id !== currentAgent?.id && (
                                                <button
                                                    onClick={() => toggleActive(a)}
                                                    className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${
                                                        a.is_active ? 'text-red-400 hover:text-red-600' : 'text-green-400 hover:text-green-600'
                                                    }`}
                                                    title={a.is_active ? 'Desactivar' : 'Activar'}
                                                >
                                                    {a.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {agents.length === 0 && (
                        <div className="text-center text-slate-400 py-12 text-sm">No hay agentes registrados</div>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">
                                {modalMode === 'create' ? 'Nuevo Agente' : 'Editar Agente'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {formError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    required
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {modalMode === 'create' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                            required
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Contrasena</label>
                                        <input
                                            type="password"
                                            value={form.password}
                                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                            required
                                            minLength={6}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                                <select
                                    value={form.role}
                                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                    disabled={!isDirector}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                >
                                    <option value="operador">Operador</option>
                                    <option value="gerente">Gerente</option>
                                    {isDirector && <option value="director">Director</option>}
                                </select>
                                <p className="text-xs text-slate-400 mt-1">
                                    {form.role === 'director' && 'Acceso total: analytics, configuracion, agentes'}
                                    {form.role === 'gerente' && 'Acceso a campanas, productos, bot, escalacion, agentes'}
                                    {form.role === 'operador' && 'Acceso a conversaciones, ordenes, comisiones'}
                                </p>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    {saving ? 'Guardando...' : modalMode === 'create' ? 'Crear' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
