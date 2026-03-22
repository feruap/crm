'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, FileText, ChevronDown, ChevronRight, Beaker, Search, RefreshCw, AlertCircle, ExternalLink, Users, FlaskConical, Stethoscope, DollarSign } from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Presentacion {
    cantidad: number;
    precio: number;
    sku?: string;
    wc_variation_id?: number;
}

interface CrossSell {
    name: string;
    reason: string;
    url: string | null;
}

interface Objecion {
    pregunta: string;
    respuesta: string;
}

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
    // New KB fields
    tipo_producto: string | null;
    url_tienda: string | null;
    marca: string | null;
    precio_publico: number | null;
    precio_por_prueba: number | null;
    precio_sugerido_paciente: string | null;
    margen_estimado: string | null;
    presentaciones: Presentacion[];
    analito: string | null;
    volumen_muestra: string | null;
    punto_corte: string | null;
    registro_sanitario: string | null;
    clasificacion_clinica: string | null;
    proposito_clinico: string | null;
    especialidades: string[];
    escenarios_uso: string | null;
    perfil_paciente: string | null;
    limitaciones: string | null;
    resultado_positivo: string | null;
    resultado_negativo: string | null;
    pitch_medico: string | null;
    pitch_laboratorio: string | null;
    ventaja_vs_lab: string | null;
    roi_medico: string | null;
    porque_agregarlo_lab: string | null;
    objeciones_medico: Objecion[];
    objeciones_laboratorio: Objecion[];
    cross_sells: CrossSell[];
    up_sells: CrossSell[];
    palabras_clave: string[];
    target_audience: string[];
    wc_last_sync: string | null;
}

interface KnowledgeGap {
    id: number;
    question: string;
    customer_name: string | null;
    product_name: string | null;
    frequency: number;
    status: string;
    admin_notes: string | null;
    resolved_answer: string | null;
    created_at: string;
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
}

const CATEGORIES = [
    'infecciosas', 'embarazo', 'drogas', 'metabolicas',
    'cardiologicas', 'oncologicas', 'ets', 'respiratorias',
    'gastrointestinal', 'molecular', 'equipos', 'consumibles', 'otros',
];

const SAMPLE_TYPES = [
    'sangre_total', 'suero', 'plasma', 'orina', 'hisopo_nasal',
    'hisopo_orofaringeo', 'saliva', 'heces', 'esputo', 'secrecion',
];

const PROFILES = ['laboratorio', 'farmacia', 'consultorio', 'hospital', 'clinica', 'punto_de_venta', 'distribuidor'];

const METHODOLOGIES = ['inmunocromatografia', 'pcr_rapida', 'elisa', 'aglutinacion', 'fluorescencia', 'colorimetrica'];

