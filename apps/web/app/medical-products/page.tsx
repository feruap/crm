'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, FileText, ChevronDown, ChevronRight, Beaker, Search, Save, X, ExternalLink, DollarSign, FlaskConical, Users, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface MedicalProduct {
    id: number;
    wc_product_id: number | null;
    name: string;
    sku: string;
    diagnostic_category: string;
    clinical_indications: string[];
    sample_type: string;
    sensitivity: string;
    specificity: string;
    result_time: string;
    methodology: string;
    regulatory_approval: string;
    complementary_product_ids: number[];
    complementary_names: string[];
    recommended_profiles: string[];
    contraindications: string;
    interpretation_guide: string;
    storage_conditions: string;
    shelf_life: string;
    technical_sheet_url: string;
    price_range: string;
    is_active: boolean;
    chunk_count: string;
    // New commercial fields
    precio_publico: number | null;
    precio_laboratorio: number | null;
    precio_distribuidor: number | null;
    presentaciones: Array<{ cantidad: number; precio: number }>;
    url_tienda: string | null;
    marca: string | null;
    analito: string | null;
    volumen_muestra: string | null;
    punto_corte: string | null;
    vida_util: string | null;
    registro_sanitario: string | null;
    pitch_venta: string | null;
    ventaja_competitiva: string | null;
    roi_medico: string | null;
    objeciones_respuestas: Array<{ objecion: string; respuesta: string }>;
    palabras_clave: string[];
    cross_sells: number[];
    up_sells: number[];
    target_audience: string;
}

interface FormData {
    wc_product_id: string;
    name: string;
    sku: string;
    diagnostic_category: string;
    clinical_indications: string;
    sample_type: string;
    sensitivity: string;
    specificity: string;
    result_time: string;
    methodology: string;
    regulatory_approval: string;
    complementary_product_ids: string;
    recommended_profiles: string[];
    contraindications: string;
    interpretation_guide: string;
    storage_conditions: string;
    shelf_life: string;
    price_range: string;
    // New commercial fields
    precio_publico: string;
    precio_laboratorio: string;
    precio_distribuidor: string;
    url_tienda: string;
    marca: string;
    analito: string;
    volumen_muestra: string;
    punto_corte: string;
    vida_util: string;
    registro_sanitario: string;
    pitch_venta: string;
    ventaja_competitiva: string;
    roi_medico: string;
    palabras_clave: string;
    target_audience: string;
}

const CATEGORIES = [
    'infecciosas', 'embarazo', 'drogas', 'metabolicas',
    'cardiologicas', 'oncologicas', 'ets', 'respiratorias', 'gastrointestinales',
];

const SAMPLE_TYPES = [
    'sangre_total', 'suero', 'plasma', 'orina', 'hisopo_nasal',
    'hisopo_orofaringeo', 'saliva', 'heces', 'secrecion',
];

const PROFILES = ['laboratorio', 'farmacia', 'consultorio', 'hospital', 'clinica', 'punto_de_venta', 'distribuidor'];

const METHODOLOGIES = ['inmunocromatografia', 'pcr_rapida', 'elisa', 'aglutinacion', 'fluorescencia', 'colorimetrica'];

const TARGET_AUDIENCES = [
    { value: 'ambos', label: 'Médicos y Laboratorios' },
    { value: 'medico', label: 'Solo Médicos' },
    { value: 'laboratorio', label: 'Solo Laboratorios' },
];

const emptyForm: FormData = {
    wc_product_id: '', name: '', sku: '', diagnostic_category: 'infecciosas',
    clinical_indications: '', sample_type: '', sensitivity: '', specificity: '',
    result_time: '', methodology: '', regulatory_approval: '', complementary_product_ids: '',
    recommended_profiles: [], contraindications: '', interpretation_guide: '',
    storage_conditions: '', shelf_life: '', price_range: 'media',
    precio_publico: '', precio_laboratorio: '', precio_distribuidor: '',
    url_tienda: '', marca: '', analito: '', volumen_muestra: '',
    punto_corte: '', vida_util: '', registro_sanitario: '',
    pitch_venta: '', ventaja_competitiva: '', roi_medico: '',
    palabras_clave: '', target_audience: 'ambos',
};

