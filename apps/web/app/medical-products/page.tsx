'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, FileText, ChevronDown, ChevronRight, Beaker, Search } from 'lucide-react';
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
    'cardiologicas', 'oncologicas', 'ets', 'respiratorias', 'gastrointestinales',
];

const SAMPLE_TYPES = [
    'sangre_total', 'suero', 'plasma', 'orina', 'hisopo_nasal',
    'hisopo_orofaringeo', 'saliva', 'heces', 'secrecion',
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
        gastrointestinales: 'bg-green-100 text-green-700',
    };
    return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[category] || 'bg-slate-100 text-slate-600'}`}>
            {category}
        </span>
    );
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
    const [search, setSearch] = useState('');

    useEffect(() => { fetchProducts(); }, [categoryFilter]);

    async function fetchProducts() {
        try {
            const params = new URLSearchParams();
            if (categoryFilter) params.set('category', categoryFilter);
            params.set('active_only', 'false');
            const res = await authFetch(`${API_URL}/api/medical-products?${params}`);
            setProducts(await res.json());
        } catch { setError('Error cargando productos'); }
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

    const filtered = search
        ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
        : products;

    return (
        <div className="p-6 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Productos Médicos</h1>
                    <p className="text-slate-500 mt-1">
                        Base de conocimiento de pruebas diagnósticas para el bot médico.
                    </p>
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    <Plus size={18} /> Nuevo Producto
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
            )}

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
                                placeholder="Detección de Influenza A, Detección de Influenza B, Screening respiratorio"
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
            <div className="space-y-3">
                {filtered.length === 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
                        No hay productos médicos. Crea uno para alimentar la base de conocimiento del bot.
                    </div>
                )}
                {filtered.map(p => (
                    <div key={p.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        {/* Row header */}
                        <div className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                            {expandedId === p.id ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                            <Beaker size={18} className="text-blue-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-800">{p.name}</span>
                                    <CategoryBadge category={p.diagnostic_category} />
                                    {!p.is_active && <span className="text-xs text-red-500 font-medium">Inactivo</span>}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                    {p.sensitivity && <span>Sens: {p.sensitivity}%</span>}
                                    {p.specificity && <span>Esp: {p.specificity}%</span>}
                                    {p.result_time && <span>{p.result_time}</span>}
                                    {p.sample_type && <span>{p.sample_type.replace(/_/g, ' ')}</span>}
                                    {Number(p.chunk_count) > 0 && (
                                        <span className="inline-flex items-center gap-1 text-green-600">
                                            <FileText size={12} /> {p.chunk_count} chunks indexados
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={e => { e.stopPropagation(); openEdit(p); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Editar">
                                    <Pencil size={16} className="text-slate-400" />
                                </button>
                                <button onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                                    <Trash2 size={16} className="text-red-400" />
                                </button>
                            </div>
                        </div>

                        {/* Expanded detail */}
                        {expandedId === p.id && (
                            <div className="border-t border-slate-100 px-4 py-4 bg-slate-50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    {p.clinical_indications?.length > 0 && (
                                        <div>
                                            <span className="font-medium text-slate-700">Indicaciones:</span>
                                            <p className="text-slate-600 mt-1">{p.clinical_indications.join(', ')}</p>
                                        </div>
                                    )}
                                    {p.interpretation_guide && (
                                        <div>
                                            <span className="font-medium text-slate-700">Interpretación:</span>
                                            <p className="text-slate-600 mt-1">{p.interpretation_guide}</p>
                                        </div>
                                    )}
                                    {p.recommended_profiles?.length > 0 && (
                                        <div>
                                            <span className="font-medium text-slate-700">Perfiles recomendados:</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {p.recommended_profiles.map(pr => (
                                                    <span key={pr} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{pr}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {p.complementary_names?.length > 0 && (
                                        <div>
                                            <span className="font-medium text-slate-700">Pruebas complementarias:</span>
                                            <p className="text-slate-600 mt-1">{p.complementary_names.filter(Boolean).join(', ')}</p>
                                        </div>
                                    )}
                                    {p.methodology && (
                                        <div>
                                            <span className="font-medium text-slate-700">Metodología:</span>
                                            <p className="text-slate-600 mt-1">{p.methodology}</p>
                                        </div>
                                    )}
                                    {p.regulatory_approval && (
                                        <div>
                                            <span className="font-medium text-slate-700">Aprobación:</span>
                                            <p className="text-slate-600 mt-1">{p.regulatory_approval}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