const emptyForm: FormData = {
    wc_product_id: '', name: '', sku: '', diagnostic_category: 'infecciosas',
    clinical_indications: '', sample_type: '', sensitivity: '', specificity: '',
    result_time: '', methodology: '', regulatory_approval: '', complementary_product_ids: '',
    recommended_profiles: [], contraindications: '', interpretation_guide: '',
    storage_conditions: '', shelf_life: '', price_range: 'media',
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
        gastrointestinal: 'bg-green-100 text-green-700',
        oncologicas: 'bg-indigo-100 text-indigo-700',
        molecular: 'bg-cyan-100 text-cyan-700',
        equipos: 'bg-slate-100 text-slate-700',
        consumibles: 'bg-amber-100 text-amber-700',
    };
    return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[category] || 'bg-slate-100 text-slate-600'}`}>
            {category}
        </span>
    );
}

function AudienceBadges({ audiences }: { audiences: string[] }) {
    if (!audiences || audiences.length === 0) return null;
    return (
        <div className="flex gap-1">
            {audiences.includes('medico') && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Stethoscope size={10} /> Med
                </span>
            )}
            {audiences.includes('laboratorio') && (
                <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <FlaskConical size={10} /> Lab
                </span>
            )}
        </div>
    );
}

function formatPrice(val: number | null): string {
    if (!val) return '-';
    return `$${val.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
}

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
    const [audienceFilter, setAudienceFilter] = useState<'all' | 'medico' | 'laboratorio'>('all');
    const [search, setSearch] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [syncingProducts, setSyncingProducts] = useState(false);
    const [syncResult, setSyncResult] = useState<any>(null);
    const [prepFilter, setPrepFilter] = useState<'all' | 'prepared' | 'unprepared'>('all');
    const [activeTab, setActiveTab] = useState<'products' | 'gaps'>('products');
    const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
    const [expandedDetail, setExpandedDetail] = useState<'clinical' | 'pitch' | 'pricing' | null>(null);

    useEffect(() => { fetchProducts(); }, [categoryFilter]);
    useEffect(() => { if (activeTab === 'gaps') fetchGaps(); }, [activeTab]);

    async function fetchProducts() {
        try {
            const params = new URLSearchParams();
            if (categoryFilter) params.set('category', categoryFilter);
            params.set('active_only', 'false');
            const res = await authFetch(`${API_URL}/api/medical-products?${params}`);
            setProducts(await res.json());
        } catch { setError('Error cargando productos'); }
    }

    async function fetchGaps() {
        try {
            const res = await authFetch(`${API_URL}/api/medical-products/knowledge-gaps?status=pending`);
            setGaps(await res.json());
        } catch { /* ignore */ }
    }

    async function handleSync() {
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await authFetch(`${API_URL}/api/medical-products/sync-prices`, { method: 'POST' });
            const data = await res.json();
            setSyncResult(data);
            fetchProducts();
        } catch { setSyncResult({ error: 'Error de conexión' }); }
        finally { setSyncing(false); }
    }

    async function handleSyncProducts() {
        setSyncingProducts(true);
        setSyncResult(null);
        try {
            const res = await authFetch(`${API_URL}/api/medical-products/sync-products`, { method: 'POST' });
            const data = await res.json();
            setSyncResult({ productSync: true, ...data });
            fetchProducts();
        } catch { setSyncResult({ error: 'Error al importar productos de WC' }); }
        finally { setSyncingProducts(false); }
    }

    async function resolveGap(gapId: number, status: string) {
        await authFetch(`${API_URL}/api/medical-products/knowledge-gaps/${gapId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        fetchGaps();
    }

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
            clinical_indications: form.clinical_indications.split(',').map(s => s.trim()).filter(Boolean),
            sensitivity: form.sensitivity ? Number(form.sensitivity) : null,
            specificity: form.specificity ? Number(form.specificity) : null,
            complementary_product_ids: form.complementary_product_ids.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n)),
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

    // Preparation status check
    function isPrepared(p: MedicalProduct): boolean {
        return !!(p.clinical_indications?.length > 0 && p.sample_type && p.precio_publico && parseInt(p.chunk_count || '0') > 0);
    }
    function prepScore(p: MedicalProduct): { score: number; total: number; missing: string[] } {
        const checks = [
            { ok: !!p.precio_publico, label: 'Precio' },
            { ok: !!(p.clinical_indications?.length > 0), label: 'Indicaciones' },
            { ok: !!p.sample_type, label: 'Muestra' },
            { ok: parseInt(p.chunk_count || '0') > 0, label: 'KB/PDF' },
            { ok: !!p.pitch_medico || !!p.pitch_laboratorio, label: 'Pitch' },
            { ok: !!p.sensitivity, label: 'Sensibilidad' },
        ];
        return {
            score: checks.filter(c => c.ok).length,
            total: checks.length,
            missing: checks.filter(c => !c.ok).map(c => c.label),
        };
    }

    // Filter products
    const filtered = products.filter(p => {
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (audienceFilter !== 'all' && p.target_audience && !p.target_audience.includes(audienceFilter)) return false;
        if (prepFilter === 'prepared' && !isPrepared(p)) return false;
        if (prepFilter === 'unprepared' && isPrepared(p)) return false;
        return true;
    });

    // Stats
    const stats = {
        total: products.length,
        medico: products.filter(p => p.target_audience?.includes('medico')).length,
        lab: products.filter(p => p.target_audience?.includes('laboratorio')).length,
        withPrice: products.filter(p => p.precio_publico).length,
        withPitch: products.filter(p => p.pitch_medico || p.pitch_laboratorio).length,
        prepared: products.filter(p => isPrepared(p)).length,
        unprepared: products.filter(p => !isPrepared(p)).length,
    };

    return (
        <div className="p-6 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Productos Médicos</h1>
                    <p className="text-slate-500 mt-1">
                        Base de conocimiento de pruebas diagnósticas &mdash; {stats.total} productos, {stats.withPitch} con pitch de venta
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleSyncProducts} disabled={syncingProducts}
                        className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-200 transition-colors font-medium text-sm disabled:opacity-50">
                        <RefreshCw size={16} className={syncingProducts ? 'animate-spin' : ''} />
                        {syncingProducts ? 'Importando...' : 'Sync Productos WC'}
                    </button>
                    <button onClick={handleSync} disabled={syncing}
                        className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm disabled:opacity-50">
                        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Sincronizando...' : 'Sync Precios'}
                    </button>
                    <button onClick={openCreate}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                        <Plus size={18} /> Nuevo Producto
                    </button>
                </div>
            </div>

            {/* Sync result banner */}
            {syncResult && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${syncResult.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
                    {syncResult.error
                        ? `Error: ${syncResult.error}`
                        : syncResult.productSync
                            ? `Importación completada: ${syncResult.imported} nuevos productos importados de WC, ${syncResult.skipped} ya existían`
                            : `Sync completado: ${syncResult.synced} productos revisados, ${syncResult.updated} actualizados, ${syncResult.changes?.length || 0} cambios`
                    }
                    <button onClick={() => setSyncResult(null)} className="ml-2 underline">cerrar</button>
                </div>
            )}

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
            )}

            {/* Tabs: Products / Knowledge Gaps */}
            <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
                <button onClick={() => setActiveTab('products')}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'products'
                            ? 'border-blue-600 text-blue-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}>
                    Productos ({stats.total})
                </button>
                <button onClick={() => setActiveTab('gaps')}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                        activeTab === 'gaps'
                            ? 'border-orange-600 text-orange-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}>
                    <AlertCircle size={14} />
                    Preguntas sin Respuesta {gaps.length > 0 && <span className="bg-orange-100 text-orange-700 text-xs px-1.5 rounded-full">{gaps.length}</span>}
                </button>
            </div>

            {/* PRODUCTS TAB */}
            {activeTab === 'products' && (
                <>
                    {/* Filters */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar producto..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Todas las categorías</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {/* Preparation filter */}
                        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                            {[
                                { key: 'all' as const, label: `Todos (${stats.total})` },
                                { key: 'prepared' as const, label: `Listos (${stats.prepared})` },
                                { key: 'unprepared' as const, label: `Sin preparar (${stats.unprepared})` },
                            ].map(({ key, label }) => (
                                <button key={key} onClick={() => setPrepFilter(key)}
                                    className={`px-3 py-2 text-xs font-medium transition-colors ${
                                        prepFilter === key
                                            ? key === 'unprepared' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                    }`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        {/* Audience filter */}
                        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                            {[
                                { key: 'all' as const, label: 'Todos', icon: Users },
                                { key: 'medico' as const, label: 'Médicos', icon: Stethoscope },
                                { key: 'laboratorio' as const, label: 'Labs', icon: FlaskConical },
                            ].map(({ key, label, icon: Icon }) => (
                                <button key={key} onClick={() => setAudienceFilter(key)}
                                    className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
                                        audienceFilter === key
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                    }`}>
                                    <Icon size={12} /> {label}
                                </button>
                            ))}
                        </div>
                        <span className="text-sm text-slate-400">{filtered.length} productos</span>
                    </div>

                    {/* Form */}
                    {showForm && (
                        <div className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4">
                                {editingId ? 'Editar Producto' : 'Nuevo Producto Médico'}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                                    <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                                        placeholder="Prueba Rápida Influenza A/B"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoría *</label>
                                    <select value={form.diagnostic_category} onChange={e => setForm({...form, diagnostic_category: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
                                    <input type="text" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Sensibilidad (%)</label>
                                    <input type="number" step="0.01" value={form.sensitivity} onChange={e => setForm({...form, sensitivity: e.target.value})}
                                        placeholder="98.5"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Especificidad (%)</label>
                                    <input type="number" step="0.01" value={form.specificity} onChange={e => setForm({...form, specificity: e.target.value})}
                                        placeholder="99.2"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tiempo de resultado</label>
                                    <input type="text" value={form.result_time} onChange={e => setForm({...form, result_time: e.target.value})}
                                        placeholder="15 minutos"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de muestra</label>
                                    <select value={form.sample_type} onChange={e => setForm({...form, sample_type: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">Seleccionar...</option>
                                        {SAMPLE_TYPES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Metodología</label>
                                    <select value={form.methodology} onChange={e => setForm({...form, methodology: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">Seleccionar...</option>
                                        {METHODOLOGIES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Aprobación regulatoria</label>
                                    <input type="text" value={form.regulatory_approval} onChange={e => setForm({...form, regulatory_approval: e.target.value})}
                                        placeholder="COFEPRIS, CE-IVD"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Indicaciones clínicas (separadas por coma)</label>
                                    <input type="text" value={form.clinical_indications} onChange={e => setForm({...form, clinical_indications: e.target.value})}
                                        placeholder="Detección de Influenza A, Detección de Influenza B"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Guía de interpretación</label>
                                    <textarea value={form.interpretation_guide} onChange={e => setForm({...form, interpretation_guide: e.target.value})}
                                        rows={3} placeholder="Línea C (control) debe aparecer siempre. Línea T visible = positivo..."
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Perfiles recomendados</label>
                                    <div className="flex flex-wrap gap-2">
                                        {PROFILES.map(p => (
                                            <button key={p} type="button"
                                                onClick={() => {
                                                    const current = form.recommended_profiles;
                                                    setForm({
                                                        ...form,
                                                        recommended_profiles: current.includes(p)
                                                            ? current.filter(x => x !== p)
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
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={handleSave} disabled={saving}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50">
                                    {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
                                </button>
                                <button onClick={() => setShowForm(false)}
                                    className="bg-slate-100 text-slate-600 px-6 py-2 rounded-lg hover:bg-slate-200 transition-colors font-medium">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Products List */}
                    <div className="space-y-2">
                        {filtered.length === 0 && (
                            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
                                No hay productos médicos{search ? ' que coincidan con la búsqueda' : ''}. {!search && 'Crea uno para alimentar la base de conocimiento del bot.'}
                            </div>
                        )}
                        {filtered.map(p => (
                            <div key={p.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                {/* Row header */}
                                <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                                    {expandedId === p.id ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                    <Beaker size={16} className="text-blue-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-semibold text-slate-800">{p.name}</span>
                                            <CategoryBadge category={p.diagnostic_category} />
                                            <AudienceBadges audiences={p.target_audience} />
                                            {(() => {
                                                const ps = prepScore(p);
                                                if (ps.score === ps.total) return <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Listo</span>;
                                                return (
                                                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium" title={`Falta: ${ps.missing.join(', ')}`}>
                                                        {ps.score}/{ps.total} — faltan: {ps.missing.join(', ')}
                                                    </span>
                                                );
                                            })()}
                                            {!p.is_active && <span className="text-xs text-red-500 font-medium">Inactivo</span>}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                                            {p.precio_publico && (
                                                <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                                                    <DollarSign size={10} />{formatPrice(p.precio_publico)}
                                                </span>
                                            )}
                                            {p.presentaciones && p.presentaciones.length > 0 && (
                                                <span>{p.presentaciones.map(pr => `${pr.cantidad}pzas`).join('/')}</span>
                                            )}
                                            {p.sensitivity && <span>Sens: {p.sensitivity}%</span>}
                                            {p.specificity && <span>Esp: {p.specificity}%</span>}
                                            {p.result_time && <span>{p.result_time}</span>}
                                            {p.analito && <span className="text-slate-400">{p.analito.substring(0, 40)}</span>}
                                            {p.wc_product_id && <span className="text-blue-400">WC#{p.wc_product_id}</span>}
                                            {Number(p.chunk_count) > 0 && (
                                                <span className="inline-flex items-center gap-0.5 text-green-600">
                                                    <FileText size={10} /> {p.chunk_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {p.url_tienda && (
                                            <a href={p.url_tienda} target="_blank" rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors" title="Ver en tienda">
                                                <ExternalLink size={14} className="text-blue-400" />
                                            </a>
                                        )}
                                        <button onClick={e => { e.stopPropagation(); openEdit(p); }}
                                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Editar">
                                            <Pencil size={14} className="text-slate-400" />
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                                            <Trash2 size={14} className="text-red-400" />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded detail */}
                                {expandedId === p.id && (
                                    <div className="border-t border-slate-100 bg-slate-50">
                                        {/* Detail tabs */}
                                        <div className="flex border-b border-slate-200 px-4">
                                            {(['clinical', 'pitch', 'pricing'] as const).map(tab => (
                                                <button key={tab} onClick={() => setExpandedDetail(expandedDetail === tab ? null : tab)}
                                                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                                                        expandedDetail === tab
                                                            ? 'border-blue-500 text-blue-700'
                                                            : 'border-transparent text-slate-500 hover:text-slate-700'
                                                    }`}>
                                                    {tab === 'clinical' ? 'Clínico' : tab === 'pitch' ? 'Pitch de Venta' : 'Precios'}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="px-4 py-4">
                                            {/* Clinical tab */}
                                            {expandedDetail === 'clinical' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                    {p.proposito_clinico && (
                                                        <div className="md:col-span-2">
                                                            <span className="font-medium text-slate-700">Propósito clínico:</span>
                                                            <p className="text-slate-600 mt-1">{p.proposito_clinico}</p>
                                                        </div>
                                                    )}
                                                    {p.analito && (
                                                        <div><span className="font-medium text-slate-700">Analito:</span> <span className="text-slate-600">{p.analito}</span></div>
                                                    )}
                                                    {p.clasificacion_clinica && (
                                                        <div><span className="font-medium text-slate-700">Clasificación:</span> <span className="text-slate-600">{p.clasificacion_clinica}</span></div>
                                                    )}
                                                    {p.especialidades?.length > 0 && (
                                                        <div>
                                                            <span className="font-medium text-slate-700">Especialidades:</span>
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {p.especialidades.map((e, i) => (
                                                                    <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{e}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {p.limitaciones && (
                                                        <div><span className="font-medium text-slate-700">Limitaciones:</span> <span className="text-slate-600">{p.limitaciones}</span></div>
                                                    )}
                                                    {p.resultado_positivo && (
                                                        <div><span className="font-medium text-green-700">Resultado +:</span> <span className="text-slate-600">{p.resultado_positivo}</span></div>
                                                    )}
                                                    {p.resultado_negativo && (
                                                        <div><span className="font-medium text-red-700">Resultado -:</span> <span className="text-slate-600">{p.resultado_negativo}</span></div>
                                                    )}
                                                    {p.escenarios_uso && (
                                                        <div className="md:col-span-2">
                                                            <span className="font-medium text-slate-700">Escenarios de uso:</span>
                                                            <p className="text-slate-600 mt-1 whitespace-pre-line text-xs">{p.escenarios_uso}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Pitch tab */}
                                            {expandedDetail === 'pitch' && (
                                                <div className="space-y-4 text-sm">
                                                    {p.pitch_medico && (
                                                        <div className="bg-emerald-50 rounded-lg p-3">
                                                            <div className="flex items-center gap-1.5 font-medium text-emerald-800 mb-1"><Stethoscope size={14} /> Pitch Médico</div>
                                                            <p className="text-emerald-700">{p.pitch_medico}</p>
                                                        </div>
                                                    )}
                                                    {p.pitch_laboratorio && (
                                                        <div className="bg-violet-50 rounded-lg p-3">
                                                            <div className="flex items-center gap-1.5 font-medium text-violet-800 mb-1"><FlaskConical size={14} /> Pitch Laboratorio</div>
                                                            <p className="text-violet-700">{p.pitch_laboratorio}</p>
                                                        </div>
                                                    )}
                                                    {p.ventaja_vs_lab && (
                                                        <div><span className="font-medium text-slate-700">Ventaja vs lab tradicional:</span> <span className="text-slate-600">{p.ventaja_vs_lab}</span></div>
                                                    )}
                                                    {p.roi_medico && (
                                                        <div><span className="font-medium text-slate-700">ROI:</span> <span className="text-slate-600">{p.roi_medico}</span></div>
                                                    )}
                                                    {p.porque_agregarlo_lab && (
                                                        <div><span className="font-medium text-slate-700">Por qué agregarlo (lab):</span> <span className="text-slate-600">{p.porque_agregarlo_lab.substring(0, 300)}</span></div>
                                                    )}
                                                    {p.objeciones_medico?.length > 0 && (
                                                        <div>
                                                            <span className="font-medium text-slate-700">Objeciones (médico):</span>
                                                            {p.objeciones_medico.map((o, i) => (
                                                                <div key={i} className="mt-1 ml-2 text-xs">
                                                                    <span className="text-orange-700">"{o.pregunta}"</span>
                                                                    <span className="text-slate-600"> → {o.respuesta}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {p.objeciones_laboratorio?.length > 0 && (
                                                        <div>
                                                            <span className="font-medium text-slate-700">Objeciones (lab):</span>
                                                            {p.objeciones_laboratorio.map((o, i) => (
                                                                <div key={i} className="mt-1 ml-2 text-xs">
                                                                    <span className="text-orange-700">"{o.pregunta}"</span>
                                                                    <span className="text-slate-600"> → {o.respuesta}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {p.cross_sells?.length > 0 && (
                                                        <div>
                                                            <span className="font-medium text-slate-700">Cross-sells:</span>
                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                {p.cross_sells.map((cs, i) => (
                                                                    <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                                                        {cs.name}
                                                                        {cs.url && <a href={cs.url} target="_blank" rel="noopener noreferrer" className="ml-1"><ExternalLink size={10} className="inline" /></a>}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Pricing tab */}
                                            {expandedDetail === 'pricing' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <span className="font-medium text-slate-700">Precio público (sin IVA):</span>
                                                        <span className="text-slate-600 ml-2">{formatPrice(p.precio_publico)}</span>
                                                    </div>
                                                    {p.precio_por_prueba && (
                                                        <div>
                                                            <span className="font-medium text-slate-700">Precio por prueba:</span>
                                                            <span className="text-slate-600 ml-2">{formatPrice(p.precio_por_prueba)}</span>
                                                        </div>
                                                    )}
                                                    {p.precio_sugerido_paciente && (
                                                        <div>
                                                            <span className="font-medium text-slate-700">Sugerido al paciente:</span>
                                                            <span className="text-slate-600 ml-2">{p.precio_sugerido_paciente}</span>
                                                        </div>
                                                    )}
                                                    {p.margen_estimado && (
                                                        <div>
                                                            <span className="font-medium text-slate-700">Margen estimado:</span>
                                                            <span className="text-emerald-600 ml-2 font-medium">{p.margen_estimado}</span>
                                                        </div>
                                                    )}
                                                    {p.presentaciones?.length > 0 && (
                                                        <div className="md:col-span-2">
                                                            <span className="font-medium text-slate-700">Presentaciones:</span>
                                                            <div className="mt-1 flex flex-wrap gap-2">
                                                                {p.presentaciones.map((pr, i) => (
                                                                    <span key={i} className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
                                                                        <span className="font-medium">{pr.cantidad} pzas</span>
                                                                        <span className="text-emerald-600 ml-1 font-semibold">${pr.precio}</span>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {p.wc_last_sync && (
                                                        <div className="text-xs text-slate-400">
                                                            Última sync WC: {new Date(p.wc_last_sync).toLocaleString('es-MX')}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Default view if no tab selected */}
                                            {!expandedDetail && (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                    {p.pitch_medico && (
                                                        <div className="bg-emerald-50 rounded-lg p-2">
                                                            <span className="text-xs font-medium text-emerald-700">Pitch Médico:</span>
                                                            <p className="text-xs text-emerald-600 mt-0.5">{p.pitch_medico.substring(0, 120)}...</p>
                                                        </div>
                                                    )}
                                                    {p.pitch_laboratorio && (
                                                        <div className="bg-violet-50 rounded-lg p-2">
                                                            <span className="text-xs font-medium text-violet-700">Pitch Lab:</span>
                                                            <p className="text-xs text-violet-600 mt-0.5">{p.pitch_laboratorio.substring(0, 120)}...</p>
                                                        </div>
                                                    )}
                                                    {p.presentaciones?.length > 0 && (
                                                        <div className="bg-white border border-slate-200 rounded-lg p-2">
                                                            <span className="text-xs font-medium text-slate-700">Presentaciones:</span>
                                                            <div className="text-xs text-slate-600 mt-0.5">
                                                                {p.presentaciones.map(pr => `${pr.cantidad}pzas $${pr.precio}`).join(' | ')}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* KNOWLEDGE GAPS TAB */}
            {activeTab === 'gaps' && (
                <div className="space-y-3">
                    <p className="text-sm text-slate-500 mb-4">
                        Preguntas que el bot no pudo responder con la base de conocimiento actual. Resuelve estas preguntas para mejorar las respuestas del bot.
                    </p>
                    {gaps.length === 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
                            No hay preguntas pendientes. El bot está respondiendo correctamente.
                        </div>
                    )}
                    {gaps.map(g => (
                        <div key={g.id} className="bg-white border border-slate-200 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-800">"{g.question}"</p>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                        {g.customer_name && <span>Cliente: {g.customer_name}</span>}
                                        {g.product_name && <span>Producto: {g.product_name}</span>}
                                        <span>Frecuencia: {g.frequency}x</span>
                                        <span>{new Date(g.created_at).toLocaleDateString('es-MX')}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={() => resolveGap(g.id, 'resolved')}
                                        className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-medium">
                                        Resolver
                                    </button>
                                    <button onClick={() => resolveGap(g.id, 'dismissed')}
                                        className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 font-medium">
                                        Descartar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
