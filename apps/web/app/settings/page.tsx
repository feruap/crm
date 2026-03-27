"use client";
import React, { useState, useEffect, useCallback } from 'react';
import * as Lucide from 'lucide-react';
const {
    Settings, Brain, Share2, CheckCircle, User, Users, Clock,
    Loader2, ExternalLink, Info, Plus, Trash2, Edit2, X, Copy,
    Check, ChevronDown, ChevronUp, Shield, Zap, Phone,
    Facebook, Instagram, Globe, AlertCircle, Save,
    UserPlus, Lock, ShoppingBag, BarChart2, Link, RefreshCw,
    Eye, EyeOff, ChevronRight, ArrowRightLeft,
} = Lucide as any;

import AssignmentRulesPage from './assignment/page';

import { apiFetch } from '../../hooks/useAuth';

// ── Types ──────────────────────────────────────────────────────────────────────
interface AgentProfile {
    id: string;
    name: string;
    email: string;
    role: string;
    salesking_agent_code: string | null;
    wc_agent_id: string | null;
}

interface Agent {
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    salesking_agent_code: string | null;
    avatar_url: string | null;
    last_login_at: string | null;
    created_at: string;
    active_conversations?: number;
    resolved_today?: number;
}

interface Team {
    id: string;
    name: string;
    description: string | null;
    color: string;
    member_count: number;
    members: Agent[] | null;
}

interface Channel {
    id: string;
    name: string;
    provider: 'whatsapp' | 'facebook' | 'instagram' | 'tiktok';
    subtype: string | null;
    is_active: boolean;
    sync_comments: boolean;
    has_token: boolean;
    has_webhook_secret: boolean;
    page_id: string | null;
    phone_number_id: string | null;
    ig_account_id: string | null;
    tiktok_open_id: string | null;
    created_at: string;
}

interface BusinessHour {
    id: number;
    day_of_week: number;
    day_name: string;
    is_open: boolean;
    open_time: string;
    close_time: string;
}

const PROVIDER_META = {
    whatsapp: {
        label: 'WhatsApp Business',
        color: 'bg-green-500',
        icon: '💬',
        fields: ['phone_number_id', 'whatsapp_number', 'access_token', 'webhook_secret'],
        subtypes: null,
        setupLink: 'https://developers.facebook.com/apps/',
        setupInstructions: [
            '1. Ve a Meta for Developers y crea una App de tipo Empresa.',
            '2. Añade el producto WhatsApp a tu App.',
            '3. Copia el "Identificador del número de teléfono" (Phone Number ID).',
            '4. Ingresa tu Número de WhatsApp con código de país (ej: 521234567890).',
            '5. Genera un Token de Acceso Permanente en la configuración del sistema.',
            '6. Configura el Webhook usando la URL provista arriba y el Verify Token.'
        ]
    },
    facebook: {
        label: 'Facebook',
        color: 'bg-blue-600',
        icon: '📘',
        fields: ['page_id', 'page_username', 'access_token', 'app_secret', 'webhook_secret'],
        subtypes: [
            { value: 'messenger', label: 'Messenger (DMs)' },
            { value: 'feed', label: 'Feed (comentarios en posts/anuncios)' },
        ],
        setupLink: 'https://developers.facebook.com/apps/',
        setupInstructions: [
            '1. Ve a Meta for Developers y crea una App.',
            '2. Añade el producto Messenger (para DMs) o configuración de Webhooks (para Feed).',
            '3. En configuración, suscríbete a los eventos de tu Página de Facebook (Page ID).',
            '4. Genera un Page Access Token.',
            '5. Copia el App Secret de la configuración básica de tu App.'
        ]
    },
    instagram: {
        label: 'Instagram',
        color: 'bg-pink-500',
        icon: '📸',
        fields: ['ig_account_id', 'ig_username', 'access_token', 'webhook_secret'],
        subtypes: [
            { value: 'chat', label: 'Direct (mensajes directos)' },
            { value: 'comments', label: 'Comentarios en posts/anuncios' },
        ],
        setupLink: 'https://developers.facebook.com/apps/',
        setupInstructions: [
            '1. Asegúrate de que tu cuenta de Instagram sea Profesional y esté vinculada a una Página de Facebook.',
            '2. En Meta for Developers, usa la misma App de Facebook conectada.',
            '3. Habilita el acceso a mensajes usando la Graph API.',
            '4. Usa la herramienta de explorador de API para obtener tu IG Account ID.',
            '5. Usa el mismo Token de Acceso Permanente que el de Facebook.'
        ]
    },
    tiktok: {
        label: 'TikTok for Business',
        color: 'bg-slate-900',
        icon: '🎵',
        fields: ['tiktok_open_id', 'access_token', 'webhook_secret'],
        subtypes: null,
        setupLink: 'https://ads.tiktok.com/marketing_api/docs',
        setupInstructions: [
            '1. Crea una App en TikTok for Developers.',
            '2. Solicita permisos de mensajería (Direct Messages).',
            '3. Obtén el TikTok Open ID de tu perfil.',
            '4. Genera un Access Token para producción.',
            '5. Configura los Webhooks en el panel de TikTok usando tu URL.'
        ]
    },
};

const SUBTYPE_LABELS: Record<string, string> = {
    messenger: '💬 Messenger',
    feed: '📋 Feed',
    chat: '💬 Direct',
    comments: '💬 Comentarios',
};

const FIELD_LABELS: Record<string, string> = {
    page_id: 'Page ID',
    page_username: 'Username de la Pagina (para m.me/)',
    phone_number_id: 'Phone Number ID',
    whatsapp_number: 'Numero de WhatsApp (con codigo de pais, ej: 521234567890)',
    ig_account_id: 'Instagram Account ID',
    ig_username: 'Username de Instagram (sin @)',
    tiktok_open_id: 'TikTok Open ID',
    access_token: 'Access Token',
    app_secret: 'App Secret',
    webhook_secret: 'Webhook Secret (verify token)',
};

const TEAM_COLORS = [
    '#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
];

const TIMEZONES = [
    'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Santiago',
    'America/Argentina/Buenos_Aires', 'America/Caracas', 'America/Guayaquil',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/Madrid', 'Europe/London', 'UTC',
];

