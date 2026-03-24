'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Image, Link2, Info } from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Campaign {
    id: string;
    name: string;
    platform: string;
    platform_campaign_id: string;
    platform_ad_id?: string;
}

interface CampaignMapping {
    id: number;
    campaign_id: string;
    campaign_name: string;
    campaign_platform: string;
    wc_product_id: number | null;
    product_name: string;
    welcome_message: string;
    media_urls: string[];
    auto_send: boolean;
    is_active: boolean;
    priority: number;
    created_at: string;
    updated_at: string;
}

interface FormData {
    campaign_id: string;
    wc_product_id: string;
    product_name: string;
    welcome_message: string;
    media_urls: string;
    auto_send: boolean;
    priority: number;
}

const emptyForm: FormData = {
    campaign_id: '',
    wc_product_id: '',
    product_name: '',
    welcome_message: '',
    media_urls: '',
    auto_send: true,
    priority: 0,
};

// ─────────────────────────────────────────────
// Platform Badge
// ─────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: string }) {
    const colors: Record<string, string> = {
        facebook: 'bg-blue-100 text-blue-700',
        instagram: 'bg-pink-100 text-pink-700',
        google: 'bg-red-100 text-red-700',
        tiktok: 'bg-slate-100 text-slate-700',
    };
    return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[platform] || 'bg-slate-100 text-slate-600'}`}>
            {platform}
        </span>
    );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function CampaignMappingsPage() {
    const { authFetch } = useAuth();
    const [mappings, setMappings] = useState<CampaignMapping[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Fetch data on mount
    useEffect(() => {
        fetchMappings();
        fetchCampaigns();
    }, []);

    async function fetchMappings() {
        try {
            const res = await authFetch(`${API_URL}/api/campaign-mappings`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setError(err.error || `Error cargando mappings (${res.status})`);
                setMappings([]);
                return;
            }
            const data = await res.json();
            setMappings(Array.isArray(data) ? data : []);
        } catch {
            setError('Error de conexión al cargar mappings');
            setMappings([]);
        }
    }

    async function fetchCampaigns() {
        try {
            const res = await authFetch(`${API_URL}/api/campaigns`);
            if (!res.ok) {
                setCampaigns([]);
                return;
            }
            const data = await res.json();
            setCampaigns(Array.isArray(data) ? data : []);
        } catch {
            console.error('Error fetching campaigns');
            setCampaigns([]);
        }
    }

    function openCreate() {
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(true);
        setError('');
    }

    function openEdit(m: CampaignMapping) {
        setForm({
            campaign_id: m.campaign_id,
            wc_product_id: m.wc_product_id ? String(m.wc_product_id) : '',
            product_name: m.product_name,
            welcome_message: m.welcome_message,
            media_urls: (m.media_urls || []).join('\n'),
            auto_send: m.auto_send,
            priority: m.priority,
        });
        setEditingId(m.id);
        setShowForm(true);
        setError('');
    }

    async function handleSave() {
        if (!form.campaign_id || !form.product_name || !form.welcome_message) {
            setError('Campaña, nombre de producto y mensaje son requeridos');
            return;
        }

        setSaving(true);
        setError('');

        const body = {
            campaign_id: form.campaign_id,
            wc_product_id: form.wc_product_id ? Number(form.wc_product_id) : null,
            product_name: form.product_name,
            welcome_message: form.welcome_message,
            media_urls: form.media_urls.split('\n').map(u => u.trim()).filter(Boolean),
            auto_send: form.auto_send,
            priority: form.priority,
        };

        try {
            const url = editingId
                ? `${API_URL}/api/campaign-mappings/${editingId}`
                : `${API_URL}/api/campaign-mappings`;

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
            fetchMappings();
        } catch {
            setError('Error de conexión');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('¿Eliminar este mapping?')) return;
        try {
            await authFetch(`${API_URL}/api/campaign-mappings/${id}`, { method: 'DELETE' });
            fetchMappings();
        } catch {
            setError('Error eliminando');
        }
    }

    async function handleToggle(id: number) {
        try {
            await authFetch(`${API_URL}/api/campaign-mappings/${id}/toggle`, { method: 'PATCH' });
            fetchMappings();
        } catch {
            setError('Error cambiando estado');
        }
    }

    return (
        <div className="p-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Auto-Respuestas por Campaña</h1>
                    <p className="text-slate-500 mt-1">
                        Asocia campañas con productos para enviar respuestas automáticas cuando un lead llega de un anuncio.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                    <Plus size={18} />
                    Nuevo Mapping
                </button>
            </div>

            {/* Instructions */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                    <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800 space-y-1">
                        <p className="font-semibold">¿Cómo funcionan las auto-respuestas por campaña?</p>
                        <p>Cada mapping asocia una <strong>campaña publicitaria</strong> (Facebook, Instagram, Google, etc.) con un <strong>producto específico</strong>. Cuando un lead llega desde esa campaña, el bot envía automáticamente un mensaje de bienvenida personalizado con información del producto.</p>
                        <p><strong>Campaña:</strong> Selecciona la campaña registrada (se crean automáticamente cuando llegan leads desde anuncios).</p>
                        <p><strong>Producto:</strong> El nombre y opcionalmente el ID de WooCommerce del producto que promociona la campaña.</p>
                        <p><strong>Mensaje de bienvenida:</strong> El mensaje que el bot envía automáticamente al lead. Puede incluir info del producto, precios, y un call-to-action.</p>
                        <p><strong>URLs de medios:</strong> Imágenes o PDFs que se envían junto con el mensaje (una URL por línea).</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Form Modal */}
            {showForm && (
                <div className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">
                        {editingId ? 'Editar Mapping' : 'Nuevo Mapping'}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Campaign selector */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Campaña</label>
                            <select
                                value={form.campaign_id}
                                onChange={e => setForm({ ...form, campaign_id: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Seleccionar campaña...</option>
                                {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>
                                        [{c.platform}] {c.name || c.platform_campaign_id}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Product name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Producto</label>
                            <input
                                type="text"
                                value={form.product_name}
                                onChange={e => setForm({ ...form, product_name: e.target.value })}
                                placeholder="Ej: Kit Antidoping 5 Paneles"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* WC Product ID */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">WooCommerce Product ID (opcional)</label>
                            <input
                                type="number"
                                value={form.wc_product_id}
                                onChange={e => setForm({ ...form, wc_product_id: e.target.value })}
                                placeholder="Ej: 1234"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad</label>
                            <input
                                type="number"
                                value={form.priority}
                                onChange={e => setForm({ ...form, priority: Number(e.target.value) })}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Welcome message - full width */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Mensaje de Bienvenida</label>
                            <textarea
                                value={form.welcome_message}
                                onChange={e => setForm({ ...form, welcome_message: e.target.value })}
                                rows={4}
                                placeholder="Ej: ¡Hola! Gracias por tu interés en nuestro Kit Antidoping. Te comparto la ficha técnica..."
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                        </div>

                        {/* Media URLs */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                URLs de Media (una por línea: imágenes, PDFs, videos)
                            </label>
                            <textarea
                                value={form.media_urls}
                                onChange={e => setForm({ ...form, media_urls: e.target.value })}
                                rows={3}
                                placeholder={"https://ejemplo.com/ficha-tecnica.pdf\nhttps://ejemplo.com/producto.jpg"}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                        </div>

                        {/* Auto-send toggle */}
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, auto_send: !form.auto_send })}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    form.auto_send ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                                }`}
                            >
                                {form.auto_send ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                {form.auto_send ? 'Auto-envío activado' : 'Auto-envío desactivado'}
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
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

            {/* Mappings Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Campaña</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Producto</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mensaje</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Media</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Auto-envío</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {mappings.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                    No hay mappings configurados. Crea uno para enviar respuestas automáticas por campaña.
                                </td>
                            </tr>
                        )}
                        {mappings.map(m => (
                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-slate-800">
                                            {m.campaign_name || 'Sin nombre'}
                                        </span>
                                        <PlatformBadge platform={m.campaign_platform} />
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-sm text-slate-700">{m.product_name}</span>
                                    {m.wc_product_id && (
                                        <span className="text-xs text-slate-400 ml-1">#{m.wc_product_id}</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-sm text-slate-600 line-clamp-2 max-w-xs">
                                        {m.welcome_message}
                                    </p>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {m.media_urls && m.media_urls.length > 0 ? (
                                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                            <Image size={14} />
                                            {m.media_urls.length}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-300">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button onClick={() => handleToggle(m.id)} title="Toggle auto-envío">
                                        {m.auto_send ? (
                                            <ToggleRight size={22} className="text-green-500 mx-auto" />
                                        ) : (
                                            <ToggleLeft size={22} className="text-slate-300 mx-auto" />
                                        )}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => openEdit(m)}
                                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Pencil size={16} className="text-slate-400" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(m.id)}
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
        </div>
    );
}
