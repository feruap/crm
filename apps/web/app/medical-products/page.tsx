'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, FileText, Search, RefreshCw, AlertCircle, ExternalLink, Users, FlaskConical, Stethoscope, DollarSign, X, Check, ChevronDown, Save, Eye, BookOpen, Upload } from 'lucide-react';
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
    frecuencia_uso: string | null;
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

const CATEGORIES = [
    'infecciosas', 'embarazo', 'drogas', 'metabolicas',
    'cardiologicas', 'oncologicas', 'ets', 'respiratorias',
    'gastrointestinal', 'molecular', 'equipos', 'consumibles', 'otros',
];

const SAMPLE_TYPES = [
    'sangre_total', 'suero', 'plasma', 'orina', 'hisopo_nasal',
    'hisopo_orofaringeo', 'saliva', 'heces', 'esputo', 'secrecion',
];

// ─────────────────────────────────────────────
// Semáforo dot component
// ─────────────────────────────────────────────
function Dot({ ok, title }: { ok: boolean; title?: string }) {
    return (
        <span title={title || ''} className={`inline-block w-3 h-3 rounded-full ${ok ? 'bg-green-500' : 'bg-red-400'}`} />
    );
}

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
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${colors[category] || 'bg-slate-100 text-slate-600'}`}>
            {category}
        </span>
    );
}

function formatPrice(val: number | null): string {
    if (!val) return '-';
    return `$${val.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
}