// ── Main ───────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('perfil');

    // Auto-navigate to integraciones tab when returning from Meta/Google OAuth
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.has('meta') || params.has('meta_error') || params.has('google') || params.has('google_error')) {
            setActiveTab('integraciones');
        }
    }, []);

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar nav */}
            <div className="w-64 bg-white border-r p-6 shrink-0">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-8">
                    <Settings className="w-5 h-5" /> Ajustes
                </h2>
                <nav className="space-y-1">
                    {[
                        { key: 'perfil', label: 'Mi Perfil', icon: <User className="w-4 h-4" /> },
                        { key: 'usuarios', label: 'Usuarios', icon: <UserPlus className="w-4 h-4" /> },
                        { key: 'equipos', label: 'Equipos', icon: <Users className="w-4 h-4" /> },
                        { key: 'canales', label: 'Canales & Webhooks', icon: <Share2 className="w-4 h-4" /> },
                        { key: 'llamadas', label: 'WhatsApp Llamadas', icon: <Phone className="w-4 h-4" /> },
                        { key: 'horarios', label: 'Horarios', icon: <Clock className="w-4 h-4" /> },
                        { key: 'ai', label: 'Configuración IA', icon: <Brain className="w-4 h-4" /> },
                        { key: 'asignacion', label: 'Reglas de Asignación', icon: <ArrowRightLeft className="w-4 h-4" /> },
                        { key: 'respuestas', label: 'Respuestas Rápidas', icon: <Zap className="w-4 h-4" /> },
                        { key: 'integraciones', label: 'Integraciones', icon: <Link className="w-4 h-4" /> },
                        { key: 'bot_knowledge', label: 'Base de Conocimiento', icon: <Brain className="w-4 h-4" /> },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all duration-200
                                ${activeTab === t.key
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 translate-x-1'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto scroll-smooth">
                {activeTab === 'perfil' && <PerfilTab />}
                {activeTab === 'usuarios' && <UsuariosTab />}
                {activeTab === 'equipos' && <EquiposTab />}
                {activeTab === 'canales' && <CanalesTab />}
                {activeTab === 'llamadas' && <LlamadasTab />}
                {activeTab === 'horarios' && <HorariosTab />}
                {activeTab === 'ai' && <AITab />}
                {activeTab === 'bot_knowledge' && <KnowledgeBaseTab />}
                {activeTab === 'asignacion' && <AssignmentRulesPage />}
                {activeTab === 'respuestas' && <QuickRepliesTab />}
                {activeTab === 'integraciones' && <IntegrationsTab />}
            </div>
        </div>
    );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function PerfilTab() {
    const [profile, setProfile] = useState<AgentProfile | null>(null);
    const [name, setName] = useState('');
    const [saleskingCode, setSaleskingCode] = useState('');
    const [wcAgentId, setWcAgentId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiFetch('/api/auth/me')
            .then(r => r.json())
            .then((data: AgentProfile) => {
                setProfile(data);
                setName(data.name);
                setSaleskingCode(data.salesking_agent_code ?? '');
                setWcAgentId(data.wc_agent_id ?? '');
            })
            .catch(() => setError('No se pudo cargar el perfil'))
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true); setError(null);
        try {
            const r = await apiFetch('/api/auth/me', {
                method: 'PATCH',
                body: JSON.stringify({
                    name: name.trim() || undefined,
                    salesking_agent_code: saleskingCode.trim() || null,
                    wc_agent_id: wcAgentId.trim() || null
                }),
            });
            if (!r.ok) throw new Error();
            const updated: AgentProfile = await r.json();
            setProfile(updated); setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch { setError('Error al guardar. Intenta de nuevo.'); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="p-10 flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>;

    return (
        <div className="p-10 max-w-2xl space-y-6">
            <div>
                <h3 className="text-2xl font-bold text-slate-800">Mi Perfil</h3>
                <p className="text-slate-500 text-sm mt-1">Configura tus datos personales y tus integraciones.</p>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Datos personales</h4>
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Nombre</label>
                    <input value={name} onChange={e => setName(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
                    <input value={profile?.email ?? ''} disabled
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400 cursor-not-allowed" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Rol</label>
                    <input value={profile?.role ?? ''} disabled
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400 cursor-not-allowed capitalize" />
                </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">SalesKing — Comisiones</h4>
                    {wcAgentId ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Vinculado (WP #{wcAgentId})
                        </span>
                    ) : (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <Info className="w-3 h-3" /> Sin vincular
                        </span>
                    )}
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex gap-3">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-700 space-y-1">
                        <p><strong>¿Para qué sirve?</strong> El WordPress User ID vincula tu cuenta del CRM con tu usuario de WordPress/SalesKing. Cuando creas un pedido desde el Inbox, el sistema registra la orden a tu nombre para que SalesKing calcule tu comisión automáticamente.</p>
                        <p><strong>¿Dónde encontrarlo?</strong> En WordPress: <code className="bg-blue-100 px-1 rounded">wp-admin → Usuarios → Tu perfil</code>. El ID aparece en la URL: <code className="bg-blue-100 px-1 rounded">user-edit.php?user_id=<strong>XXXX</strong></code></p>
                    </div>
                </div>

                {/* WordPress User ID — campo principal */}
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">WordPress User ID <span className="text-red-400">*</span></label>
                    <input value={wcAgentId} onChange={e => setWcAgentId(e.target.value)}
                        placeholder="ej: 9196630" type="number"
                        className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <p className="text-xs text-slate-400 mt-1">Este ID se inyecta como metadata en cada pedido que crees, permitiendo a SalesKing asignarte la comisión.</p>
                </div>

                {/* Código SalesKing — campo secundario */}
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Código de afiliado SalesKing <span className="text-slate-400 font-normal">(opcional)</span></label>
                    <div className="flex gap-2">
                        <input value={saleskingCode} onChange={e => setSaleskingCode(e.target.value)}
                            placeholder="ej: agente01 o abc123"
                            className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        {saleskingCode && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 px-2">
                                Preview:&nbsp;<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">?affid={saleskingCode}</code>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Se agrega al link de pago como parámetro de afiliado. Encuéntralo en wp-admin → SalesKing → Mi cuenta.</p>
                </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}
            <button onClick={save} disabled={saving}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    : saved ? <><CheckCircle className="w-4 h-4" /> Guardado</>
                        : 'Guardar cambios'}
            </button>
        </div>
    );
}

// ── Equipos Tab ───────────────────────────────────────────────────────────────
function EquiposTab() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Team | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formColor, setFormColor] = useState('#6366f1');
    const [formMembers, setFormMembers] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [tr, ar] = await Promise.all([
                apiFetch('/api/teams').then(r => r.json()),
                apiFetch('/api/agents').then(r => r.json()),
            ]);
            setTeams(tr); setAgents(ar);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setEditing(null);
        setFormName(''); setFormDesc(''); setFormColor('#6366f1'); setFormMembers([]);
        setShowModal(true);
    };
    const openEdit = (t: Team) => {
        setEditing(t);
        setFormName(t.name); setFormDesc(t.description ?? ''); setFormColor(t.color);
        setFormMembers((t.members ?? []).map(m => m.id));
        setShowModal(true);
    };

    const save = async () => {
        if (!formName.trim()) return;
        setSaving(true);
        try {
            let team: Team;
            if (editing) {
                const r = await apiFetch(`/api/teams/${editing.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ name: formName, description: formDesc || null, color: formColor }),
                });
                team = await r.json();
            } else {
                const r = await apiFetch('/api/teams', {
                    method: 'POST',
                    body: JSON.stringify({ name: formName, description: formDesc || null, color: formColor }),
                });
                team = await r.json();
            }
            // Update members
            await apiFetch(`/api/teams/${team.id}/members`, {
                method: 'PUT',
                body: JSON.stringify({ agent_ids: formMembers }),
            });
            setShowModal(false);
            await load();
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const deleteTeam = async (id: string) => {
        if (!confirm('¿Eliminar este equipo?')) return;
        await apiFetch(`/api/teams/${id}`, { method: 'DELETE' });
        setTeams(prev => prev.filter(t => t.id !== id));
    };

    const toggleMember = (id: string) => {
        setFormMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    if (loading) return <div className="p-10 flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>;

    return (
        <div className="p-10 max-w-3xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800">Equipos de Agentes</h3>
                    <p className="text-slate-500 text-sm mt-1">Agrupa agentes para asignación y enrutamiento de conversaciones.</p>
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    <Plus className="w-4 h-4" /> Crear equipo
                </button>
            </div>

            {teams.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">No hay equipos creados.</p>
                    <p className="text-xs mt-1">Crea un equipo para organizar a tus agentes.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {teams.map(team => (
                        <div key={team.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <div className="flex items-center gap-4 p-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                                    style={{ backgroundColor: team.color }}>
                                    {team.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-slate-800">{team.name}</h4>
                                    <p className="text-xs text-slate-400">{team.member_count} miembro{team.member_count !== 1 ? 's' : ''}
                                        {team.description ? ` · ${team.description}` : ''}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {(team.members ?? []).slice(0, 4).map(m => (
                                        <div key={m.id} title={m.name}
                                            className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600 -ml-1 border-2 border-white">
                                            {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                    ))}
                                    {team.member_count > 4 && (
                                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 -ml-1 border-2 border-white">
                                            +{team.member_count - 4}
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => openEdit(team)}
                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setExpanded(expanded === team.id ? null : team.id)}
                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                                    {expanded === team.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                <button onClick={() => deleteTeam(team.id)}
                                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            {expanded === team.id && (
                                <div className="border-t px-4 py-3 bg-slate-50">
                                    {(team.members ?? []).length === 0 ? (
                                        <p className="text-sm text-slate-400">Sin miembros. Edita el equipo para agregar agentes.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {(team.members ?? []).map(m => (
                                                <div key={m.id} className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 text-sm">
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                                                        {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className="text-slate-700">{m.name}</span>
                                                    <span className="text-xs text-slate-400 capitalize">{m.role}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="font-bold text-lg">{editing ? 'Editar equipo' : 'Crear equipo'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del equipo *</label>
                                <input value={formName} onChange={e => setFormName(e.target.value)}
                                    placeholder="ej: Soporte Técnico"
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                                <input value={formDesc} onChange={e => setFormDesc(e.target.value)}
                                    placeholder="ej: Atiende consultas técnicas"
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {TEAM_COLORS.map(c => (
                                        <button key={c} onClick={() => setFormColor(c)}
                                            className={`w-8 h-8 rounded-full border-2 transition-all ${formColor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Miembros ({formMembers.length} seleccionados)
                                </label>
                                <div className="border rounded-xl overflow-hidden divide-y max-h-52 overflow-y-auto">
                                    {agents.filter(a => a.is_active).map(a => (
                                        <label key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                                            <input type="checkbox" checked={formMembers.includes(a.id)} onChange={() => toggleMember(a.id)}
                                                className="rounded" />
                                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                                                {a.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-700">{a.name}</p>
                                                <p className="text-xs text-slate-400">{a.email}</p>
                                            </div>
                                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full capitalize">{a.role}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 p-6 border-t">
                            <button onClick={save} disabled={saving || !formName.trim()}
                                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editing ? 'Guardar cambios' : 'Crear equipo'}
                            </button>
                            <button onClick={() => setShowModal(false)}
                                className="px-6 py-2.5 rounded-lg border text-slate-600 hover:bg-slate-50 font-medium">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Meta API Config Section (inside Canales) ─────────────────────────────────
function MetaConfigSection() {
    const [config, setConfig] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [edits, setEdits] = useState<Record<string, string>>({});

    const loadConfig = useCallback(async () => {
        try {
            const r = await apiFetch('/api/channels/config');
            const data = await r.json();
            setConfig(data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadConfig(); }, [loadConfig]);

    const toggleSecret = (key: string) => {
        setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        if (Object.keys(edits).length === 0) return;
        setSaving(true); setError(null);
        try {
            const r = await apiFetch('/api/channels/config', {
                method: 'PATCH',
                body: JSON.stringify(edits),
            });
            if (!r.ok) throw new Error('Error al guardar');
            setSaved(true);
            setEdits({});
            await loadConfig();
            setTimeout(() => setSaved(false), 3000);
        } catch (e: any) { setError(e.message); }
        finally { setSaving(false); }
    };

    const fields = [
        { key: 'meta_app_id', label: 'Meta App ID', sensitive: false, placeholder: 'ej: 1452652589836082', envKey: 'env_meta_app_id' },
        { key: 'meta_app_secret', label: 'App Secret', sensitive: true, placeholder: 'ej: f4e61d3b5283...', envKey: 'env_meta_app_secret' },
        { key: 'meta_access_token', label: 'Access Token (Permanente)', sensitive: true, placeholder: 'ej: EAAUpLgmZAZAzI...', envKey: 'env_meta_access_token' },
        { key: 'meta_verify_token', label: 'Webhook Verify Token', sensitive: false, placeholder: 'ej: amunet_crm_verify_2024', envKey: 'env_meta_verify_token' },
    ];

    const hasAnyConfig = fields.some(f => config[f.key] || config[f.envKey]);
    const hasEdits = Object.keys(edits).length > 0;

    if (loading) return null;

    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50/50 transition-colors"
            >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-lg shrink-0">
                    🔑
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-800 text-sm">Configuración Meta API</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                        App ID, App Secret, Access Token — credenciales para WhatsApp, Facebook e Instagram
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {hasAnyConfig && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Configurado
                        </span>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t p-5 space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex gap-3">
                        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-700 space-y-1">
                            <p><strong>Estas credenciales se almacenan en la base de datos</strong> y tienen prioridad sobre las variables de entorno. Ya no necesitas modificar archivos <code className="bg-blue-100 px-1 rounded">.env</code> ni Coolify.</p>
                            <p>Las credenciales se usan para validar webhooks, enviar mensajes y sincronizar campañas.</p>
                        </div>
                    </div>

                    {fields.map(field => {
                        const currentValue = config[field.key];
                        const hasEnv = config[field.envKey];
                        const isEditing = edits[field.key] !== undefined;
                        const displayValue = isEditing ? edits[field.key] : (currentValue || '');
                        const isSet = !!currentValue || (field.sensitive && config[`${field.key}_set`]);

                        return (
                            <div key={field.key}>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium text-slate-700">
                                        {field.label}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        {isSet && (
                                            <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium">BD</span>
                                        )}
                                        {hasEnv && !isSet && (
                                            <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">ENV</span>
                                        )}
                                        {field.sensitive && (
                                            <button onClick={() => toggleSecret(field.key)}
                                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                                                {showSecrets[field.key]
                                                    ? <EyeOff className="w-3.5 h-3.5" />
                                                    : <Eye className="w-3.5 h-3.5" />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <input
                                    type={field.sensitive && !showSecrets[field.key] ? 'password' : 'text'}
                                    value={displayValue}
                                    onChange={e => setEdits(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    placeholder={field.placeholder}
                                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                                {isSet && !isEditing && (
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Guardado en BD. Deja vacío para usar variable de entorno como fallback.
                                    </p>
                                )}
                            </div>
                        );
                    })}

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={saving || !hasEdits}
                            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60 text-sm"
                        >
                            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                                : saved ? <><CheckCircle className="w-4 h-4" /> Guardado</>
                                    : <><Save className="w-4 h-4" /> Guardar credenciales</>}
                        </button>
                        {hasEdits && (
                            <button onClick={() => setEdits({})}
                                className="text-sm text-slate-500 hover:text-slate-700">
                                Cancelar cambios
                            </button>
                        )}
                    </div>

                    <div className="bg-slate-50 border rounded-lg px-4 py-3 text-xs text-slate-500 flex gap-2">
                        <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                            Los secretos se almacenan en la base de datos y se enmascaran en la UI. La API nunca expone los valores completos. El sistema usa: <strong>BD → ENV → fallback</strong>.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Canales Tab ───────────────────────────────────────────────────────────────
function CanalesTab() {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [loading, setLoading] = useState(true);
    const [webhookUrls, setWebhookUrls] = useState<Record<string, string>>({});
    const [showModal, setShowModal] = useState<'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | null>(null);
    const [editChannel, setEditChannel] = useState<Channel | null>(null);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    // Form
    const [formName, setFormName] = useState('');
    const [formFields, setFormFields] = useState<Record<string, string>>({});
    const [formSubtype, setFormSubtype] = useState<string>('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [cr, wr] = await Promise.all([
                apiFetch('/api/channels').then(r => r.json()),
                apiFetch('/api/channels/webhook-url').then(r => r.json()),
            ]);
            setChannels(cr); setWebhookUrls(wr);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openNew = (provider: 'whatsapp' | 'facebook' | 'instagram' | 'tiktok') => {
        setEditChannel(null);
        setFormName(''); setFormFields({}); setFormSubtype('');
        setShowModal(provider);
    };

    const openEdit = (ch: Channel) => {
        setEditChannel(ch);
        setFormName(ch.name);
        setFormSubtype(ch.subtype ?? '');
        setFormFields({
            page_id: ch.page_id ?? '',
            phone_number_id: ch.phone_number_id ?? '',
            ig_account_id: ch.ig_account_id ?? '',
            tiktok_open_id: ch.tiktok_open_id ?? '',
        });
        setShowModal(ch.provider);
    };

    const copyUrl = (url: string, key: string) => {
        navigator.clipboard.writeText(url).then(() => {
            setCopied(key); setTimeout(() => setCopied(null), 2000);
        });
    };

    const save = async () => {
        if (!formName.trim() || !showModal) return;
        setSaving(true);
        try {
            const provider_config: Record<string, string> = {};
            PROVIDER_META[showModal].fields.forEach(f => {
                if (formFields[f]) provider_config[f] = formFields[f];
            });

            if (editChannel) {
                await apiFetch(`/api/channels/${editChannel.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ name: formName, provider_config, subtype: formSubtype || null }),
                });
            } else {
                await apiFetch('/api/channels', {
                    method: 'POST',
                    body: JSON.stringify({ name: formName, provider: showModal, provider_config, subtype: formSubtype || null }),
                });
            }
            setShowModal(null);
            await load();
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const deleteChannel = async (id: string) => {
        if (!confirm('¿Desconectar este canal?')) return;
        await apiFetch(`/api/channels/${id}`, { method: 'DELETE' });
        setChannels(prev => prev.filter(c => c.id !== id));
    };

    const toggleActive = async (ch: Channel) => {
        await apiFetch(`/api/channels/${ch.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_active: !ch.is_active }),
        });
        setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, is_active: !c.is_active } : c));
    };

    const existingProviders = channels.map(c => c.provider);

    if (loading) return <div className="p-10 flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>;

    return (
        <div className="p-10 max-w-3xl space-y-8">
            <div>
                <h3 className="text-2xl font-bold text-slate-800">Canales & Webhooks</h3>
                <p className="text-slate-500 text-sm mt-1">Conecta tus canales de mensajería para recibir conversaciones.</p>
            </div>

            {/* Webhook URLs info */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
                <h4 className="font-semibold text-amber-800 text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4" /> URLs de Webhook (configura en Meta/TikTok)
                </h4>
                {[
                    { key: 'meta', label: 'Meta (FB + IG)', url: webhookUrls.meta },
                    { key: 'whatsapp', label: 'WhatsApp Business', url: webhookUrls.whatsapp },
                    { key: 'tiktok', label: 'TikTok for Business', url: webhookUrls.tiktok },
                ].map(({ key, label, url }) => url && (
                    <div key={key} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-amber-700 w-36 shrink-0">{label}:</span>
                        <code className="flex-1 text-xs bg-white border border-amber-200 px-3 py-1.5 rounded-lg text-slate-600 truncate">{url}</code>
                        <button onClick={() => copyUrl(url, key)}
                            className="shrink-0 p-1.5 rounded-lg hover:bg-amber-100 text-amber-600">
                            {copied === key ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                ))}
                {webhookUrls.verify_token && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-amber-700 w-36 shrink-0">Verify Token:</span>
                        <code className="flex-1 text-xs bg-white border border-amber-200 px-3 py-1.5 rounded-lg text-slate-600">{webhookUrls.verify_token}</code>
                        <button onClick={() => copyUrl(webhookUrls.verify_token, 'verify')}
                            className="shrink-0 p-1.5 rounded-lg hover:bg-amber-100 text-amber-600">
                            {copied === 'verify' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                )}
            </div>

            {/* Meta API Configuration */}
            <MetaConfigSection />

            {/* Existing channels */}
            {channels.length > 0 && (
                <div className="space-y-3">
                    <h4 className="font-semibold text-slate-700 text-sm">Canales configurados</h4>
                    {channels.map(ch => {
                        const meta = PROVIDER_META[ch.provider];
                        return (
                            <div key={ch.id} className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4 ${!ch.is_active ? 'opacity-60' : ''}`}>
                                <div className={`w-10 h-10 rounded-xl ${meta.color} flex items-center justify-center text-xl shrink-0`}>
                                    {meta.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h5 className="font-semibold text-slate-800">{ch.name}</h5>
                                        {ch.subtype && (
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                {SUBTYPE_LABELS[ch.subtype] ?? ch.subtype}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-slate-400">{meta.label}</span>
                                        {ch.has_token
                                            ? <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> Token configurado</span>
                                            : <span className="text-xs text-red-500 flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> Sin token</span>}
                                    </div>
                                </div>
                                <button onClick={() => toggleActive(ch)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${ch.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                    {ch.is_active ? 'Activo' : 'Pausado'}
                                </button>
                                <button onClick={() => openEdit(ch)}
                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => deleteChannel(ch.id)}
                                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Connect new channel */}
            <div className="space-y-3">
                <h4 className="font-semibold text-slate-700 text-sm">Conectar canal</h4>
                <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(PROVIDER_META) as Array<keyof typeof PROVIDER_META>).map(provider => {
                        const meta = PROVIDER_META[provider];
                        const hasOne = existingProviders.includes(provider);
                        return (
                            <button key={provider} onClick={() => openNew(provider)}
                                className="flex items-center gap-3 bg-white border rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left shadow-sm group">
                                <div className={`w-10 h-10 rounded-xl ${meta.color} flex items-center justify-center text-xl shrink-0`}>
                                    {meta.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800 text-sm">{meta.label}</p>
                                    <p className="text-xs text-slate-400">{hasOne ? 'Agregar otro' : 'No configurado'}</p>
                                </div>
                                <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Config Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-6 border-b">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl ${PROVIDER_META[showModal].color} flex items-center justify-center text-lg`}>
                                    {PROVIDER_META[showModal].icon}
                                </div>
                                <h3 className="font-bold text-lg">
                                    {editChannel ? 'Editar' : 'Conectar'} {PROVIDER_META[showModal].label}
                                </h3>
                            </div>
                            <button onClick={() => setShowModal(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del canal *</label>
                                <input value={formName} onChange={e => setFormName(e.target.value)}
                                    placeholder={`ej: ${PROVIDER_META[showModal].label} Principal`}
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                            {/* Subtype selector para Facebook e Instagram */}
                            {PROVIDER_META[showModal].subtypes && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de canal *</label>
                                    <div className="space-y-2">
                                        {PROVIDER_META[showModal].subtypes!.map((st: any) => (
                                            <label key={st.value} className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                                <input type="radio" name="subtype" value={st.value}
                                                    checked={formSubtype === st.value}
                                                    onChange={() => setFormSubtype(st.value)} />
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800">{st.label}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    {!formSubtype && <p className="text-xs text-amber-600 mt-1">Selecciona el tipo de canal</p>}
                                </div>
                            )}
                            {/* Setup Instructions */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-slate-800 text-sm">Instrucciones de configuración</h4>
                                    <a href={PROVIDER_META[showModal].setupLink} target="_blank" rel="noreferrer"
                                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                                        Ir al portal <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                                <div className="space-y-1.5 mt-2">
                                    {PROVIDER_META[showModal].setupInstructions.map((step, idx) => (
                                        <p key={idx} className="text-xs text-slate-600">{step}</p>
                                    ))}
                                </div>
                            </div>

                            {/* Campos de configuración */}
                            {PROVIDER_META[showModal].fields.map(field => (
                                <div key={field}>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {FIELD_LABELS[field] ?? field}
                                        {field === 'webhook_secret' && <span className="text-slate-400 font-normal"> (opcional)</span>}
                                    </label>
                                    <input
                                        type={field.includes('token') || field.includes('secret') ? 'password' : 'text'}
                                        value={formFields[field] ?? ''}
                                        onChange={e => setFormFields(prev => ({ ...prev, [field]: e.target.value }))}
                                        placeholder={field.includes('token') ? 'EAAxxxxxxx...' : ''}
                                        className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                </div>
                            ))}
                            <div className="bg-slate-50 border rounded-lg px-4 py-3 text-xs text-slate-500 flex gap-2">
                                <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                Las credenciales se almacenan encriptadas y nunca se exponen en la API.
                            </div>
                        </div>
                        <div className="flex gap-3 p-6 border-t">
                            <button onClick={save}
                                disabled={saving || !formName.trim() || (!!PROVIDER_META[showModal].subtypes && !formSubtype)}
                                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editChannel ? 'Guardar cambios' : 'Conectar canal'}
                            </button>
                            <button onClick={() => setShowModal(null)}
                                className="px-6 py-2.5 rounded-lg border text-slate-600 hover:bg-slate-50 font-medium">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Horarios Tab ──────────────────────────────────────────────────────────────
function HorariosTab() {
    const [hours, setHours] = useState<BusinessHour[]>([]);
    const [timezone, setTimezone] = useState('America/Mexico_City');
    const [afterMsg, setAfterMsg] = useState('');
    const [autoReply, setAutoReply] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        apiFetch('/api/settings/business-hours')
            .then(r => r.json())
            .then(data => {
                setHours(data.hours);
                setTimezone(data.timezone);
                setAfterMsg(data.after_hours_message);
                setAutoReply(data.auto_reply_enabled);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const updateHour = (dayOfWeek: number, field: keyof BusinessHour, value: any) => {
        setHours(prev => prev.map(h => h.day_of_week === dayOfWeek ? { ...h, [field]: value } : h));
    };

    const save = async () => {
        setSaving(true);
        try {
            await apiFetch('/api/settings/business-hours', {
                method: 'PATCH',
                body: JSON.stringify({ hours, timezone, after_hours_message: afterMsg, auto_reply_enabled: autoReply }),
            });
            setSaved(true); setTimeout(() => setSaved(false), 2500);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="p-10 flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>;

    return (
        <div className="p-10 max-w-2xl space-y-6">
            <div>
                <h3 className="text-2xl font-bold text-slate-800">Horarios de Atención</h3>
                <p className="text-slate-500 text-sm mt-1">Define cuándo están disponibles tus agentes y qué responder fuera de horario.</p>
            </div>

            {/* Timezone */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Zona horaria</h4>
                <select value={timezone} onChange={e => setTimezone(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
            </div>

            {/* Weekly schedule */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Horario semanal</h4>
                </div>
                <div className="divide-y">
                    {hours.map(h => (
                        <div key={h.day_of_week} className="flex items-center gap-4 px-6 py-3">
                            <div className="w-28 shrink-0">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <button
                                        onClick={() => updateHour(h.day_of_week, 'is_open', !h.is_open)}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${h.is_open ? 'bg-blue-600' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${h.is_open ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                    <span className={`text-sm font-medium ${h.is_open ? 'text-slate-700' : 'text-slate-400'}`}>{h.day_name}</span>
                                </label>
                            </div>
                            {h.is_open ? (
                                <div className="flex items-center gap-2 flex-1">
                                    <input type="time" value={h.open_time}
                                        onChange={e => updateHour(h.day_of_week, 'open_time', e.target.value)}
                                        className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                                    <span className="text-slate-400 text-sm">–</span>
                                    <input type="time" value={h.close_time}
                                        onChange={e => updateHour(h.day_of_week, 'close_time', e.target.value)}
                                        className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                                </div>
                            ) : (
                                <span className="text-sm text-slate-400 italic flex-1">Cerrado</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* After hours message */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Respuesta automática fuera de horario</h4>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <button onClick={() => setAutoReply(v => !v)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${autoReply ? 'bg-blue-600' : 'bg-slate-300'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoReply ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                        <span className="text-sm text-slate-600">{autoReply ? 'Activa' : 'Inactiva'}</span>
                    </label>
                </div>
                <textarea
                    value={afterMsg}
                    onChange={e => setAfterMsg(e.target.value)}
                    disabled={!autoReply}
                    rows={3}
                    placeholder="ej: Gracias por escribirnos. Nuestro horario es lun-vie 9am-6pm. Te respondemos pronto 🙏"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50 disabled:text-slate-400"
                />
                <p className="text-xs text-slate-400">Este mensaje se envía automáticamente cuando un cliente escribe fuera del horario configurado.</p>
            </div>

            <button onClick={save} disabled={saving}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    : saved ? <><CheckCircle className="w-4 h-4" /> Guardado</>
                        : <><Save className="w-4 h-4" /> Guardar horarios</>}
            </button>
        </div>
    );
}

// ── WhatsApp Llamadas Tab ─────────────────────────────────────────────────────
function LlamadasTab() {
    const [enabled, setEnabled] = useState(false);
    const [callMessage, setCallMessage] = useState('Nos gustaría llamarle para darle seguimiento.');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        apiFetch('/api/settings/calling')
            .then(r => r.json())
            .then((data: any) => {
                setEnabled(!!data.whatsapp_calling_enabled);
                setCallMessage(data.whatsapp_call_message || 'Nos gustaría llamarle para darle seguimiento.');
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            await apiFetch('/api/settings/calling', {
                method: 'POST',
                body: JSON.stringify({ whatsapp_calling_enabled: enabled, whatsapp_call_message: callMessage }),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="p-10 flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>;

    return (
        <div className="p-8 max-w-2xl space-y-6">
            <div>
                <h3 className="text-2xl font-bold text-slate-800">WhatsApp Llamadas</h3>
                <p className="text-slate-500 text-sm mt-1">Configura la función de llamadas de WhatsApp Business para tus agentes.</p>
            </div>

            {/* Important notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 space-y-1">
                    <p className="font-semibold">Nota sobre restricciones de Meta</p>
                    <p>Las llamadas salientes de WhatsApp Business están <strong>bloqueadas para números de EE.UU. y Canadá</strong>. Para usar esta función, debes tener configurado un <strong>número de México u otro país de LATAM</strong> en tu canal de WhatsApp.</p>
                    <p className="text-xs text-amber-600 mt-1">Consulta la documentación de Meta: WhatsApp Business Calling API está disponible en mercados seleccionados.</p>
                </div>
            </div>

            {/* Enable toggle */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold text-slate-700">Habilitar llamadas</h4>
                        <p className="text-sm text-slate-500 mt-0.5">Muestra el botón de llamada en el Inbox para conversaciones de WhatsApp.</p>
                    </div>
                    <button
                        onClick={() => setEnabled(!enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-slate-300'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>

            {/* Call message */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <h4 className="font-semibold text-slate-700">Mensaje de solicitud de llamada</h4>
                <p className="text-sm text-slate-500">Este texto se muestra al cliente cuando el agente solicita permiso para llamarle.</p>
                <textarea
                    value={callMessage}
                    onChange={e => setCallMessage(e.target.value)}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    placeholder="ej: Nos gustaría llamarle para darle seguimiento."
                />
                <p className="text-xs text-slate-400">El cliente verá este mensaje junto con botones para aceptar o rechazar la llamada.</p>
            </div>

            {/* How it works */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700 space-y-1">
                    <p className="font-semibold">¿Cómo funciona?</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-xs">
                        <li>El agente hace clic en el ícono de teléfono en el Inbox.</li>
                        <li>El cliente recibe un mensaje interactivo para aceptar o rechazar la llamada.</li>
                        <li>Al aceptar, WhatsApp inicia la llamada de voz sobre IP.</li>
                        <li>Solo se puede enviar una solicitud cada 24 horas por conversación.</li>
                    </ol>
                </div>
            </div>

            <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'Guardado' : 'Guardar cambios'}
            </button>
        </div>
    );
}

// ── AI Tab ────────────────────────────────────────────────────────────────────
function AITab() {
    const [provider, setProvider] = useState('deepseek');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('');
    const [prompt, setPrompt] = useState('');
    const [temp, setTemp] = useState(0.7);
    const [excludedCategories, setExcludedCategories] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showKey, setShowKey] = useState(false);

    const PROVIDER_LABELS: Record<string, { label: string; badge: string; color: string }> = {
        deepseek: { label: 'DeepSeek', badge: 'DS', color: 'bg-sky-100 text-sky-700 border-sky-200' },
        z_ai: { label: 'Z.ai (Zhipu GLM)', badge: 'GLM', color: 'bg-violet-100 text-violet-700 border-violet-200' },
        claude: { label: 'Claude (Anthropic)', badge: 'AI', color: 'bg-amber-100 text-amber-700 border-amber-200' },
        gemini: { label: 'Gemini (Google)', badge: 'GM', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    };

    const MODELS: Record<string, string[]> = {
        deepseek: ['deepseek-chat', 'deepseek-reasoner'],
        z_ai: ['glm-5-plus', 'glm-5', 'glm-4.7', 'glm-4.6', 'glm-4.5', 'glm-4.5-air'],
        claude: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20251001', 'claude-opus-4-5'],
        gemini: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    };

    useEffect(() => {
        apiFetch('/api/settings/ai')
            .then(r => r.json())
            .then((data: any[]) => {
                if (data.length > 0) {
                    const d = data[0];
                    setProvider(d.provider); setModel(d.model_name ?? '');
                    setPrompt(d.system_prompt ?? ''); setTemp(d.temperature ?? 0.7);
                    setExcludedCategories((d.excluded_categories || []).join(', '));
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            await apiFetch('/api/settings/ai', {
                method: 'POST',
                body: JSON.stringify({
                    provider,
                    apiKey: apiKey || undefined,
                    model,
                    systemPrompt: prompt,
                    temperature: temp,
                    excludedCategories: excludedCategories.split(',').map(c => c.trim()).filter(Boolean)
                }),
            });
            setSaved(true);
            setApiKey(''); // Clear key field after save (key is now stored)
            setTimeout(() => setSaved(false), 3000);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="p-10 flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>;

    const provMeta = PROVIDER_LABELS[provider] ?? { label: provider, badge: '?', color: 'bg-slate-100 text-slate-600 border-slate-200' };

    return (
        <div className="p-8 max-w-3xl space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800">Configuración de IA</h3>
                    <p className="text-slate-500 text-sm mt-1">Configura el proveedor de IA y la personalidad del bot de ventas.</p>
                </div>
                {/* Active provider badge */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${provMeta.color}`}>
                    <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-pulse" />
                    {provMeta.badge} · {model || 'sin modelo'}
                    <span className="ml-1 font-normal opacity-70">activo</span>
                </div>
            </div>

            {/* Provider + Model row */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
                        <select value={provider} onChange={e => { setProvider(e.target.value); setModel(MODELS[e.target.value]?.[0] ?? ''); }}
                            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                            <option value="deepseek">DeepSeek</option>
                            <option value="z_ai">Z.ai (Zhipu GLM)</option>
                            <option value="claude">Claude (Anthropic)</option>
                            <option value="gemini">Gemini (Google)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                        <select value={model} onChange={e => setModel(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                            <option value="">— Seleccionar —</option>
                            {(MODELS[provider] ?? []).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                {/* API Key */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        API Key
                        <span className="ml-2 text-xs font-normal text-slate-400">(deja en blanco para mantener la actual)</span>
                    </label>
                    <div className="relative">
                        <input type={showKey ? 'text' : 'password'} value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder="••••••••••••••••••••••••••••••"
                            className="w-full border rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        <button type="button" onClick={() => setShowKey(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                            {showKey ? 'Ocultar' : 'Ver'}
                        </button>
                    </div>
                    {provider === 'z_ai' && (
                        <p className="text-xs text-violet-600 mt-1">
                            💡 Z.ai: usa el formato <span className="font-mono bg-violet-50 px-1 rounded">AppId.AppSecret</span> — se genera JWT automáticamente.
                        </p>
                    )}
                </div>

                {/* Temperature */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Temperatura: <span className="font-mono text-blue-600">{temp.toFixed(1)}</span>
                        <span className="text-xs text-slate-400 ml-2">
                            {temp <= 0.3 ? '— muy preciso' : temp <= 0.6 ? '— balanceado' : temp <= 0.8 ? '— creativo' : '— muy creativo'}
                        </span>
                    </label>
                    <input type="range" min={0} max={1} step={0.1} value={temp}
                        onChange={e => setTemp(parseFloat(e.target.value))}
                        className="w-full accent-blue-600" />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>0 — Preciso</span><span>0.5 — Balanceado</span><span>1 — Creativo</span>
                    </div>
                </div>

                {/* Excluded categories */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Categorías Excluidas del Catálogo</label>
                    <input type="text" value={excludedCategories} onChange={e => setExcludedCategories(e.target.value)}
                        placeholder="ej: cortesias, ofertas (separadas por coma)"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <p className="text-xs text-slate-500 mt-1">La IA no ofrecerá productos de estas categorías de WooCommerce en sus respuestas.</p>
                </div>
            </div>

            {/* System Prompt */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">System Prompt</label>
                        <p className="text-xs text-slate-400 mt-0.5">Define la identidad, tono, productos y flujo de ventas del bot.</p>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">{prompt.length.toLocaleString()} chars</span>
                </div>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={18}
                    placeholder="Eres el asistente virtual de ventas de [Empresa]..."
                    className="w-full border rounded-lg px-3 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y" />
                <p className="text-xs text-slate-400">
                    El prompt se inyecta en cada conversación junto con el catálogo de productos activo de WooCommerce.
                </p>
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-3 flex-wrap">
                <button onClick={save} disabled={saving}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                        : saved ? <><CheckCircle className="w-4 h-4" /> Guardado</>
                            : 'Guardar configuración'}
                </button>

                <a href="/simulator" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-violet-300 text-violet-700 font-medium text-sm hover:bg-violet-50 transition-colors">
                    <Zap className="w-4 h-4" />
                    Probar en Simulador
                </a>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">¿Cómo funciona el bot?</p>
                <p>1. Cuando llega un mensaje, el sistema busca en la <strong>base de conocimiento</strong> (conversaciones anteriores) si hay respuesta precisa.</p>
                <p>2. Si no encuentra (confianza {'<'} 82%), llama a <strong>{provMeta.label} {model && `(${model})`}</strong> con el system prompt + catálogo.</p>
                <p>3. Usa el <strong>Simulador</strong> para probar el bot antes de activarlo en producción.</p>
            </div>
        </div>
    );
}

// ── Usuarios Tab ──────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    admin: { label: 'Admin', color: 'bg-red-100 text-red-700' },
    supervisor: { label: 'Supervisor', color: 'bg-amber-100 text-amber-700' },
    agent: { label: 'Agente', color: 'bg-blue-100 text-blue-700' },
};

function UsuariosTab() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [editAgent, setEditAgent] = useState<Agent | null>(null);
    const [showReset, setShowReset] = useState<Agent | null>(null);

    // Invite form
    const [iName, setIName] = useState('');
    const [iEmail, setIEmail] = useState('');
    const [iPassword, setIPassword] = useState('');
    const [iRole, setIRole] = useState('agent');
    const [iSK, setISK] = useState('');
    const [iSaving, setISaving] = useState(false);
    const [iError, setIError] = useState('');

    // Edit form
    const [eName, setEName] = useState('');
    const [eRole, setERole] = useState('');
    const [eSK, setESK] = useState('');
    const [eActive, setEActive] = useState(true);
    const [eSaving, setESaving] = useState(false);

    // Reset password
    const [newPass, setNewPass] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [rSaving, setRSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiFetch('/api/agents').then(r => r.json());
            setAgents(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const invite = async () => {
        if (!iName || !iEmail || !iPassword) { setIError('Nombre, email y contraseña son requeridos'); return; }
        setISaving(true); setIError('');
        try {
            await apiFetch('/api/agents', {
                method: 'POST',
                body: JSON.stringify({ name: iName, email: iEmail, password: iPassword, role: iRole, salesking_agent_code: iSK || null }),
            });
            setShowInvite(false);
            setIName(''); setIEmail(''); setIPassword(''); setIRole('agent'); setISK('');
            await load();
        } catch (e: any) { setIError('Error al crear usuario. El email puede ya existir.'); }
        finally { setISaving(false); }
    };

    const openEdit = (a: Agent) => {
        setEditAgent(a);
        setEName(a.name); setERole(a.role); setESK(a.salesking_agent_code ?? ''); setEActive(a.is_active);
    };

    const saveEdit = async () => {
        if (!editAgent) return;
        setESaving(true);
        try {
            await apiFetch(`/api/agents/${editAgent.id}`, {
                method: 'PUT',
                body: JSON.stringify({ name: eName, role: eRole, salesking_agent_code: eSK || null, is_active: eActive }),
            });
            setEditAgent(null);
            await load();
        } catch (e) { console.error(e); }
        finally { setESaving(false); }
    };

    const deactivate = async (a: Agent) => {
        if (!confirm(`¿Desactivar a ${a.name}? Sus conversaciones abiertas quedarán sin asignar.`)) return;
        await apiFetch(`/api/agents/${a.id}`, { method: 'DELETE' });
        await load();
    };

    const resetPassword = async () => {
        if (!showReset || newPass.length < 6) return;
        setRSaving(true);
        try {
            await apiFetch(`/api/agents/${showReset.id}/reset-password`, {
                method: 'POST',
                body: JSON.stringify({ new_password: newPass }),
            });
            setShowReset(null); setNewPass('');
        } catch (e) { console.error(e); }
        finally { setRSaving(false); }
    };

    if (loading) return <div className="p-10 flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>;

    return (
        <div className="p-10 max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800">Usuarios & Agentes</h3>
                    <p className="text-slate-500 text-sm mt-1">Administra el equipo que tiene acceso al CRM.</p>
                </div>
                <button onClick={() => setShowInvite(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                    <UserPlus className="w-4 h-4" /> Invitar Usuario
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">Usuario</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">Rol</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">SalesKing</th>
                            <th className="text-right px-4 py-3 font-medium text-slate-600">Activas</th>
                            <th className="text-right px-4 py-3 font-medium text-slate-600">Resueltas hoy</th>
                            <th className="text-center px-4 py-3 font-medium text-slate-600">Estado</th>
                            <th className="w-24 px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {agents.map(a => {
                            const roleInfo = ROLE_LABELS[a.role] ?? ROLE_LABELS.agent;
                            const initials = a.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                            return (
                                <tr key={a.id} className={`hover:bg-slate-50 ${!a.is_active ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {a.avatar_url ? (
                                                <img src={a.avatar_url} alt={a.name} className="w-8 h-8 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                                                    {initials}
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium text-slate-800">{a.name}</p>
                                                <p className="text-xs text-slate-400">{a.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${roleInfo.color}`}>
                                            {roleInfo.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-mono text-slate-500">
                                        {a.salesking_agent_code ?? <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium">{a.active_conversations ?? 0}</td>
                                    <td className="px-4 py-3 text-right text-slate-500">{a.resolved_today ?? 0}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {a.is_active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => openEdit(a)}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Editar">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => setShowReset(a)}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600" title="Resetear contraseña">
                                                <Lock className="w-3.5 h-3.5" />
                                            </button>
                                            {a.is_active && (
                                                <button onClick={() => deactivate(a)}
                                                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500" title="Desactivar">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Invite Modal */}
            {showInvite && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="font-bold text-lg">Invitar nuevo usuario</h3>
                            <button onClick={() => setShowInvite(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                                    <input value={iName} onChange={e => setIName(e.target.value)} placeholder="Juan Pérez"
                                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                                    <select value={iRole} onChange={e => setIRole(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                                        <option value="agent">Agente</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                                <input value={iEmail} onChange={e => setIEmail(e.target.value)} type="email" placeholder="juan@empresa.com"
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña inicial *</label>
                                <input value={iPassword} onChange={e => setIPassword(e.target.value)} type="password" placeholder="mín. 6 caracteres"
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Código SalesKing <span className="text-slate-400 font-normal">(opcional)</span></label>
                                <input value={iSK} onChange={e => setISK(e.target.value)} placeholder="ej: agent_001"
                                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                            {iError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{iError}</p>}
                        </div>
                        <div className="flex gap-3 p-6 border-t">
                            <button onClick={invite} disabled={iSaving}
                                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                                {iSaving && <Loader2 className="w-4 h-4 animate-spin" />} Crear usuario
                            </button>
                            <button onClick={() => setShowInvite(false)} className="px-6 py-2.5 rounded-lg border text-slate-600 hover:bg-slate-50 font-medium">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editAgent && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="font-bold text-lg">Editar: {editAgent.name}</h3>
                            <button onClick={() => setEditAgent(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                                <input value={eName} onChange={e => setEName(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                                <select value={eRole} onChange={e => setERole(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                                    <option value="agent">Agente</option>
                                    <option value="supervisor">Supervisor</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Código SalesKing</label>
                                <input value={eSK} onChange={e => setESK(e.target.value)} placeholder="ej: agent_001"
                                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                                <input type="checkbox" checked={eActive} onChange={e => setEActive(e.target.checked)} className="rounded" />
                                <div>
                                    <p className="text-sm font-medium text-slate-800">Usuario activo</p>
                                    <p className="text-xs text-slate-500">Desmarca para desactivar el acceso sin eliminar historial</p>
                                </div>
                            </label>
                        </div>
                        <div className="flex gap-3 p-6 border-t">
                            <button onClick={saveEdit} disabled={eSaving}
                                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                                {eSaving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar cambios
                            </button>
                            <button onClick={() => setEditAgent(null)} className="px-6 py-2.5 rounded-lg border text-slate-600 hover:bg-slate-50 font-medium">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showReset && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="font-bold text-lg">Resetear contraseña</h3>
                            <button onClick={() => setShowReset(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-500">Nueva contraseña para <strong>{showReset.name}</strong></p>
                            <div className="relative">
                                <input value={newPass} onChange={e => setNewPass(e.target.value)}
                                    type={showPass ? 'text' : 'password'} placeholder="mín. 6 caracteres"
                                    className="w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                                <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-2.5 text-slate-400">
                                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-3 p-6 border-t">
                            <button onClick={resetPassword} disabled={rSaving || newPass.length < 6}
                                className="flex-1 bg-amber-500 text-white py-2.5 rounded-lg font-medium hover:bg-amber-600 disabled:opacity-60 flex items-center justify-center gap-2">
                                {rSaving && <Loader2 className="w-4 h-4 animate-spin" />} Actualizar contraseña
                            </button>
                            <button onClick={() => setShowReset(null)} className="px-6 py-2.5 rounded-lg border text-slate-600 hover:bg-slate-50 font-medium">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Integraciones Tab ──────────────────────────────────────────────────────────
function IntegracionesTab() {
    const [wcUrl, setWcUrl] = useState('');
    const [wcKey, setWcKey] = useState('');
    const [wcSecret, setWcSecret] = useState('');
    const [wcWebhookSecret, setWcWebhookSecret] = useState('');
    const [wcKeySet, setWcKeySet] = useState(false);
    const [wcSecretSet, setWcSecretSet] = useState(false);
    const [wcWebhookSecretSet, setWcWebhookSecretSet] = useState(false);
    const [skEnabled, setSkEnabled] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<Record<string, string>>({});

    const base = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';

    // Load saved WC config on mount
    useEffect(() => {
        apiFetch('/api/settings/woocommerce').then(async r => {
            if (!r.ok) return;
            const data = await r.json();
            if (data.wc_url) setWcUrl(data.wc_url);
            setWcKeySet(!!data.wc_key_set);
            setWcSecretSet(!!data.wc_secret_set);
            setWcWebhookSecretSet(!!data.wc_webhook_secret_set);
        }).catch(() => {});
    }, []);

    const saveWC = async () => {
        setSaving(true);
        try {
            const body: Record<string, string> = { wc_url: wcUrl };
            // Only send secrets if user typed a new value (not the masked placeholder)
            if (wcKey && wcKey !== '••••••••') body.wc_key = wcKey;
            if (wcSecret && wcSecret !== '••••••••') body.wc_secret = wcSecret;
            if (wcWebhookSecret && wcWebhookSecret !== '••••••••') body.wc_webhook_secret = wcWebhookSecret;
            const r = await apiFetch('/api/settings/woocommerce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (r.ok) {
                setSaved(true); setTimeout(() => setSaved(false), 2500);
                // Refresh mask indicators
                if (body.wc_key) setWcKeySet(true);
                if (body.wc_secret) setWcSecretSet(true);
                if (body.wc_webhook_secret) setWcWebhookSecretSet(true);
                setWcKey(''); setWcSecret(''); setWcWebhookSecret('');
            }
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const testWC = async () => {
        setTesting('wc');
        try {
            const r = await apiFetch('/api/attributions/sync-woocommerce', { method: 'POST' });
            const data = await r.json();
            setTestResult(prev => ({ ...prev, wc: `✅ OK — procesadas: ${data.processed ?? 0}` }));
        } catch (e) {
            setTestResult(prev => ({ ...prev, wc: '❌ Error de conexión' }));
        } finally { setTesting(null); }
    };

    const testGA = async () => {
        setTesting('ga');
        try {
            const r = await apiFetch('/api/attributions/sync-google-ads', { method: 'POST' });
            const data = await r.json();
            setTestResult(prev => ({ ...prev, ga: `✅ OK — procesadas: ${data.processed ?? 0}` }));
        } catch (e) {
            setTestResult(prev => ({ ...prev, ga: '❌ Error de conexión' }));
        } finally { setTesting(null); }
    };

    return (
        <div className="p-10 max-w-3xl space-y-8">
            <div>
                <h3 className="text-2xl font-bold text-slate-800">Integraciones</h3>
                <p className="text-slate-500 text-sm mt-1">Conecta WooCommerce, SalesKing y plataformas de publicidad para el modelo de atribución.</p>
            </div>

            {/* WooCommerce */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white text-lg">🛒</div>
                    <div>
                        <h4 className="font-semibold text-slate-800">WooCommerce</h4>
                        <p className="text-xs text-slate-500">Sincroniza órdenes y atribuciones de campañas</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">URL de la tienda</label>
                        <input value={wcUrl} onChange={e => setWcUrl(e.target.value)}
                            placeholder="https://tutienda.com" type="url"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                Consumer Key {wcKeySet && <span className="text-green-600 font-normal">✓ configurado</span>}
                            </label>
                            <input value={wcKey} onChange={e => setWcKey(e.target.value)}
                                type="password" placeholder={wcKeySet ? '(dejar en blanco para mantener)' : 'ck_xxxxxxx'}
                                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-300" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                Consumer Secret {wcSecretSet && <span className="text-green-600 font-normal">✓ configurado</span>}
                            </label>
                            <input value={wcSecret} onChange={e => setWcSecret(e.target.value)}
                                type="password" placeholder={wcSecretSet ? '(dejar en blanco para mantener)' : 'cs_xxxxxxx'}
                                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-300" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                            Webhook Secret {wcWebhookSecretSet && <span className="text-green-600 font-normal">✓ configurado</span>}
                        </label>
                        <input value={wcWebhookSecret} onChange={e => setWcWebhookSecret(e.target.value)}
                            type="password" placeholder={wcWebhookSecretSet ? '(dejar en blanco para mantener)' : 'Secreto para validar firma HMAC de WooCommerce'}
                            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-300" />
                        <p className="text-xs text-slate-400 mt-1">El mismo valor que pusiste en WC Admin → Webhooks → Secreto. Deja en blanco para omitir validación.</p>
                    </div>
                </div>
                <div className="bg-slate-50 border rounded-lg p-3 text-xs text-slate-600 space-y-1">
                    <p className="font-medium text-slate-700">Webhook WooCommerce → MyAlice</p>
                    <p className="text-slate-500">Configura en WC Admin → Ajustes → Avanzado → Webhooks:</p>
                    <div className="flex items-center gap-2 mt-1">
                        <code className="bg-white border px-2 py-1 rounded text-xs flex-1">{base}/api/attributions/woocommerce-sync</code>
                        <button onClick={() => navigator.clipboard.writeText(`${base}/api/attributions/woocommerce-sync`)}
                            className="p-1.5 rounded hover:bg-slate-200 text-slate-500">
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={saveWC} disabled={saving}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saved ? 'Guardado ✅' : 'Guardar config WC'}
                    </button>
                    <button onClick={testWC} disabled={testing === 'wc'}
                        className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
                        {testing === 'wc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Sincronizar ahora
                    </button>
                    {testResult.wc && <span className="text-xs text-slate-600">{testResult.wc}</span>}
                </div>
            </div>

            {/* SalesKing */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white text-lg">👑</div>
                    <div>
                        <h4 className="font-semibold text-slate-800">SalesKing</h4>
                        <p className="text-xs text-slate-500">Atribuye ventas cerradas por agentes a campañas publicitarias</p>
                    </div>
                    <label className="ml-auto flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={skEnabled} onChange={e => setSkEnabled(e.target.checked)} className="rounded" />
                        <span className="text-sm text-slate-600">Habilitado</span>
                    </label>
                </div>
                {skEnabled && (
                    <div className="bg-slate-50 border rounded-lg p-3 text-xs text-slate-600 space-y-1">
                        <p className="font-medium text-slate-700">Webhook SalesKing → MyAlice</p>
                        <p className="text-slate-500">Configura en SalesKing → Settings → Webhooks:</p>
                        <div className="flex items-center gap-2 mt-1">
                            <code className="bg-white border px-2 py-1 rounded text-xs flex-1">{base}/api/attributions/salesking-sync</code>
                            <button onClick={() => navigator.clipboard.writeText(`${base}/api/attributions/salesking-sync`)}
                                className="p-1.5 rounded hover:bg-slate-200 text-slate-500">
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <p className="text-slate-400 mt-2">Body esperado: <code className="bg-white px-1 rounded">{"{ order_id, order_total, currency, agent_code, customer_email }"}</code></p>
                    </div>
                )}
            </div>

            {/* Google Ads */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white text-lg">🔍</div>
                    <div>
                        <h4 className="font-semibold text-slate-800">Google Ads</h4>
                        <p className="text-xs text-slate-500">Reporta conversiones offline para optimizar campañas</p>
                    </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                    <p className="font-medium">Configura las credenciales en el archivo .env del servidor:</p>
                    <pre className="mt-1 text-slate-600 font-mono">{`GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CONVERSION_ACTION_ID=`}</pre>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={testGA} disabled={testing === 'ga'}
                        className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
                        {testing === 'ga' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Sync Google Ads ahora
                    </button>
                    {testResult.ga && <span className="text-xs text-slate-600">{testResult.ga}</span>}
                </div>
            </div>

            {/* Facebook Ads */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white text-lg">📘</div>
                    <div>
                        <h4 className="font-semibold text-slate-800">Meta Ads (FB + Instagram)</h4>
                        <p className="text-xs text-slate-500">Atribución automática via Click-to-Messenger / Click-to-IG DM</p>
                    </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700">
                    <p className="font-medium">✅ Configuración automática</p>
                    <p className="mt-1">Cuando un cliente llega desde un anuncio de Meta (Click-to-Messenger, Click-to-IG DM),
                        el sistema detecta el <code className="bg-green-100 px-1 rounded">ad_id</code> en el webhook y crea la atribución automáticamente.
                        Solo necesitas tener el canal de Meta configurado.</p>
                </div>
            </div>
        </div>
    );
}

// ── Quick Replies Tab ──────────────────────────────────────────────────────────
interface QuickReply {
    id: string;
    shortcut: string;
    title: string | null;
    content: string;
    scope: 'personal' | 'team' | 'global';
    team_id: string | null;
    use_count: number;
    created_by_name?: string;
}

function QuickRepliesTab() {
    const [replies, setReplies] = useState<QuickReply[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<QuickReply | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [scopeFilter, setScopeFilter] = useState<'all' | 'personal' | 'team' | 'global'>('all');

    // Form fields
    const [fShortcut, setFShortcut] = useState('');
    const [fTitle, setFTitle] = useState('');
    const [fContent, setFContent] = useState('');
    const [fScope, setFScope] = useState<'personal' | 'team' | 'global'>('personal');
    const [formError, setFormError] = useState('');

    const loadReplies = useCallback(async () => {
        setLoading(true);
        try {
            const r = await apiFetch('/api/quick-replies');
            const data = await r.json();
            setReplies(Array.isArray(data) ? data : []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadReplies(); }, [loadReplies]);

    const openCreate = () => {
        setEditing(null);
        setFShortcut(''); setFTitle(''); setFContent(''); setFScope('personal');
        setFormError('');
        setShowModal(true);
    };

    const openEdit = (r: QuickReply) => {
        setEditing(r);
        setFShortcut(r.shortcut); setFTitle(r.title ?? '');
        setFContent(r.content); setFScope(r.scope);
        setFormError('');
        setShowModal(true);
    };

    const save = async () => {
        if (!fShortcut.trim()) { setFormError('El shortcut es requerido'); return; }
        if (!fContent.trim()) { setFormError('El contenido es requerido'); return; }
        setSaving(true); setFormError('');
        try {
            const body = {
                shortcut: fShortcut.trim(),
                content: fContent.trim(),
                title: fTitle.trim() || null,
                scope: fScope,
            };
            if (editing) {
                await apiFetch(`/api/quick-replies/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
            } else {
                await apiFetch('/api/quick-replies', { method: 'POST', body: JSON.stringify(body) });
            }
            setShowModal(false);
            loadReplies();
        } catch (e: any) {
            setFormError(e?.message ?? 'Error al guardar');
        } finally { setSaving(false); }
    };

    const deleteReply = async (id: string) => {
        if (!confirm('¿Eliminar esta respuesta rápida?')) return;
        setDeleting(id);
        try {
            await apiFetch(`/api/quick-replies/${id}`, { method: 'DELETE' });
            setReplies(prev => prev.filter(r => r.id !== id));
        } catch (e) { console.error(e); }
        finally { setDeleting(null); }
    };

    const SCOPE_LABELS: Record<string, string> = {
        personal: 'Personal',
        team: 'Equipo',
        global: 'Global',
    };
    const SCOPE_COLORS: Record<string, string> = {
        personal: 'bg-blue-100 text-blue-700',
        team: 'bg-purple-100 text-purple-700',
        global: 'bg-green-100 text-green-700',
    };

    const filtered = replies.filter(r => scopeFilter === 'all' || r.scope === scopeFilter);

    return (
        <div className="p-10 max-w-4xl space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800">Respuestas Rápidas</h3>
                    <p className="text-slate-500 text-sm mt-1">
                        Crea atajos de texto para responder más rápido. Úsalas en el inbox con el ícono ⚡.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                >
                    <Plus className="w-4 h-4" /> Nueva respuesta
                </button>
            </div>

            {/* Scope filter */}
            <div className="flex gap-2">
                {['all', 'personal', 'team', 'global'].map(s => (
                    <button
                        key={s}
                        onClick={() => setScopeFilter(s as any)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                            ${scopeFilter === s ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}
                    >
                        {s === 'all' ? 'Todas' : SCOPE_LABELS[s]}
                    </button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center gap-2 text-slate-400 py-10">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border rounded-xl p-12 flex flex-col items-center text-slate-400 gap-3">
                    <Zap className="w-10 h-10" />
                    <p className="font-medium">No hay respuestas rápidas</p>
                    <p className="text-sm">Crea una para empezar a ahorrar tiempo</p>
                </div>
            ) : (
                <div className="bg-white border rounded-xl divide-y overflow-hidden">
                    {filtered.map(r => (
                        <div key={r.id} className="flex items-start gap-4 p-4 hover:bg-slate-50 transition-colors">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                <Zap className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <code className="text-sm font-bold text-slate-800">/{r.shortcut}</code>
                                    {r.title && <span className="text-sm text-slate-500">— {r.title}</span>}
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SCOPE_COLORS[r.scope]}`}>
                                        {SCOPE_LABELS[r.scope]}
                                    </span>
                                    {r.use_count > 0 && (
                                        <span className="text-xs text-slate-400">{r.use_count} usos</span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-600 truncate">{r.content}</p>
                                {r.created_by_name && (
                                    <p className="text-xs text-slate-400 mt-0.5">Por {r.created_by_name}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => openEdit(r)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Editar"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => deleteReply(r.id)}
                                    disabled={deleting === r.id}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Eliminar"
                                >
                                    {deleting === r.id
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Trash2 className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-6 border-b">
                            <div className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-amber-500" />
                                <h3 className="font-bold text-lg">
                                    {editing ? 'Editar respuesta rápida' : 'Nueva respuesta rápida'}
                                </h3>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Shortcut <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-300">
                                        <span className="px-3 py-2 bg-slate-50 text-slate-400 text-sm border-r">/</span>
                                        <input
                                            value={fShortcut}
                                            onChange={e => setFShortcut(e.target.value.replace(/\s/g, '_').toLowerCase())}
                                            placeholder="saludo"
                                            className="flex-1 px-3 py-2 text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Título (opcional)</label>
                                    <input
                                        value={fTitle}
                                        onChange={e => setFTitle(e.target.value)}
                                        placeholder="Ej: Saludo inicial"
                                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Contenido <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={fContent}
                                    onChange={e => setFContent(e.target.value)}
                                    rows={4}
                                    placeholder="Hola {{nombre}}, gracias por contactarnos. ¿En qué podemos ayudarte?"
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                                />
                                <p className="text-xs text-slate-400 mt-1">Puedes usar <code>{'{{nombre}}'}</code> como variable dinámica</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Visibilidad</label>
                                <div className="flex gap-2">
                                    {(['personal', 'team', 'global'] as const).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setFScope(s)}
                                            className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors
                                                ${fScope === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {SCOPE_LABELS[s]}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    {fScope === 'personal' && 'Solo tú puedes verla y usarla.'}
                                    {fScope === 'team' && 'Disponible para todos los agentes de tu equipo.'}
                                    {fScope === 'global' && 'Disponible para todos los agentes de la organización.'}
                                </p>
                            </div>

                            {formError && (
                                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {formError}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 p-6 border-t">
                            <button
                                onClick={save}
                                disabled={saving}
                                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editing ? 'Guardar cambios' : 'Crear respuesta'}
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2.5 rounded-lg border text-slate-600 hover:bg-slate-50 font-medium"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Integraciones Tab ─────────────────────────────────────────────────────────
interface MetaTokenStatus {
    configured: boolean;
    valid?: boolean;
    user_name?: string;
    user_id?: string;
    expires_at?: string | null;
    error?: string;
    source?: string;
    oauth_available?: boolean;
}

interface GoogleTokenStatus {
    configured: boolean;
    valid?: boolean;
    user_email?: string;
    user_name?: string;
    error?: string;
    oauth_available?: boolean;
    developer_token_set?: boolean;
    developer_token_masked?: string | null;
    mcc_id?: string | null;
    mcc_id_set?: boolean;
}

function IntegrationsTab() {
    // Meta state
    const [tokenStatus, setTokenStatus] = useState<MetaTokenStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [manualToken, setManualToken] = useState('');
    const [showTokenInput, setShowTokenInput] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [oauthSuccess, setOauthSuccess] = useState(false);

    // Google state
    const [googleStatus, setGoogleStatus] = useState<GoogleTokenStatus | null>(null);
    const [googleLoading, setGoogleLoading] = useState(true);
    const [googleConnecting, setGoogleConnecting] = useState(false);
    const [googleSuccess, setGoogleSuccess] = useState(false);
    const [googleError, setGoogleError] = useState<string | null>(null);
    // Google config editing
    const [devTokenInput, setDevTokenInput] = useState('');
    const [mccIdInput, setMccIdInput] = useState('');
    const [googleConfigSaving, setGoogleConfigSaving] = useState(false);
    const [googleConfigSuccess, setGoogleConfigSuccess] = useState(false);
    const [googleConfigError, setGoogleConfigError] = useState<string | null>(null);

    const loadStatus = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/campaigns/meta-token');
            const data = await res.json();
            setTokenStatus(data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    const loadGoogleStatus = useCallback(async () => {
        setGoogleLoading(true);
        try {
            const res = await apiFetch('/api/campaigns/google-token');
            const data = await res.json();
            setGoogleStatus(data);
        } catch { /* ignore */ }
        finally { setGoogleLoading(false); }
    }, []);

    useEffect(() => { loadStatus(); loadGoogleStatus(); }, [loadStatus, loadGoogleStatus]);

    // Handle OAuth return params (Meta + Google)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const metaResult = params.get('meta');
        const metaErr = params.get('meta_error');
        const googleResult = params.get('google');
        const googleErr = params.get('google_error');

        if (metaResult === 'connected') { setOauthSuccess(true); loadStatus(); }
        if (metaErr) {
            const msgs: Record<string, string> = {
                cancelled: 'Autenticación cancelada.',
                no_app_config: 'META_APP_ID / META_APP_SECRET no configurados en el servidor.',
                token_exchange_failed: 'No se pudo intercambiar el código por un token.',
            };
            setSaveError(msgs[metaErr] || `Error OAuth: ${metaErr}`);
        }

        if (googleResult === 'connected') { setGoogleSuccess(true); loadGoogleStatus(); }
        if (googleErr) {
            setGoogleError(decodeURIComponent(googleErr));
        }

        if (metaResult || metaErr || googleResult || googleErr) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [loadStatus, loadGoogleStatus]);

    const connectOAuth = async () => {
        setConnecting(true);
        setSaveError(null);
        try {
            const res = await apiFetch('/api/campaigns/meta-oauth/start');
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                setSaveError(data.error || 'No se pudo iniciar OAuth');
            }
        } catch { setSaveError('Error al iniciar conexión'); }
        finally { setConnecting(false); }
    };

    const saveManualToken = async () => {
        if (!manualToken.trim()) return;
        setSaving(true); setSaveError(null);
        try {
            const res = await apiFetch('/api/campaigns/meta-token', {
                method: 'POST',
                body: JSON.stringify({ token: manualToken }),
            });
            const data = await res.json();
            if (!res.ok) { setSaveError(data.error); return; }
            setManualToken('');
            setShowTokenInput(false);
            await loadStatus();
        } catch { setSaveError('Error al guardar token'); }
        finally { setSaving(false); }
    };

    const disconnect = async () => {
        if (!confirm('¿Desconectar la integración de Meta Ads?')) return;
        await apiFetch('/api/campaigns/meta-token', { method: 'DELETE' });
        setOauthSuccess(false);
        await loadStatus();
    };

    const connectGoogle = async () => {
        setGoogleConnecting(true);
        setGoogleError(null);
        try {
            const res = await apiFetch('/api/campaigns/google-oauth/start');
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                setGoogleError(data.error || 'No se pudo iniciar OAuth de Google');
            }
        } catch { setGoogleError('Error al conectar con Google'); }
        finally { setGoogleConnecting(false); }
    };

    const disconnectGoogle = async () => {
        if (!confirm('¿Desconectar la integración de Google Ads?')) return;
        await apiFetch('/api/campaigns/google-token', { method: 'DELETE' });
        setGoogleSuccess(false);
        await loadGoogleStatus();
    };

    const saveGoogleConfig = async () => {
        if (!devTokenInput.trim() && !mccIdInput.trim()) return;
        setGoogleConfigSaving(true);
        setGoogleConfigError(null);
        setGoogleConfigSuccess(false);
        try {
            const body: Record<string, string> = {};
            if (devTokenInput.trim()) body.developer_token = devTokenInput.trim();
            if (mccIdInput.trim()) body.mcc_id = mccIdInput.trim();
            const res = await apiFetch('/api/campaigns/google-config', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const d = await res.json();
                setGoogleConfigError(d.error || 'Error al guardar');
                return;
            }
            setDevTokenInput('');
            setMccIdInput('');
            setGoogleConfigSuccess(true);
            await loadGoogleStatus();
            setTimeout(() => setGoogleConfigSuccess(false), 3000);
        } catch { setGoogleConfigError('Error de red al guardar'); }
        finally { setGoogleConfigSaving(false); }
    };

    return (
        <div className="p-10 max-w-3xl space-y-8">
            <div>
                <h3 className="text-2xl font-bold text-slate-800">Integraciones</h3>
                <p className="text-slate-500 text-sm mt-1">Conecta APIs externas para sincronizar datos automáticamente.</p>
            </div>

            {/* Meta Ads API */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">f</div>
                        <div>
                            <h4 className="font-semibold text-slate-800">Meta Ads API</h4>
                            <p className="text-xs text-slate-500">Sincroniza campañas de Facebook & Instagram Ads automáticamente</p>
                        </div>
                    </div>
                    {loading ? null : tokenStatus?.configured && tokenStatus?.valid ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                            <CheckCircle className="w-3.5 h-3.5" /> Conectado
                        </span>
                    ) : tokenStatus?.configured && !tokenStatus?.valid ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
                            <AlertCircle className="w-3.5 h-3.5" /> Token expirado
                        </span>
                    ) : (
                        <span className="text-xs text-slate-400">Sin configurar</span>
                    )}
                </div>

                {oauthSuccess && (
                    <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        Cuenta de Meta Ads conectada correctamente. Token de larga duración guardado.
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Verificando token...
                    </div>
                ) : tokenStatus?.configured && tokenStatus?.valid ? (
                    /* Connected state */
                    <div className="space-y-3">
                        <div className="bg-slate-50 border rounded-lg p-4 text-sm space-y-1.5">
                            <p className="text-slate-700">
                                <span className="font-medium">Usuario:</span> {tokenStatus.user_name}
                                <span className="ml-2 text-xs text-slate-400 font-mono">({tokenStatus.user_id})</span>
                            </p>
                            {tokenStatus.expires_at ? (
                                <p className="text-slate-500 text-xs">
                                    Token expira el {new Date(tokenStatus.expires_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                            ) : (
                                <p className="text-slate-400 text-xs">Sin fecha de expiración registrada</p>
                            )}
                            {tokenStatus.source === 'env' && (
                                <p className="text-amber-600 text-xs flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    Token desde variable de entorno — guárdalo aquí para persistencia.
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setShowTokenInput(v => !v); setSaveError(null); }}
                                className="flex items-center gap-1.5 text-sm text-slate-600 border px-3 py-2 rounded-lg hover:bg-slate-50"
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Renovar token
                            </button>
                            {tokenStatus.oauth_available && (
                                <button
                                    onClick={connectOAuth}
                                    disabled={connecting}
                                    className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-60"
                                >
                                    {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                                    Re-autorizar con Facebook
                                </button>
                            )}
                            <button
                                onClick={disconnect}
                                className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 ml-auto"
                            >
                                <X className="w-3.5 h-3.5" /> Desconectar
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Not connected state */
                    <div className="space-y-3">
                        {tokenStatus?.oauth_available ? (
                            <button
                                onClick={connectOAuth}
                                disabled={connecting}
                                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-60"
                            >
                                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                                Conectar con Facebook
                            </button>
                        ) : null}
                        <button
                            onClick={() => { setShowTokenInput(v => !v); setSaveError(null); }}
                            className="w-full flex items-center justify-center gap-2 border text-slate-600 py-2.5 rounded-xl text-sm hover:bg-slate-50"
                        >
                            <Link className="w-4 h-4" />
                            {tokenStatus?.oauth_available ? 'O pega tu token manualmente' : 'Pegar Access Token de Meta'}
                        </button>
                    </div>
                )}

                {/* Manual token input */}
                {showTokenInput && (
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Access Token de Meta
                                <a
                                    href="https://developers.facebook.com/tools/explorer/"
                                    target="_blank" rel="noreferrer"
                                    className="ml-2 text-xs text-blue-600 hover:underline inline-flex items-center gap-0.5"
                                >
                                    Obtener en Graph API Explorer <ExternalLink className="w-3 h-3" />
                                </a>
                            </label>
                            <input
                                type="password"
                                value={manualToken}
                                onChange={e => setManualToken(e.target.value)}
                                placeholder="EAABsbCS1iHg..."
                                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                Si META_APP_ID/APP_SECRET están configurados, se canjeará por un token de larga duración (~60 días).
                            </p>
                        </div>
                        {saveError && (
                            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
                            </div>
                        )}
                        <button
                            onClick={saveManualToken}
                            disabled={saving || !manualToken.trim()}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar y verificar token
                        </button>
                    </div>
                )}

                {/* OAuth setup guide (shown when OAuth not available) */}
                {!tokenStatus?.oauth_available && !loading && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-2">
                        <p className="font-semibold flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5" /> Para habilitar el flujo OAuth (recomendado):
                        </p>
                        <ol className="list-decimal pl-4 space-y-1 leading-relaxed">
                            <li>Ve a <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="underline font-medium">Meta for Developers</a> → crea una App de tipo Empresa</li>
                            <li>Activa el producto <strong>Marketing API</strong> en la app</li>
                            <li>En <em>Configuración → Básica</em>, copia tu <strong>App ID</strong> y <strong>App Secret</strong></li>
                            <li>Agrega <code className="bg-amber-100 px-1 rounded">META_APP_ID=tu_id</code> y <code className="bg-amber-100 px-1 rounded">META_APP_SECRET=tu_secret</code> al <code className="bg-amber-100 px-1 rounded">.env</code> del servidor</li>
                            <li>En Inicio de sesión con Facebook → Configuración OAuth, agrega: <code className="bg-amber-100 px-1 rounded">http://localhost:3001/api/campaigns/meta-oauth/callback</code></li>
                            <li>Reinicia el servidor y vuelve aquí</li>
                        </ol>
                    </div>
                )}

                {saveError && !showTokenInput && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
                    </div>
                )}
            </div>

            {/* Google Ads API */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border-2 border-slate-200 flex items-center justify-center text-lg font-bold">
                            <span style={{ background: 'linear-gradient(135deg,#4285F4,#EA4335,#FBBC05,#34A853)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>G</span>
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-800">Google Ads API</h4>
                            <p className="text-xs text-slate-500">Sincroniza campañas de Google Search, Display, Shopping y YouTube</p>
                        </div>
                    </div>
                    {googleLoading ? null : googleStatus?.configured && googleStatus?.valid ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                            <CheckCircle className="w-3.5 h-3.5" /> Conectado
                        </span>
                    ) : googleStatus?.configured && !googleStatus?.valid ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
                            <AlertCircle className="w-3.5 h-3.5" /> Token inválido
                        </span>
                    ) : (
                        <span className="text-xs text-slate-400">Sin configurar</span>
                    )}
                </div>

                {googleSuccess && (
                    <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        Cuenta de Google Ads conectada. Refresh token guardado permanentemente.
                    </div>
                )}

                {googleLoading ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
                    </div>
                ) : googleStatus?.configured && googleStatus?.valid ? (
                    /* Google connected state */
                    <div className="space-y-3">
                        <div className="bg-slate-50 border rounded-lg p-4 text-sm space-y-1.5">
                            <p className="text-slate-700"><span className="font-medium">Usuario:</span> {googleStatus.user_name}</p>
                            <p className="text-slate-500 text-xs">{googleStatus.user_email}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={connectGoogle}
                                disabled={googleConnecting}
                                className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-60"
                            >
                                {googleConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                                Re-autorizar con Google
                            </button>
                            <button
                                onClick={disconnectGoogle}
                                className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 ml-auto"
                            >
                                <X className="w-3.5 h-3.5" /> Desconectar
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Google not connected state */
                    <div className="space-y-3">
                        {googleStatus?.oauth_available ? (
                            <button
                                onClick={connectGoogle}
                                disabled={googleConnecting}
                                className="w-full flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 disabled:opacity-60"
                            >
                                {googleConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                    <span className="text-lg font-bold" style={{ background: 'linear-gradient(135deg,#4285F4,#EA4335,#FBBC05,#34A853)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>G</span>
                                )}
                                Conectar con Google Ads
                            </button>
                        ) : null}

                        {/* Setup guide */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-2">
                            <p className="font-semibold flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5" /> Para habilitar Google Ads:
                            </p>
                            <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                                <li>Ve a <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="underline font-medium">console.cloud.google.com</a> → Crea un proyecto nuevo</li>
                                <li>En <strong>APIs y Servicios → Biblioteca</strong>, activa <strong>Google Ads API</strong></li>
                                <li>En <strong>Credenciales</strong> → crea <strong>ID de cliente OAuth 2.0</strong> (tipo: Aplicación web)</li>
                                <li>Agrega URI autorizada: <code className="bg-blue-100 px-1 rounded">http://localhost:3001/api/campaigns/google-oauth/callback</code></li>
                                <li>Copia Client ID y Secret al <code className="bg-blue-100 px-1 rounded">.env</code> del servidor</li>
                                <li>Ingresa el <strong>Developer Token</strong> y <strong>MCC ID</strong> en los campos de abajo</li>
                                <li>Reinicia el servidor y vuelve aquí para conectar</li>
                            </ol>
                        </div>
                    </div>
                )}

                {googleError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 shrink-0" /> {googleError}
                    </div>
                )}

                {/* ── Credenciales de API (siempre visible) ── */}
                <div className="border-t pt-4 space-y-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Credenciales de API</p>

                    {/* Developer Token */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700">Developer Token</label>
                            <a
                                href="https://ads.google.com/aw/apicenter"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                                <ExternalLink className="w-3 h-3" /> Obtener en Google Ads → Centro de API
                            </a>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 space-y-0.5">
                            <p><strong>¿Para qué sirve?</strong> Autoriza el acceso programático a la API de Google Ads. Cada cuenta Manager (MCC) tiene uno único.</p>
                            <p><strong>¿Dónde encontrarlo?</strong> En <a href="https://ads.google.com/aw/apicenter" target="_blank" rel="noreferrer" className="underline font-medium">Google Ads</a> → Herramientas → Centro de API → campo &quot;Token de programador&quot;.</p>
                            {googleStatus?.developer_token_set && (
                                <p className="text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Configurado: <span className="font-mono">{googleStatus.developer_token_masked}</span></p>
                            )}
                        </div>
                        <input
                            type="password"
                            value={devTokenInput}
                            onChange={e => setDevTokenInput(e.target.value)}
                            placeholder={googleStatus?.developer_token_set ? 'Dejar vacío para mantener el actual' : 'Pega aquí el Developer Token…'}
                            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* MCC ID */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700">ID de Cuenta Manager (MCC)</label>
                            <a
                                href="https://ads.google.com/nav/selectaccount"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                                <ExternalLink className="w-3 h-3" /> Ver mis cuentas en Google Ads
                            </a>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 space-y-0.5">
                            <p><strong>¿Para qué sirve?</strong> El ID numérico de tu cuenta Manager permite que el Developer Token acceda a las subcuentas que administra.</p>
                            <p><strong>¿Dónde encontrarlo?</strong> En la esquina superior de <a href="https://ads.google.com" target="_blank" rel="noreferrer" className="underline font-medium">Google Ads</a>, el número de 10 dígitos junto al nombre de la cuenta Manager (ej: 818-483-3199).</p>
                            {googleStatus?.mcc_id_set && (
                                <p className="text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Configurado: <span className="font-mono">{googleStatus.mcc_id}</span></p>
                            )}
                        </div>
                        <input
                            type="text"
                            value={mccIdInput}
                            onChange={e => setMccIdInput(e.target.value)}
                            placeholder={googleStatus?.mcc_id_set ? `Actual: ${googleStatus.mcc_id} — dejar vacío para mantener` : 'Ej: 818-483-3199 o 8184833199'}
                            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {googleConfigSuccess && (
                        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                            <CheckCircle className="w-4 h-4 shrink-0" /> Credenciales guardadas correctamente.
                        </div>
                    )}
                    {googleConfigError && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {googleConfigError}
                        </div>
                    )}

                    <button
                        onClick={saveGoogleConfig}
                        disabled={googleConfigSaving || (!devTokenInput.trim() && !mccIdInput.trim())}
                        className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-40"
                    >
                        {googleConfigSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Guardar credenciales
                    </button>
                </div>
            </div>

            {/* WooCommerce Webhooks */}
            <WooCommerceWebhookSection />
        </div>
    );
}

// ─── WooCommerce Webhook Section ─────────────────────────────────────────────
interface WcWebhook {
    id: number;
    name: string;
    topic: string;
    delivery_url: string;
    status: string;
}

function WooCommerceWebhookSection() {
    const [publicUrl, setPublicUrl] = useState('');
    const [savedUrl, setSavedUrl] = useState<string | null>(null);
    const [webhooks, setWebhooks] = useState<WcWebhook[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadWebhooks = useCallback(async () => {
        setLoading(true);
        try {
            const [whRes, urlRes] = await Promise.all([
                apiFetch('/api/attributions/wc-webhooks'),
                apiFetch('/api/attributions/public-url'),
            ]);
            const whData = await whRes.json();
            const urlData = await urlRes.json();
            setWebhooks(whData.webhooks || []);
            if (urlData.public_url) {
                setSavedUrl(urlData.public_url);
                setPublicUrl(urlData.public_url);
            }
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadWebhooks(); }, [loadWebhooks]);

    const connectWebhook = async () => {
        if (!publicUrl.trim()) { setError('Ingresa la URL pública de tu servidor'); return; }
        setConnecting(true); setError(null); setSuccess(null);
        try {
            const r = await apiFetch('/api/attributions/wc-webhooks', {
                method: 'POST',
                body: JSON.stringify({ public_url: publicUrl.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Error al crear webhooks');
            const created = data.webhooks?.filter((w: any) => w.status === 'created').length || 0;
            const existing = data.webhooks?.filter((w: any) => w.status === 'already_exists').length || 0;
            setSuccess(
                created > 0
                    ? `${created} webhook(s) creado(s) en WooCommerce`
                    : existing > 0
                        ? 'Los webhooks ya estaban configurados'
                        : 'Webhooks configurados'
            );
            setSavedUrl(publicUrl.trim());
            loadWebhooks();
        } catch (err: any) {
            setError(err.message);
        } finally { setConnecting(false); }
    };

    const deleteWebhook = async (id: number) => {
        setDeleting(id);
        try {
            await apiFetch(`/api/attributions/wc-webhooks/${id}`, { method: 'DELETE' });
            setWebhooks(prev => prev.filter(w => w.id !== id));
        } catch { setError('Error al eliminar webhook'); }
        finally { setDeleting(null); }
    };

    const hasActiveWebhooks = webhooks.some(w => w.status === 'active');

    return (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white text-lg">
                    <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-slate-800">WooCommerce Webhooks</h4>
                    <p className="text-xs text-slate-500">Recibe notificaciones automáticas cuando se crean o actualizan pedidos</p>
                </div>
                {hasActiveWebhooks ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Conectado
                    </span>
                ) : (
                    <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-medium">
                        Sin conectar
                    </span>
                )}
            </div>

            {/* Explanation */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex gap-3">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 space-y-1">
                    <p><strong>¿Para qué sirve?</strong> Cuando un cliente completa el pago de un pedido en WooCommerce, el webhook notifica al CRM para actualizar el estado del pedido, registrar la venta y sincronizar la atribución de la campaña.</p>
                    <p><strong>Requisito:</strong> Tu servidor CRM debe ser accesible desde internet. Si estás en desarrollo local, usa un túnel como <code className="bg-blue-100 px-1 rounded">ngrok http 3001</code> o <code className="bg-blue-100 px-1 rounded">cloudflared tunnel</code>.</p>
                </div>
            </div>

            {/* Public URL input */}
            <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                    URL pública del servidor CRM <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                    <input
                        value={publicUrl}
                        onChange={e => setPublicUrl(e.target.value)}
                        placeholder="https://tu-dominio.com o https://xxxx.ngrok.io"
                        type="url"
                        className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                    <button
                        onClick={connectWebhook}
                        disabled={connecting || !publicUrl.trim()}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
                    >
                        {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                        {hasActiveWebhooks ? 'Actualizar' : 'Vincular'}
                    </button>
                </div>
                {savedUrl && (
                    <p className="text-xs text-slate-400 mt-1">
                        Webhook endpoint: <code className="bg-slate-100 px-1 rounded">{savedUrl.replace(/\/$/, '')}/api/attributions/woocommerce-sync</code>
                    </p>
                )}
            </div>

            {/* Status messages */}
            {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" /> {success}
                </div>
            )}

            {/* Active webhooks */}
            {loading ? (
                <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando webhooks...
                </div>
            ) : webhooks.length > 0 ? (
                <div className="border rounded-lg divide-y">
                    {webhooks.map(wh => (
                        <div key={wh.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${wh.status === 'active' ? 'bg-green-500' : 'bg-slate-300'}`} />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-700 truncate">{wh.name}</p>
                                <p className="text-slate-400 truncate">{wh.topic} → {wh.delivery_url}</p>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${wh.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {wh.status}
                            </span>
                            <button
                                onClick={() => deleteWebhook(wh.id)}
                                disabled={deleting === wh.id}
                                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 disabled:opacity-50"
                                title="Eliminar webhook"
                            >
                                {deleting === wh.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </button>
                        </div>
                    ))}
                </div>
            ) : !hasActiveWebhooks && savedUrl ? (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    No se encontraron webhooks activos apuntando a tu servidor. Haz clic en &quot;Vincular&quot; para crearlos.
                </p>
            ) : null}
        </div>
    );
}

// ── Knowledge Base Tab (stub) ─────────────────────────────────────────────────
function KnowledgeBaseTab() {
    return (
        <div className="p-10 max-w-3xl">
            <h3 className="text-2xl font-bold text-slate-800">Base de Conocimiento</h3>
            <p className="text-slate-500 text-sm mt-1">Próximamente disponible.</p>
        </div>
    );
}