function CategoryBadge({ category }: { category: string }) {
    const colors: Record<string, string> = {
        infecciosas: 'bg-red-100 text-red-700',
        embarazo: 'bg-pink-100 text-pink-700',
        drogas: 'bg-orange-100 text-orange-700',
        metabolicas: 'bg-yellow-100 text-yellow-700',
        cardiologicas: 'bg-purple-100 text-purple-700',
        ets: 'bg-rose-100 text-rose-700',
        respiratorias: 'bg-blue-100 text-blue-700',
        gastrointestinales: 'bg-green-100 text-green-700',
    };
    return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[category] || 'bg-slate-100 text-slate-600'}`}>
            {category}
        </span>
    );
}

function TargetBadge({ target }: { target: string }) {
    const config: Record<string, { bg: string; label: string }> = {
        medico: { bg: 'bg-blue-100 text-blue-700', label: 'Médico' },
        laboratorio: { bg: 'bg-emerald-100 text-emerald-700', label: 'Lab' },
        ambos: { bg: 'bg-slate-100 text-slate-600', label: 'Ambos' },
    };
    const c = config[target] || config.ambos;
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.bg}`}>{c.label}</span>;
}

function formatMXN(val: number | null | undefined): string {
    if (val == null) return '—';
    return `$${Number(val).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

// ─────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────

type ViewTab = 'table' | 'cards';

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function MedicalProductsPage() {
    const { authFetch } = useAuth();
    const [products, setProducts] = useState<MedicalProduct[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [search, setSearch] = useState('');
    const [viewTab, setViewTab] = useState<ViewTab>('table');
    const [inlineEditing, setInlineEditing] = useState<number | null>(null);
    const [inlineValues, setInlineValues] = useState<Record<string, string>>({});

    const fetchProducts = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (categoryFilter) params.set('category', categoryFilter);
            params.set('active_only', 'false');
            const res = await authFetch(`${API_URL}/api/medical-products?${params}`);
            setProducts(await res.json());
        } catch { setError('Error cargando productos'); }
    }, [categoryFilter, authFetch]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    function openCreate() {
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(true);
        setError('');
    }

    function openEdit(p: MedicalProduct) {
        setForm({
            wc_product_id: p.wc_product_id ? String(p.wc_product_id) : '',
            name: p.name, sku: p.sku || '',
            diagnostic_category: p.diagnostic_category,
            clinical_indications: (p.clinical_indications || []).join(', '),
            sample_type: p.sample_type || '',
            sensitivity: p.sensitivity || '',
            specificity: p.specificity || '',
            result_time: p.result_time || '',
            methodology: p.methodology || '',
            regulatory_approval: p.regulatory_approval || '',
            complementary_product_ids: (p.complementary_product_ids || []).join(', '),
            recommended_profiles: p.recommended_profiles || [],
            contraindications: p.contraindications || '',
            interpretation_guide: p.interpretation_guide || '',
            storage_conditions: p.storage_conditions || '',
            shelf_life: p.shelf_life || '',
            price_range: p.price_range || 'media',
            precio_publico: p.precio_publico != null ? String(p.precio_publico) : '',
            precio_laboratorio: p.precio_laboratorio != null ? String(p.precio_laboratorio) : '',
            precio_distribuidor: p.precio_distribuidor != null ? String(p.precio_distribuidor) : '',
            url_tienda: p.url_tienda || '',
            marca: p.marca || '',
            analito: p.analito || '',
            volumen_muestra: p.volumen_muestra || '',
            punto_corte: p.punto_corte || '',
            vida_util: p.vida_util || '',
            registro_sanitario: p.registro_sanitario || '',
            pitch_venta: p.pitch_venta || '',
            ventaja_competitiva: p.ventaja_competitiva || '',
            roi_medico: p.roi_medico || '',
            palabras_clave: (p.palabras_clave || []).join(', '),
            target_audience: p.target_audience || 'ambos',
        });
        setEditingId(p.id);
        setShowForm(true);
        setError('');
    }

    async function handleSave() {
        if (!form.name || !form.diagnostic_category) {
            setError('Nombre y categoría son requeridos');
            return;
        }
        setSaving(true);
        setError('');

        const body = {
            ...form,
            wc_product_id: form.wc_product_id ? Number(form.wc_product_id) : null,
            clinical_indications: form.clinical_indications.split(',').map((s: string) => s.trim()).filter(Boolean),
            sensitivity: form.sensitivity ? Number(form.sensitivity) : null,
            specificity: form.specificity ? Number(form.specificity) : null,
            complementary_product_ids: form.complementary_product_ids.split(',').map((s: string) => Number(s.trim())).filter((n: number) => !isNaN(n)),
            precio_publico: form.precio_publico ? Number(form.precio_publico) : null,
            precio_laboratorio: form.precio_laboratorio ? Number(form.precio_laboratorio) : null,
            precio_distribuidor: form.precio_distribuidor ? Number(form.precio_distribuidor) : null,
            palabras_clave: form.palabras_clave.split(',').map((s: string) => s.trim()).filter(Boolean),
        };

        try {
            const url = editingId
                ? `${API_URL}/api/medical-products/${editingId}`
                : `${API_URL}/api/medical-products`;
            const res = await authFetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) { setError((await res.json()).error || 'Error'); return; }
            setShowForm(false);
            fetchProducts();
        } catch { setError('Error de conexión'); }
        finally { setSaving(false); }
    }

    async function handleDelete(id: number) {
        if (!confirm('¿Eliminar este producto médico?')) return;
        await authFetch(`${API_URL}/api/medical-products/${id}`, { method: 'DELETE' });
        fetchProducts();
    }

    // ── Inline editing ──
    function startInlineEdit(p: MedicalProduct) {
        setInlineEditing(p.id);
        setInlineValues({
            precio_publico: p.precio_publico != null ? String(p.precio_publico) : '',
            precio_laboratorio: p.precio_laboratorio != null ? String(p.precio_laboratorio) : '',
            precio_distribuidor: p.precio_distribuidor != null ? String(p.precio_distribuidor) : '',
            result_time: p.result_time || '',
            sensitivity: p.sensitivity || '',
            specificity: p.specificity || '',
            target_audience: p.target_audience || 'ambos',
        });
    }

    async function saveInlineEdit(id: number) {
        try {
            const body: Record<string, unknown> = {};
            if (inlineValues.precio_publico !== undefined) body.precio_publico = inlineValues.precio_publico ? Number(inlineValues.precio_publico) : null;
            if (inlineValues.precio_laboratorio !== undefined) body.precio_laboratorio = inlineValues.precio_laboratorio ? Number(inlineValues.precio_laboratorio) : null;
            if (inlineValues.precio_distribuidor !== undefined) body.precio_distribuidor = inlineValues.precio_distribuidor ? Number(inlineValues.precio_distribuidor) : null;
            if (inlineValues.result_time !== undefined) body.result_time = inlineValues.result_time;
            if (inlineValues.sensitivity !== undefined) body.sensitivity = inlineValues.sensitivity ? Number(inlineValues.sensitivity) : null;
            if (inlineValues.specificity !== undefined) body.specificity = inlineValues.specificity ? Number(inlineValues.specificity) : null;
            if (inlineValues.target_audience !== undefined) body.target_audience = inlineValues.target_audience;

            await authFetch(`${API_URL}/api/medical-products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            setInlineEditing(null);
            fetchProducts();
        } catch { setError('Error guardando'); }
    }

    const filtered = search
        ? products.filter((p: MedicalProduct) => p.name.toLowerCase().includes(search.toLowerCase()) ||
              (p.analito || '').toLowerCase().includes(search.toLowerCase()) ||
              (p.palabras_clave || []).some((kw: string) => kw.toLowerCase().includes(search.toLowerCase())))
        : products;

    return (
        <div className="p-6 max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FlaskConical className="text-blue-600" size={24} />
                        Catálogo de Productos
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        Tabla editable de pruebas diagnósticas — precios, info técnica y configuración del bot.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View toggle */}
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                        <button onClick={() => setViewTab('table')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                viewTab === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                            }`}>Tabla</button>
                        <button onClick={() => setViewTab('cards')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                viewTab === 'cards' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                            }`}>Tarjetas</button>
                    </div>
                    <button onClick={openCreate}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                        <Plus size={16} /> Nuevo Producto
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-4 mb-5">
                <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, analito o palabra clave..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <select value={categoryFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategoryFilter(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Todas las categorías</option>
                    {CATEGORIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="text-xs text-slate-400">{filtered.length} producto(s)</div>
            </div>

            {/* Full Form (Create/Edit) */}
            {showForm && (
                <div className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">
                        {editingId ? 'Editar Producto' : 'Nuevo Producto Médico'}
                    </h2>

                    {/* Section: Basic Info */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                            <Beaker size={14} /> Información Básica
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                                <input type="text" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, name: e.target.value})}
                                    placeholder="Prueba Rápida Troponina Cardiac Combo"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Categoría *</label>
                                <select value={form.diagnostic_category} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({...form, diagnostic_category: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    {CATEGORIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Audiencia</label>
                                <select value={form.target_audience} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({...form, target_audience: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    {TARGET_AUDIENCES.map((t: { value: string; label: string }) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">SKU</label>
                                <input type="text" value={form.sku} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, sku: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Marca</label>
                                <input type="text" value={form.marca} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, marca: e.target.value})}
                                    placeholder="Amunet"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">WC Product ID</label>
                                <input type="text" value={form.wc_product_id} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, wc_product_id: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">URL Tienda</label>
                                <input type="text" value={form.url_tienda} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, url_tienda: e.target.value})}
                                    placeholder="https://amunet.com.mx/tienda/..."
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                    </div>

                    {/* Section: Prices */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                            <DollarSign size={14} /> Precios (sin IVA)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Precio Público</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                    <input type="number" step="0.01" value={form.precio_publico}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, precio_publico: e.target.value})}
                                        placeholder="400.00"
                                        className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Precio Laboratorio</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                    <input type="number" step="0.01" value={form.precio_laboratorio}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, precio_laboratorio: e.target.value})}
                                        placeholder="350.00"
                                        className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Precio Distribuidor</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                    <input type="number" step="0.01" value={form.precio_distribuidor}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, precio_distribuidor: e.target.value})}
                                        placeholder="280.00"
                                        className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section: Technical */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                            <FlaskConical size={14} /> Información Técnica
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Analito / Biomarcador</label>
                                <input type="text" value={form.analito} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, analito: e.target.value})}
                                    placeholder="Troponina I, CK-MB, Mioglobina"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Sensibilidad (%)</label>
                                <input type="number" step="0.01" value={form.sensitivity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, sensitivity: e.target.value})}
                                    placeholder="98.5"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Especificidad (%)</label>
                                <input type="number" step="0.01" value={form.specificity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, specificity: e.target.value})}
                                    placeholder="99.2"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Tiempo de resultado</label>
                                <input type="text" value={form.result_time} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, result_time: e.target.value})}
                                    placeholder="15 minutos"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de muestra</label>
                                <select value={form.sample_type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({...form, sample_type: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Seleccionar...</option>
                                    {SAMPLE_TYPES.map((s: string) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Volumen muestra</label>
                                <input type="text" value={form.volumen_muestra} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, volumen_muestra: e.target.value})}
                                    placeholder="10 μL"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Metodología</label>
                                <select value={form.methodology} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({...form, methodology: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Seleccionar...</option>
                                    {METHODOLOGIES.map((m: string) => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Punto de corte</label>
                                <input type="text" value={form.punto_corte} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, punto_corte: e.target.value})}
                                    placeholder="0.5 ng/mL"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Almacenamiento</label>
                                <input type="text" value={form.storage_conditions} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, storage_conditions: e.target.value})}
                                    placeholder="2-30°C"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Vida útil</label>
                                <input type="text" value={form.vida_util} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, vida_util: e.target.value})}
                                    placeholder="24 meses"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Registro sanitario</label>
                                <input type="text" value={form.registro_sanitario} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, registro_sanitario: e.target.value})}
                                    placeholder="COFEPRIS, CE-IVD"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Aprobación regulatoria</label>
                                <input type="text" value={form.regulatory_approval} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, regulatory_approval: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                    </div>

                    {/* Section: Clinical & Sales */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                            <ShoppingCart size={14} /> Clínico y Ventas
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Indicaciones clínicas (separadas por coma)</label>
                                <input type="text" value={form.clinical_indications} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, clinical_indications: e.target.value})}
                                    placeholder="Infarto agudo, Síndrome coronario agudo, Dolor torácico"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Palabras clave (separadas por coma)</label>
                                <input type="text" value={form.palabras_clave} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, palabras_clave: e.target.value})}
                                    placeholder="troponina, corazón, infarto, cardiac"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Pitch de venta (1 oración)</label>
                                <input type="text" value={form.pitch_venta} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, pitch_venta: e.target.value})}
                                    placeholder="Diagnóstico de infarto en 15 minutos al lado del paciente"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Ventaja competitiva</label>
                                <input type="text" value={form.ventaja_competitiva} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, ventaja_competitiva: e.target.value})}
                                    placeholder="vs laboratorio tradicional..."
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">ROI para el médico</label>
                                <input type="text" value={form.roi_medico} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, roi_medico: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Guía de interpretación</label>
                                <textarea value={form.interpretation_guide} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({...form, interpretation_guide: e.target.value})}
                                    rows={2} placeholder="Línea C (control) debe aparecer siempre..."
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                            </div>
                        </div>
                    </div>

                    {/* Profiles */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                            <Users size={14} /> Perfiles recomendados
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {PROFILES.map((p: string) => (
                                <button key={p} type="button"
                                    onClick={() => {
                                        const current = form.recommended_profiles;
                                        setForm({
                                            ...form,
                                            recommended_profiles: current.includes(p)
                                                ? current.filter((x: string) => x !== p)
                                                : [...current, p]
                                        });
                                    }}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                        form.recommended_profiles.includes(p)
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleSave} disabled={saving}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50">
                            {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
                        </button>
                        <button onClick={() => setShowForm(false)}
                            className="bg-slate-100 text-slate-600 px-6 py-2 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════ */}
            {/* TABLE VIEW — Main deliverable                */}
            {/* ════════════════════════════════════════════ */}
            {viewTab === 'table' && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Producto</th>
                                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Categoría</th>
                                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Precio Público</th>
                                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Precio Lab</th>
                                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Precio Dist.</th>
                                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Sensib.</th>
                                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Especif.</th>
                                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Resultado</th>
                                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Muestra</th>
                                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Audiencia</th>
                                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">KB</th>
                                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                                            No hay productos. Crea uno con el botón &quot;Nuevo Producto&quot;.
                                        </td>
                                    </tr>
                                )}
                                {filtered.map((p: MedicalProduct) => {
                                    const isInline = inlineEditing === p.id;
                                    return (
                                        <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${!p.is_active ? 'opacity-50' : ''}`}>
                                            {/* Product name */}
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-2 min-w-[200px]">
                                                    <Beaker size={14} className="text-blue-500 shrink-0" />
                                                    <div>
                                                        <div className="font-medium text-slate-800 text-sm">{p.name}</div>
                                                        {p.analito && <div className="text-xs text-slate-400">{p.analito}</div>}
                                                        {p.sku && <div className="text-xs text-slate-400">SKU: {p.sku}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Category */}
                                            <td className="px-3 py-2.5"><CategoryBadge category={p.diagnostic_category} /></td>
                                            {/* Precio Público */}
                                            <td className="px-3 py-2.5 text-right font-mono text-sm">
                                                {isInline ? (
                                                    <input type="number" step="0.01" value={inlineValues.precio_publico || ''}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInlineValues({...inlineValues, precio_publico: e.target.value})}
                                                        className="w-24 text-right border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                ) : (
                                                    <span className={p.precio_publico ? 'text-slate-800' : 'text-slate-300'}>{formatMXN(p.precio_publico)}</span>
                                                )}
                                            </td>
                                            {/* Precio Lab */}
                                            <td className="px-3 py-2.5 text-right font-mono text-sm">
                                                {isInline ? (
                                                    <input type="number" step="0.01" value={inlineValues.precio_laboratorio || ''}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInlineValues({...inlineValues, precio_laboratorio: e.target.value})}
                                                        className="w-24 text-right border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                ) : (
                                                    <span className={p.precio_laboratorio ? 'text-emerald-700' : 'text-slate-300'}>{formatMXN(p.precio_laboratorio)}</span>
                                                )}
                                            </td>
                                            {/* Precio Distribuidor */}
                                            <td className="px-3 py-2.5 text-right font-mono text-sm">
                                                {isInline ? (
                                                    <input type="number" step="0.01" value={inlineValues.precio_distribuidor || ''}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInlineValues({...inlineValues, precio_distribuidor: e.target.value})}
                                                        className="w-24 text-right border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                ) : (
                                                    <span className={p.precio_distribuidor ? 'text-orange-700' : 'text-slate-300'}>{formatMXN(p.precio_distribuidor)}</span>
                                                )}
                                            </td>
                                            {/* Sensitivity */}
                                            <td className="px-3 py-2.5 text-center text-sm">
                                                {isInline ? (
                                                    <input type="number" step="0.01" value={inlineValues.sensitivity || ''}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInlineValues({...inlineValues, sensitivity: e.target.value})}
                                                        className="w-16 text-center border border-blue-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                ) : (
                                                    p.sensitivity ? `${p.sensitivity}%` : '—'
                                                )}
                                            </td>
                                            {/* Specificity */}
                                            <td className="px-3 py-2.5 text-center text-sm">
                                                {isInline ? (
                                                    <input type="number" step="0.01" value={inlineValues.specificity || ''}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInlineValues({...inlineValues, specificity: e.target.value})}
                                                        className="w-16 text-center border border-blue-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                ) : (
                                                    p.specificity ? `${p.specificity}%` : '—'
                                                )}
                                            </td>
                                            {/* Result time */}
                                            <td className="px-3 py-2.5 text-center text-xs text-slate-600 whitespace-nowrap">
                                                {isInline ? (
                                                    <input type="text" value={inlineValues.result_time || ''}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInlineValues({...inlineValues, result_time: e.target.value})}
                                                        className="w-20 text-center border border-blue-300 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                ) : (
                                                    p.result_time || '—'
                                                )}
                                            </td>
                                            {/* Sample type */}
                                            <td className="px-3 py-2.5 text-center text-xs text-slate-600 whitespace-nowrap">
                                                {p.sample_type ? p.sample_type.replace(/_/g, ' ') : '—'}
                                            </td>
                                            {/* Target audience */}
                                            <td className="px-3 py-2.5 text-center">
                                                {isInline ? (
                                                    <select value={inlineValues.target_audience || 'ambos'}
                                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInlineValues({...inlineValues, target_audience: e.target.value})}
                                                        className="text-xs border border-blue-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
                                                        {TARGET_AUDIENCES.map((t: { value: string; label: string }) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                    </select>
                                                ) : (
                                                    <TargetBadge target={p.target_audience || 'ambos'} />
                                                )}
                                            </td>
                                            {/* KB chunks */}
                                            <td className="px-3 py-2.5 text-center">
                                                {Number(p.chunk_count) > 0 ? (
                                                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                                        <FileText size={12} /> {p.chunk_count}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-300">0</span>
                                                )}
                                            </td>
                                            {/* Actions */}
                                            <td className="px-3 py-2.5 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {isInline ? (
                                                        <>
                                                            <button onClick={() => saveInlineEdit(p.id)} title="Guardar"
                                                                className="p-1 hover:bg-green-50 rounded transition-colors">
                                                                <Save size={14} className="text-green-600" />
                                                            </button>
                                                            <button onClick={() => setInlineEditing(null)} title="Cancelar"
                                                                className="p-1 hover:bg-slate-100 rounded transition-colors">
                                                                <X size={14} className="text-slate-400" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => startInlineEdit(p)} title="Editar rápido"
                                                                className="p-1 hover:bg-blue-50 rounded transition-colors">
                                                                <DollarSign size={14} className="text-blue-500" />
                                                            </button>
                                                            <button onClick={() => openEdit(p)} title="Editar completo"
                                                                className="p-1 hover:bg-slate-100 rounded transition-colors">
                                                                <Pencil size={14} className="text-slate-400" />
                                                            </button>
                                                            {p.url_tienda && (
                                                                <a href={p.url_tienda} target="_blank" rel="noopener noreferrer" title="Ver en tienda"
                                                                    className="p-1 hover:bg-slate-100 rounded transition-colors">
                                                                    <ExternalLink size={14} className="text-slate-400" />
                                                                </a>
                                                            )}
                                                            <button onClick={() => handleDelete(p.id)} title="Eliminar"
                                                                className="p-1 hover:bg-red-50 rounded transition-colors">
                                                                <Trash2 size={14} className="text-red-400" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════ */}
            {/* CARDS VIEW — Detailed expanded view          */}
            {/* ════════════════════════════════════════════ */}
            {viewTab === 'cards' && (
                <div className="space-y-3">
                    {filtered.length === 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
                            No hay productos médicos. Crea uno para alimentar la base de conocimiento del bot.
                        </div>
                    )}
                    {filtered.map((p: MedicalProduct) => (
                        <div key={p.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                                {expandedId === p.id ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                <Beaker size={18} className="text-blue-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-800">{p.name}</span>
                                        <CategoryBadge category={p.diagnostic_category} />
                                        <TargetBadge target={p.target_audience || 'ambos'} />
                                        {!p.is_active && <span className="text-xs text-red-500 font-medium">Inactivo</span>}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                        {p.precio_publico != null && <span className="font-medium text-slate-700">{formatMXN(p.precio_publico)}</span>}
                                        {p.sensitivity && <span>Sens: {p.sensitivity}%</span>}
                                        {p.specificity && <span>Esp: {p.specificity}%</span>}
                                        {p.result_time && <span>{p.result_time}</span>}
                                        {p.sample_type && <span>{p.sample_type.replace(/_/g, ' ')}</span>}
                                        {Number(p.chunk_count) > 0 && (
                                            <span className="inline-flex items-center gap-1 text-green-600">
                                                <FileText size={12} /> {p.chunk_count} chunks
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); openEdit(p); }}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Editar">
                                        <Pencil size={16} className="text-slate-400" />
                                    </button>
                                    <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDelete(p.id); }}
                                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                                        <Trash2 size={16} className="text-red-400" />
                                    </button>
                                </div>
                            </div>

                            {expandedId === p.id && (
                                <div className="border-t border-slate-100 px-4 py-4 bg-slate-50">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                        {/* Pricing column */}
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wide">Precios</h4>
                                            <div className="text-sm">
                                                <div className="flex justify-between"><span className="text-slate-500">Público:</span><span className="font-medium">{formatMXN(p.precio_publico)}</span></div>
                                                <div className="flex justify-between"><span className="text-slate-500">Laboratorio:</span><span className="font-medium text-emerald-700">{formatMXN(p.precio_laboratorio)}</span></div>
                                                <div className="flex justify-between"><span className="text-slate-500">Distribuidor:</span><span className="font-medium text-orange-700">{formatMXN(p.precio_distribuidor)}</span></div>
                                            </div>
                                            {p.pitch_venta && <p className="text-xs text-blue-700 italic mt-2">{p.pitch_venta}</p>}
                                        </div>
                                        {/* Technical column */}
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wide">Info Técnica</h4>
                                            {p.analito && <div><span className="text-slate-500">Analito:</span> {p.analito}</div>}
                                            {p.volumen_muestra && <div><span className="text-slate-500">Vol. muestra:</span> {p.volumen_muestra}</div>}
                                            {p.punto_corte && <div><span className="text-slate-500">Cut-off:</span> {p.punto_corte}</div>}
                                            {p.storage_conditions && <div><span className="text-slate-500">Almacén:</span> {p.storage_conditions}</div>}
                                            {p.vida_util && <div><span className="text-slate-500">Vida útil:</span> {p.vida_util}</div>}
                                            {p.registro_sanitario && <div><span className="text-slate-500">Registro:</span> {p.registro_sanitario}</div>}
                                        </div>
                                        {/* Clinical column */}
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wide">Clínico</h4>
                                            {p.clinical_indications?.length > 0 && (
                                                <div><span className="text-slate-500">Indicaciones:</span> {p.clinical_indications.join(', ')}</div>
                                            )}
                                            {p.interpretation_guide && <div><span className="text-slate-500">Interpretación:</span> {p.interpretation_guide}</div>}
                                            {p.ventaja_competitiva && <div><span className="text-slate-500">Ventaja:</span> {p.ventaja_competitiva}</div>}
                                            {p.roi_medico && <div><span className="text-slate-500">ROI:</span> {p.roi_medico}</div>}
                                            {p.recommended_profiles?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {p.recommended_profiles.map((pr: string) => (
                                                        <span key={pr} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{pr}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