// ─────────────────────────────────────────────
// Detail Panel (when clicking a product row)
// ─────────────────────────────────────────────
function DetailPanel({ product, onClose, onSave }: { product: MedicalProduct; onClose: () => void; onSave: (id: number, data: Record<string, unknown>) => Promise<void> }) {
    const [tab, setTab] = useState<'medico' | 'lab' | 'tecnico' | 'precios'>('medico');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<Record<string, unknown>>({});

    const startEdit = () => {
        setFormData({
            // Técnico
            analito: product.analito || '',
            sample_type: product.sample_type || '',
            volumen_muestra: product.volumen_muestra || '',
            sensitivity: product.sensitivity || '',
            specificity: product.specificity || '',
            result_time: product.result_time || '',
            methodology: product.methodology || '',
            punto_corte: product.punto_corte || '',
            registro_sanitario: product.registro_sanitario || '',
            storage_conditions: product.storage_conditions || '',
            shelf_life: product.shelf_life || '',
            tipo_producto: product.tipo_producto || '',
            // Clínico (médicos)
            clinical_indications: (product.clinical_indications || []).join(', '),
            clasificacion_clinica: product.clasificacion_clinica || '',
            proposito_clinico: product.proposito_clinico || '',
            especialidades: (product.especialidades || []).join(', '),
            escenarios_uso: product.escenarios_uso || '',
            perfil_paciente: product.perfil_paciente || '',
            frecuencia_uso: product.frecuencia_uso || '',
            limitaciones: product.limitaciones || '',
            resultado_positivo: product.resultado_positivo || '',
            resultado_negativo: product.resultado_negativo || '',
            // Pitch médico
            pitch_medico: product.pitch_medico || '',
            ventaja_vs_lab: product.ventaja_vs_lab || '',
            roi_medico: product.roi_medico || '',
            objeciones_medico: JSON.stringify(product.objeciones_medico || [], null, 2),
            // Pitch lab
            pitch_laboratorio: product.pitch_laboratorio || '',
            porque_agregarlo_lab: product.porque_agregarlo_lab || '',
            objeciones_laboratorio: JSON.stringify(product.objeciones_laboratorio || [], null, 2),
            // Relaciones
            cross_sells: JSON.stringify(product.cross_sells || [], null, 2),
            up_sells: JSON.stringify(product.up_sells || [], null, 2),
            palabras_clave: (product.palabras_clave || []).join(', '),
            target_audience: (product.target_audience || []).join(', '),
            // Precios
            precio_publico: product.precio_publico || '',
            precio_por_prueba: product.precio_por_prueba || '',
            precio_sugerido_paciente: product.precio_sugerido_paciente || '',
            margen_estimado: product.margen_estimado || '',
            presentaciones: JSON.stringify(product.presentaciones || [], null, 2),
        });
        setEditing(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const processed: Record<string, unknown> = { ...formData };
            // Convert comma-separated strings to arrays
            if (typeof processed.clinical_indications === 'string')
                processed.clinical_indications = (processed.clinical_indications as string).split(',').map(s => s.trim()).filter(Boolean);
            if (typeof processed.especialidades === 'string')
                processed.especialidades = (processed.especialidades as string).split(',').map(s => s.trim()).filter(Boolean);
            if (typeof processed.palabras_clave === 'string')
                processed.palabras_clave = (processed.palabras_clave as string).split(',').map(s => s.trim()).filter(Boolean);
            if (typeof processed.target_audience === 'string')
                processed.target_audience = (processed.target_audience as string).split(',').map(s => s.trim()).filter(Boolean);
            // Parse JSON fields
            try { processed.objeciones_medico = JSON.parse(processed.objeciones_medico as string); } catch { /* keep as-is */ }
            try { processed.objeciones_laboratorio = JSON.parse(processed.objeciones_laboratorio as string); } catch { /* keep */ }
            try { processed.cross_sells = JSON.parse(processed.cross_sells as string); } catch { /* keep */ }
            try { processed.up_sells = JSON.parse(processed.up_sells as string); } catch { /* keep */ }
            try { processed.presentaciones = JSON.parse(processed.presentaciones as string); } catch { /* keep */ }
            // Numerics
            if (processed.precio_publico) processed.precio_publico = Number(processed.precio_publico) || null;
            if (processed.precio_por_prueba) processed.precio_por_prueba = Number(processed.precio_por_prueba) || null;
            if (processed.sensitivity) processed.sensitivity = Number(processed.sensitivity) || null;
            if (processed.specificity) processed.specificity = Number(processed.specificity) || null;
            // Empty strings → null
            for (const k of Object.keys(processed)) {
                if (processed[k] === '') processed[k] = null;
            }
            await onSave(product.id, processed);
            setEditing(false);
        } catch (err) {
            alert('Error guardando: ' + (err as Error).message);
        }
        setSaving(false);
    };

    const f = (key: string) => (formData[key] as string) || '';
    const setF = (key: string, val: string) => setFormData(prev => ({ ...prev, [key]: val }));

    const tabs = [
        { key: 'medico' as const, label: 'Médicos', icon: Stethoscope, color: 'emerald' },
        { key: 'lab' as const, label: 'Laboratorios', icon: FlaskConical, color: 'violet' },
        { key: 'tecnico' as const, label: 'Técnico', icon: FileText, color: 'blue' },
        { key: 'precios' as const, label: 'Precios', icon: DollarSign, color: 'amber' },
    ];

    function Field({ label, field, textarea, rows }: { label: string; field: string; textarea?: boolean; rows?: number }) {
        if (editing) {
            return (
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                    {textarea ? (
                        <textarea value={f(field)} onChange={e => setF(field, e.target.value)}
                            rows={rows || 3}
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
                    ) : (
                        <input type="text" value={f(field)} onChange={e => setF(field, e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    )}
                </div>
            );
        }
        const val = (product as any)[field];
        const display = Array.isArray(val) ? val.join(', ') : val;
        return (
            <div>
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <p className="text-sm text-slate-800 mt-0.5">{display || <span className="text-red-400 italic">Sin datos</span>}</p>
            </div>
        );
    }

    function JsonField({ label, field }: { label: string; field: string }) {
        if (editing) {
            return (
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{label} (JSON)</label>
                    <textarea value={f(field)} onChange={e => setF(field, e.target.value)}
                        rows={4}
                        className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
                </div>
            );
        }
        const val = (product as any)[field];
        if (!val || (Array.isArray(val) && val.length === 0)) {
            return (
                <div>
                    <span className="text-xs font-medium text-slate-500">{label}</span>
                    <p className="text-sm text-red-400 italic mt-0.5">Sin datos</p>
                </div>
            );
        }
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
            return (
                <div>
                    <span className="text-xs font-medium text-slate-500">{label}</span>
                    <div className="mt-1 space-y-1">
                        {val.map((item: any, i: number) => (
                            <div key={i} className="text-xs bg-slate-50 rounded p-2">
                                {item.pregunta && <><span className="text-orange-700 font-medium">"{item.pregunta}"</span><br/></>}
                                {item.respuesta && <span className="text-slate-600">{item.respuesta}</span>}
                                {item.name && <span className="text-blue-700 font-medium">{item.name}</span>}
                                {item.reason && <span className="text-slate-500 ml-1">— {item.reason}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">{product.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <CategoryBadge category={product.diagnostic_category} />
                            {product.wc_product_id && <span className="text-xs text-blue-500">WC#{product.wc_product_id}</span>}
                            {product.url_tienda && (
                                <a href={product.url_tienda} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                                    <ExternalLink size={10} /> Tienda
                                </a>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {editing ? (
                            <>
                                <button onClick={handleSave} disabled={saving}
                                    className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                                    <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                                <button onClick={() => setEditing(false)}
                                    className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200">
                                    Cancelar
                                </button>
                            </>
                        ) : (
                            <button onClick={startEdit}
                                className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                                <Pencil size={14} /> Editar
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200 px-6 flex gap-1">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                tab === t.key
                                    ? `border-${t.color}-600 text-${t.color}-700`
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}>
                            <t.icon size={14} /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6">
                    {tab === 'medico' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-emerald-700 flex items-center gap-1.5"><Stethoscope size={16} /> Información para Médicos</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Indicaciones clínicas" field="clinical_indications" />
                                <Field label="Clasificación clínica" field="clasificacion_clinica" />
                                <Field label="Propósito clínico" field="proposito_clinico" textarea />
                                <Field label="Especialidades" field="especialidades" />
                                <div className="col-span-2"><Field label="Escenarios de uso" field="escenarios_uso" textarea rows={4} /></div>
                                <Field label="Perfil del paciente" field="perfil_paciente" textarea />
                                <Field label="Frecuencia de uso" field="frecuencia_uso" />
                                <Field label="Limitaciones" field="limitaciones" textarea />
                                <Field label="Resultado positivo — qué hacer" field="resultado_positivo" textarea />
                                <Field label="Resultado negativo — qué hacer" field="resultado_negativo" textarea />
                            </div>
                            <hr className="border-slate-200" />
                            <h4 className="text-sm font-bold text-emerald-700">Pitch de Venta (Médicos)</h4>
                            <div className="grid grid-cols-1 gap-4">
                                <Field label="Pitch médico (una oración)" field="pitch_medico" textarea />
                                <Field label="Ventaja vs laboratorio tradicional" field="ventaja_vs_lab" textarea />
                                <Field label="ROI para el médico" field="roi_medico" textarea />
                                <JsonField label="Objeciones y respuestas (médico)" field="objeciones_medico" />
                            </div>
                        </div>
                    )}

                    {tab === 'lab' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-violet-700 flex items-center gap-1.5"><FlaskConical size={16} /> Información para Laboratorios</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <Field label="¿Por qué agregarlo al menú del lab?" field="porque_agregarlo_lab" textarea rows={4} />
                                <Field label="Pitch laboratorio" field="pitch_laboratorio" textarea rows={3} />
                                <JsonField label="Objeciones y respuestas (lab)" field="objeciones_laboratorio" />
                            </div>
                        </div>
                    )}

                    {tab === 'tecnico' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-blue-700 flex items-center gap-1.5"><FileText size={16} /> Datos Técnicos</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Tipo de producto" field="tipo_producto" />
                                <Field label="Analito / Biomarcador" field="analito" />
                                <Field label="Tipo de muestra" field="sample_type" />
                                <Field label="Volumen de muestra" field="volumen_muestra" />
                                <Field label="Sensibilidad (%)" field="sensitivity" />
                                <Field label="Especificidad (%)" field="specificity" />
                                <Field label="Tiempo de resultado" field="result_time" />
                                <Field label="Metodología" field="methodology" />
                                <div className="col-span-2"><Field label="Punto de corte (cut-off)" field="punto_corte" textarea /></div>
                                <Field label="Registro sanitario" field="registro_sanitario" />
                                <Field label="Almacenamiento" field="storage_conditions" />
                                <Field label="Vida útil" field="shelf_life" />
                                <Field label="Target audience" field="target_audience" />
                                <Field label="Palabras clave" field="palabras_clave" />
                            </div>
                            <hr className="border-slate-200" />
                            <h4 className="text-sm font-bold text-blue-700">Cross-sells / Up-sells</h4>
                            <div className="grid grid-cols-1 gap-4">
                                <JsonField label="Cross-sells" field="cross_sells" />
                                <JsonField label="Up-sells" field="up_sells" />
                            </div>
                        </div>
                    )}

                    {tab === 'precios' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-amber-700 flex items-center gap-1.5"><DollarSign size={16} /> Información de Precios</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Precio público (sin IVA)" field="precio_publico" />
                                <Field label="Precio por prueba" field="precio_por_prueba" />
                                <Field label="Precio sugerido al paciente" field="precio_sugerido_paciente" />
                                <Field label="Margen estimado" field="margen_estimado" />
                                <div className="col-span-2"><JsonField label="Presentaciones" field="presentaciones" /></div>
                            </div>
                            {product.wc_last_sync && (
                                <p className="text-xs text-slate-400 mt-2">Última sync WC: {new Date(product.wc_last_sync).toLocaleString('es-MX')}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function MedicalProductsPage() {
    const { authFetch } = useAuth();
    const [products, setProducts] = useState<MedicalProduct[]>([]);
    const [error, setError] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [audienceView, setAudienceView] = useState<'all' | 'medico' | 'laboratorio'>('all');
    const [search, setSearch] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [syncingProducts, setSyncingProducts] = useState(false);
    const [syncResult, setSyncResult] = useState<any>(null);
    const [prepFilter, setPrepFilter] = useState<'all' | 'prepared' | 'unprepared'>('all');
    const [activeTab, setActiveTab] = useState<'products' | 'gaps'>('products');
    const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
    const [detailProduct, setDetailProduct] = useState<MedicalProduct | null>(null);
    const [syncingMD, setSyncingMD] = useState(false);
    const [mdSyncResult, setMdSyncResult] = useState<any>(null);

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
        setSyncing(true); setSyncResult(null);
        try {
            const res = await authFetch(`${API_URL}/api/medical-products/sync-prices`, { method: 'POST' });
            setSyncResult(await res.json());
            fetchProducts();
        } catch { setSyncResult({ error: 'Error de conexión' }); }
        finally { setSyncing(false); }
    }

    async function handleSyncProducts() {
        setSyncingProducts(true); setSyncResult(null);
        try {
            const res = await authFetch(`${API_URL}/api/medical-products/sync-products`, { method: 'POST' });
            const data = await res.json();
            setSyncResult({ productSync: true, ...data });
            fetchProducts();
        } catch { setSyncResult({ error: 'Error al importar productos de WC' }); }
        finally { setSyncingProducts(false); }
    }

    async function handleSyncKnowledgeMD() {
        setSyncingMD(true); setMdSyncResult(null); setSyncResult(null);
        try {
            // Fetch the MD files from the public folder or prompt upload
            // For now, use file input approach
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = '.md';
            input.onchange = async () => {
                const files = input.files;
                if (!files || files.length === 0) { setSyncingMD(false); return; }

                let medical_md = '';
                let labs_md = '';

                for (let i = 0; i < files.length; i++) {
                    const f = files[i];
                    const text = await f.text();
                    if (f.name.includes('labs')) {
                        labs_md = text;
                    } else {
                        medical_md = text;
                    }
                }

                if (!medical_md && !labs_md) {
                    setMdSyncResult({ error: 'No se detectaron archivos MD válidos' });
                    setSyncingMD(false);
                    return;
                }

                try {
                    const res = await authFetch(`${API_URL}/api/knowledge/sync-md`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ medical_md, labs_md }),
                    });
                    const data = await res.json();
                    setMdSyncResult(data);
                    fetchProducts();
                } catch (err: any) {
                    setMdSyncResult({ error: err.message || 'Error de conexión' });
                } finally {
                    setSyncingMD(false);
                }
            };
            input.click();
            // If user cancels file picker
            setTimeout(() => { if (syncingMD) setSyncingMD(false); }, 60000);
        } catch {
            setMdSyncResult({ error: 'Error iniciando sincronización' });
            setSyncingMD(false);
        }
    }

    async function handleSaveProduct(id: number, data: Record<string, unknown>) {
        const res = await authFetch(`${API_URL}/api/medical-products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');
        await fetchProducts();
        // Update detail panel with fresh data
        const updated = await authFetch(`${API_URL}/api/medical-products/${id}`);
        setDetailProduct(await updated.json());
    }

    async function handleDelete(id: number) {
        if (!confirm('¿Eliminar este producto médico?')) return;
        await authFetch(`${API_URL}/api/medical-products/${id}`, { method: 'DELETE' });
        fetchProducts();
    }

    async function resolveGap(gapId: number, status: string) {
        await authFetch(`${API_URL}/api/medical-products/knowledge-gaps/${gapId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        fetchGaps();
    }

    // ── Preparation scoring ──
    function medScore(p: MedicalProduct): { done: number; total: number } {
        const checks = [
            !!(p.clinical_indications?.length > 0),
            !!p.proposito_clinico,
            !!p.escenarios_uso,
            !!p.pitch_medico,
            !!p.roi_medico,
            !!(p.objeciones_medico?.length > 0),
        ];
        return { done: checks.filter(Boolean).length, total: checks.length };
    }

    function labScore(p: MedicalProduct): { done: number; total: number } {
        const checks = [
            !!p.porque_agregarlo_lab,
            !!p.pitch_laboratorio,
            !!(p.objeciones_laboratorio?.length > 0),
        ];
        return { done: checks.filter(Boolean).length, total: checks.length };
    }

    function techScore(p: MedicalProduct): { done: number; total: number } {
        const checks = [
            !!p.sample_type,
            !!p.sensitivity,
            !!p.result_time,
            !!p.analito,
            !!p.registro_sanitario,
            parseInt(p.chunk_count || '0') > 0,
        ];
        return { done: checks.filter(Boolean).length, total: checks.length };
    }

    function isPrepared(p: MedicalProduct): boolean {
        const m = medScore(p);
        const l = labScore(p);
        const t = techScore(p);
        return m.done >= 4 && l.done >= 2 && t.done >= 4;
    }

    // ── Filtering ──
    const filtered = products.filter(p => {
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (prepFilter === 'prepared' && !isPrepared(p)) return false;
        if (prepFilter === 'unprepared' && isPrepared(p)) return false;
        return true;
    });

    const stats = {
        total: products.length,
        prepared: products.filter(p => isPrepared(p)).length,
        unprepared: products.filter(p => !isPrepared(p)).length,
    };

    // ── Semáforo columns config ──
    const medCols = [
        { key: 'clinical_indications', label: 'Indicac.', check: (p: MedicalProduct) => !!(p.clinical_indications?.length > 0) },
        { key: 'proposito_clinico', label: 'Propósito', check: (p: MedicalProduct) => !!p.proposito_clinico },
        { key: 'escenarios_uso', label: 'Escenarios', check: (p: MedicalProduct) => !!p.escenarios_uso },
        { key: 'pitch_medico', label: 'Pitch', check: (p: MedicalProduct) => !!p.pitch_medico },
        { key: 'roi_medico', label: 'ROI', check: (p: MedicalProduct) => !!p.roi_medico },
        { key: 'objeciones_medico', label: 'Objec.', check: (p: MedicalProduct) => !!(p.objeciones_medico?.length > 0) },
    ];

    const labCols = [
        { key: 'porque_agregarlo_lab', label: 'Por qué', check: (p: MedicalProduct) => !!p.porque_agregarlo_lab },
        { key: 'pitch_laboratorio', label: 'Pitch', check: (p: MedicalProduct) => !!p.pitch_laboratorio },
        { key: 'objeciones_laboratorio', label: 'Objec.', check: (p: MedicalProduct) => !!(p.objeciones_laboratorio?.length > 0) },
    ];

    const showMed = audienceView === 'all' || audienceView === 'medico';
    const showLab = audienceView === 'all' || audienceView === 'laboratorio';

    return (
        <div className="p-6 max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Productos Médicos</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {stats.total} productos &mdash; {stats.prepared} listos, {stats.unprepared} sin preparar
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleSyncKnowledgeMD} disabled={syncingMD}
                        className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg hover:bg-emerald-200 text-sm font-medium disabled:opacity-50"
                        title="Sube los archivos MD del Knowledge Base para generar entradas Q&A con embeddings">
                        <BookOpen size={14} className={syncingMD ? 'animate-pulse' : ''} />
                        {syncingMD ? 'Procesando MD...' : 'Sync Documentación → KB'}
                    </button>
                    <button onClick={handleSyncProducts} disabled={syncingProducts}
                        className="flex items-center gap-1.5 bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-200 text-sm font-medium disabled:opacity-50">
                        <RefreshCw size={14} className={syncingProducts ? 'animate-spin' : ''} />
                        {syncingProducts ? 'Importando...' : 'Sync Productos WC'}
                    </button>
                    <button onClick={handleSync} disabled={syncing}
                        className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium disabled:opacity-50">
                        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Sincronizando...' : 'Sync Precios'}
                    </button>
                </div>
            </div>

            {/* Sync result banner */}
            {syncResult && (
                <div className={`mb-3 p-3 rounded-lg text-sm ${syncResult.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
                    {syncResult.error
                        ? `Error: ${syncResult.error}`
                        : syncResult.productSync
                            ? `Importados: ${syncResult.imported} productos nuevos de WC (${syncResult.skipped} ya existían)`
                            : `Sync: ${syncResult.synced} revisados, ${syncResult.updated} actualizados`
                    }
                    <button onClick={() => setSyncResult(null)} className="ml-2 underline">cerrar</button>
                </div>
            )}

            {/* MD Sync result banner */}
            {mdSyncResult && (
                <div className={`mb-3 p-3 rounded-lg text-sm ${mdSyncResult.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                    {mdSyncResult.error
                        ? `Error: ${mdSyncResult.error}`
                        : `✅ Documentación sincronizada: ${mdSyncResult.products_parsed} productos parseados (${mdSyncResult.medical_products} médico, ${mdSyncResult.lab_products} lab) → ${mdSyncResult.kb_entries_inserted} entradas KB, ${mdSyncResult.chunks_inserted} chunks, ${mdSyncResult.products_updated} productos actualizados${mdSyncResult.errors > 0 ? `, ${mdSyncResult.errors} errores` : ''}`
                    }
                    <button onClick={() => setMdSyncResult(null)} className="ml-2 underline">cerrar</button>
                </div>
            )}

            {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
                <button onClick={() => setActiveTab('products')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'products' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
                    Productos ({stats.total})
                </button>
                <button onClick={() => setActiveTab('gaps')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${activeTab === 'gaps' ? 'border-orange-600 text-orange-700' : 'border-transparent text-slate-500'}`}>
                    <AlertCircle size={14} /> Preguntas sin Respuesta
                </button>
            </div>

            {/* PRODUCTS TAB */}
            {activeTab === 'products' && (
                <>
                    {/* Filters row */}
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <div className="relative flex-1 max-w-xs">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar..."
                                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                            <option value="">Todas categorías</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                            {([
                                { key: 'all' as const, label: `Todos (${stats.total})` },
                                { key: 'prepared' as const, label: `Listos (${stats.prepared})` },
                                { key: 'unprepared' as const, label: `Faltan (${stats.unprepared})` },
                            ]).map(({ key, label }) => (
                                <button key={key} onClick={() => setPrepFilter(key)}
                                    className={`px-2.5 py-1.5 text-xs font-medium ${
                                        prepFilter === key
                                            ? key === 'unprepared' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                    }`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        {/* Audience view toggle */}
                        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                            {([
                                { key: 'all' as const, label: 'Ambos', icon: Users },
                                { key: 'medico' as const, label: 'Médicos', icon: Stethoscope },
                                { key: 'laboratorio' as const, label: 'Labs', icon: FlaskConical },
                            ]).map(({ key, label, icon: Icon }) => (
                                <button key={key} onClick={() => setAudienceView(key)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium ${
                                        audienceView === key
                                            ? key === 'medico' ? 'bg-emerald-600 text-white'
                                                : key === 'laboratorio' ? 'bg-violet-600 text-white'
                                                    : 'bg-blue-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                    }`}>
                                    <Icon size={12} /> {label}
                                </button>
                            ))}
                        </div>
                        <span className="text-xs text-slate-400">{filtered.length} productos</span>
                    </div>

                    {/* TABLE */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-3 py-2.5 font-semibold text-slate-700 sticky left-0 bg-slate-50 z-10 min-w-[200px]">Producto</th>
                                    <th className="px-2 py-2.5 font-semibold text-slate-700 text-center">Cat</th>
                                    <th className="px-2 py-2.5 font-semibold text-slate-700 text-right">Precio</th>
                                    <th className="px-2 py-2.5 font-semibold text-slate-700 text-center">Muestra</th>
                                    <th className="px-2 py-2.5 font-semibold text-slate-700 text-center">Sens.</th>
                                    <th className="px-2 py-2.5 font-semibold text-slate-700 text-center">Tiempo</th>
                                    <th className="px-2 py-2.5 font-semibold text-slate-700 text-center">KB</th>
                                    {showMed && (
                                        <th colSpan={medCols.length} className="px-2 py-1 text-center border-l border-slate-200">
                                            <span className="text-emerald-700 font-bold flex items-center justify-center gap-1"><Stethoscope size={11} /> Médicos</span>
                                        </th>
                                    )}
                                    {showLab && (
                                        <th colSpan={labCols.length} className="px-2 py-1 text-center border-l border-slate-200">
                                            <span className="text-violet-700 font-bold flex items-center justify-center gap-1"><FlaskConical size={11} /> Labs</span>
                                        </th>
                                    )}
                                    <th className="px-2 py-2.5 font-semibold text-slate-700 text-center border-l border-slate-200">Score</th>
                                    <th className="px-2 py-2.5 text-center">Acc.</th>
                                </tr>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="sticky left-0 bg-slate-50/50 z-10"></th>
                                    <th></th><th></th><th></th><th></th><th></th><th></th>
                                    {showMed && medCols.map(c => (
                                        <th key={c.key} className="px-1 py-1 text-[9px] text-slate-500 font-medium text-center border-l border-slate-100 first:border-l-slate-200">{c.label}</th>
                                    ))}
                                    {showLab && labCols.map(c => (
                                        <th key={c.key} className="px-1 py-1 text-[9px] text-slate-500 font-medium text-center border-l border-slate-100 first:border-l-slate-200">{c.label}</th>
                                    ))}
                                    <th className="border-l border-slate-200"></th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={99} className="text-center py-12 text-slate-400">No hay productos{search ? ' que coincidan' : ''}</td></tr>
                                )}
                                {filtered.map(p => {
                                    const ms = medScore(p);
                                    const ls = labScore(p);
                                    const ts = techScore(p);
                                    const totalDone = (showMed ? ms.done : 0) + (showLab ? ls.done : 0) + ts.done;
                                    const totalAll = (showMed ? ms.total : 0) + (showLab ? ls.total : 0) + ts.total;
                                    const pct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

                                    return (
                                        <tr key={p.id}
                                            className="border-b border-slate-100 hover:bg-blue-50/30 cursor-pointer transition-colors"
                                            onClick={() => setDetailProduct(p)}>
                                            {/* Name */}
                                            <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                                <div className="font-medium text-slate-800 truncate max-w-[220px]" title={p.name}>{p.name}</div>
                                                {p.wc_product_id && <span className="text-[9px] text-blue-400">WC#{p.wc_product_id}</span>}
                                            </td>
                                            {/* Category */}
                                            <td className="px-2 py-2 text-center"><CategoryBadge category={p.diagnostic_category} /></td>
                                            {/* Price */}
                                            <td className="px-2 py-2 text-right font-medium text-emerald-700">{formatPrice(p.precio_publico)}</td>
                                            {/* Sample */}
                                            <td className="px-2 py-2 text-center">
                                                {p.sample_type ? <span className="text-slate-600">{p.sample_type.replace(/_/g, ' ').substring(0, 12)}</span> : <span className="text-red-400">-</span>}
                                            </td>
                                            {/* Sensitivity */}
                                            <td className="px-2 py-2 text-center">
                                                {p.sensitivity ? <span className="text-slate-600">{p.sensitivity}%</span> : <span className="text-red-400">-</span>}
                                            </td>
                                            {/* Time */}
                                            <td className="px-2 py-2 text-center text-slate-600">{p.result_time || <span className="text-red-400">-</span>}</td>
                                            {/* KB chunks */}
                                            <td className="px-2 py-2 text-center">
                                                {parseInt(p.chunk_count || '0') > 0
                                                    ? <span className="text-green-600 flex items-center justify-center gap-0.5"><FileText size={10} />{p.chunk_count}</span>
                                                    : <span className="text-red-400">0</span>}
                                            </td>
                                            {/* Med semáforo */}
                                            {showMed && medCols.map(c => (
                                                <td key={c.key} className="px-1 py-2 text-center border-l border-slate-50">
                                                    <Dot ok={c.check(p)} title={c.label} />
                                                </td>
                                            ))}
                                            {/* Lab semáforo */}
                                            {showLab && labCols.map(c => (
                                                <td key={c.key} className="px-1 py-2 text-center border-l border-slate-50">
                                                    <Dot ok={c.check(p)} title={c.label} />
                                                </td>
                                            ))}
                                            {/* Score */}
                                            <td className="px-2 py-2 text-center border-l border-slate-200">
                                                <div className="flex items-center gap-1 justify-center">
                                                    <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                                            style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className={`font-bold ${pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-yellow-700' : 'text-red-600'}`}>{pct}%</span>
                                                </div>
                                            </td>
                                            {/* Actions */}
                                            <td className="px-2 py-2 text-center">
                                                <div className="flex items-center gap-1">
                                                    <button onClick={e => { e.stopPropagation(); setDetailProduct(p); }}
                                                        className="p-1 hover:bg-blue-100 rounded" title="Ver/Editar">
                                                        <Eye size={13} className="text-blue-500" />
                                                    </button>
                                                    <button onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                                                        className="p-1 hover:bg-red-100 rounded" title="Eliminar">
                                                        <Trash2 size={13} className="text-red-400" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* KNOWLEDGE GAPS TAB */}
            {activeTab === 'gaps' && (
                <div className="space-y-3">
                    <p className="text-sm text-slate-500 mb-4">
                        Preguntas que el bot no pudo responder. Resuelve para mejorar las respuestas.
                    </p>
                    {gaps.length === 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
                            No hay preguntas pendientes.
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
                                        <span>{g.frequency}x</span>
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

            {/* Detail Panel Modal */}
            {detailProduct && (
                <DetailPanel
                    product={detailProduct}
                    onClose={() => setDetailProduct(null)}
                    onSave={handleSaveProduct}
                />
            )}
        </div>
    );
}
