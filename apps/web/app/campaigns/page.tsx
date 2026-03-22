"use client";
import React, { useState, useEffect, useCallback } from 'react';
import * as Lucide from 'lucide-react';
const {
    TrendingUp, Users, ShoppingCart, DollarSign, CheckCircle,
    Clock, MessageCircle, Loader2, RefreshCw, ChevronRight, ChevronDown,
    ArrowRight, Plus, Zap, Edit2, X, ToggleLeft, ToggleRight,
    Bot, Link2, AlertCircle, ExternalLink, Target, BarChart2,
} = Lucide as any;

import { apiFetch } from '../../hooks/useAuth';

type Platform = 'facebook' | 'instagram' | 'tiktok' | 'google';
type Period = '7d' | '30d' | '90d' | 'all';

interface Campaign {
    id: string;
    platform: Platform;
    name: string;
    platform_campaign_id: string;
    total_customers: number;
    total_conversations: number;
    resolved_conversations: number;
    total_orders: number;
    total_revenue: number;
    woocommerce_pending: number;
    is_active: boolean;
    created_at: string;
    bot_flow_id: string | null;
    bot_flow_name: string | null;
    bot_flow_active: boolean | null;
    ai_instructions: string | null;
}

interface AttributionSummary {
    campaign_id: string;
    campaign_name: string;
    platform: Platform;
    daily_budget: number | null;
    total_spend: number | null;
    spend_currency: string | null;
    total_leads: number;
    wc_sales_count: number;
    sk_sales_count: number;
    manual_sales_count: number;
    wc_revenue: number;
    sk_revenue: number;
    manual_revenue: number;
    total_revenue: number;
    roas: number | null;
}

interface BotFlow {
    id: string;
    name: string;
    is_active: boolean;
    trigger_type: string;
}

const PLATFORM_STYLE: Record<string, { label: string; bg: string; text: string; dot: string; emoji: string }> = {
    facebook: { label: 'Facebook', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', emoji: '📘' },
    instagram: { label: 'Instagram', bg: 'bg-pink-100', text: 'text-pink-700', dot: 'bg-pink-500', emoji: '📸' },
    tiktok: { label: 'TikTok', bg: 'bg-slate-900', text: 'text-white', dot: 'bg-slate-800', emoji: '🎵' },
    google: { label: 'Google', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', emoji: '🔍' },
};

const PLATFORM_GUIDE: Record<Platform, { url: string; urlLabel: string; steps: string[]; hint: string }> = {
    facebook: {
        url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns',
        urlLabel: 'Abrir Meta Ads Manager',
        steps: [
            'Abre Meta Ads Manager (botón de abajo)',
            'En la tabla principal verás la columna "Nombre de campaña"',
            'Haz clic en los ⋯ junto a la campaña → "Editar" → el ID aparece en la URL como campaign_id=XXXXXXX',
            'O activa la columna "ID de campaña" desde el ícono de columnas (⚙️) en la parte superior derecha de la tabla',
        ],
        hint: 'Es un número de ~15 dígitos · ej: 120200067123456',
    },
    instagram: {
        url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns',
        urlLabel: 'Abrir Meta Ads Manager',
        steps: [
            'Las campañas de Instagram se gestionan en Meta Ads Manager (mismo que Facebook)',
            'Abre Meta Ads Manager (botón de abajo)',
            'Filtra por plataforma "Instagram" si lo necesitas',
            'Copia el ID de campaña desde la tabla o la URL de edición',
        ],
        hint: 'Instagram usa el mismo ID numérico que Facebook Ads Manager',
    },
    tiktok: {
        url: 'https://ads.tiktok.com/i18n/perf/campaign',
        urlLabel: 'Abrir TikTok Ads Manager',
        steps: [
            'Abre TikTok Ads Manager (botón de abajo)',
            'Ve al menú "Campaigns" (Campañas) en la barra lateral',
            'Ubica la campaña en la tabla',
            'El ID aparece debajo del nombre de la campaña o en la URL al hacer clic en ella',
        ],
        hint: 'El ID de TikTok tiene formato: 7XXXXXXXXXXXXXXXXXX (19 dígitos)',
    },
    google: {
        url: 'https://ads.google.com/aw/campaigns',
        urlLabel: 'Abrir Google Ads',
        steps: [
            'Abre Google Ads (botón de abajo)',
            'Ve a "Campañas" en el menú de la izquierda',
            'Selecciona la campaña y mira la URL: contendrá campaignId=XXXXXXXXXX',
            'O activa la columna "ID de campaña" desde "Columnas" → "Atributos de campaña"',
        ],
        hint: 'El ID de Google es numérico · ej: 1234567890',
    },
};

function FunnelBar({ conversations, resolved, orders }: { conversations: number; resolved: number; orders: number }) {
    const base = Math.max(conversations, 1);
    const pResolv = Math.round((resolved / base) * 100);
    const pOrders = Math.round((orders / base) * 100);
    return (
        <div className="flex items-center gap-1 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{conversations}</span>
            <ArrowRight className="w-3 h-3 shrink-0 text-slate-300" />
            <span className={pResolv > 0 ? 'text-green-600 font-medium' : ''}>{resolved}</span>
            <span className="text-slate-300">({pResolv}%)</span>
            <ArrowRight className="w-3 h-3 shrink-0 text-slate-300" />
            <span className={pOrders > 0 ? 'text-yellow-600 font-medium' : ''}>{orders}</span>
            <span className="text-slate-300">({pOrders}%)</span>
        </div>
    );
}

function StatCard({ icon, label, value, highlight = false, sub }: {
    icon: React.ReactNode; label: string; value: string | number; highlight?: boolean; sub?: string;
}) {
    return (
        <div className={`bg-white rounded-xl border p-4 shadow-sm ${highlight ? 'border-orange-300' : ''}`}>
            <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-slate-500">{label}</span></div>
            <p className={`text-2xl font-bold ${highlight ? 'text-orange-600' : 'text-slate-800'}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
    );
}

function NewCampaignModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const [platform, setPlatform] = useState<Platform>('facebook');
    const [name, setName] = useState('');
    const [extId, setExtId] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showGuide, setShowGuide] = useState(true);

    const guide = PLATFORM_GUIDE[platform];

    const save = async () => {
        if (!name.trim() || !extId.trim()) { setError('Nombre e ID de campaña son requeridos'); return; }
        setSaving(true);
        try {
            await apiFetch('/api/campaigns', {
                method: 'POST',
                body: JSON.stringify({ platform, name: name.trim(), platform_campaign_id: extId.trim() }),
            });
            onSaved();
        } catch (e) { setError('Error al guardar'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="font-bold text-lg">Registrar campaña manualmente</h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Selector de plataforma */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Plataforma</label>
                        <div className="grid grid-cols-4 gap-2">
                            {(Object.keys(PLATFORM_STYLE) as Platform[]).map(p => (
                                <button key={p} onClick={() => { setPlatform(p); setShowGuide(true); }}
                                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${platform === p ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                    <span className="text-xl">{PLATFORM_STYLE[p].emoji}</span>
                                    {PLATFORM_STYLE[p].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Guía paso a paso */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
                        <button onClick={() => setShowGuide(v => !v)}
                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors">
                            <span className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                ¿Cómo encontrar el ID en {PLATFORM_STYLE[platform].label}?
                            </span>
                            {showGuide ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {showGuide && (
                            <div className="px-4 pb-4 space-y-3">
                                <ol className="space-y-2">
                                    {guide.steps.map((step, i) => (
                                        <li key={i} className="flex gap-2.5 text-xs text-blue-900">
                                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                                            <span className="pt-0.5">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                                <p className="text-[11px] text-blue-600 bg-blue-100 rounded-lg px-3 py-1.5 font-medium">
                                    {guide.hint}
                                </p>
                                <a href={guide.url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    {guide.urlLabel}
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Formulario */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la campaña</label>
                        <input value={name} onChange={e => setName(e.target.value)}
                            placeholder="ej: Black Friday 2024 – Conversión"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            ID de campaña ({PLATFORM_STYLE[platform].label})
                        </label>
                        <input value={extId} onChange={e => setExtId(e.target.value)}
                            placeholder={platform === 'google' ? 'ej: 1234567890' : platform === 'tiktok' ? 'ej: 7123456789012345678' : 'ej: 120200067123456'}
                            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>

                    {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
                </div>

                <div className="flex gap-3 p-6 border-t">
                    <button onClick={save} disabled={saving}
                        className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar campaña
                    </button>
                    <button onClick={onClose} className="px-6 py-2.5 rounded-lg border text-slate-600 hover:bg-slate-50 font-medium">Cancelar</button>
                </div>
            </div>
        </div>
    );
}

function LinkFlowModal({ campaign, flows, onClose, onSaved }: {
    campaign: Campaign;
    flows: BotFlow[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [selectedFlow, setSelectedFlow] = useState(campaign.bot_flow_id ?? '');
    const [saving, setSaving] = useState(false);

    const campaignFlows = flows.filter(f => f.trigger_type === 'campaign');

    const save = async () => {
        setSaving(true);
        try {
            if (selectedFlow) {
                await apiFetch(`/api/flows/${selectedFlow}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        trigger_type: 'campaign',
                        trigger_config: { campaign_id: campaign.id },
                        is_active: true,
                    }),
                });
            }
            onSaved();
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const createAndLink = async () => {
        setSaving(true);
        try {
            await apiFetch('/api/flows', {
                method: 'POST',
                body: JSON.stringify({
                    name: `Auto-respuesta: ${campaign.name || campaign.platform_campaign_id}`,
                    trigger_type: 'campaign',
                    trigger_config: { campaign_id: campaign.id },
                    steps: [{ id: 'step1', type: 'send_text', content: '¡Hola! Gracias por contactarnos a través de nuestra campaña. Un agente te atenderá en breve. 😊' }],
                    channel_providers: null,
                    priority: 1,
                }),
            });
            onSaved();
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h3 className="font-bold text-lg">Vincular flujo automático</h3>
                        <p className="text-sm text-slate-500 mt-0.5">{campaign.name || campaign.platform_campaign_id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600">
                        Vincula un flujo de respuesta automática que se activará cuando un cliente llegue desde esta campaña.
                    </p>

                    {campaignFlows.length > 0 ? (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">Seleccionar flujo existente</label>
                            <div className="space-y-2">
                                {campaignFlows.map(f => (
                                    <label key={f.id} className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                        <input type="radio" name="flow" value={f.id} checked={selectedFlow === f.id}
                                            onChange={() => setSelectedFlow(f.id)} />
                                        <Bot className="w-4 h-4 text-blue-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-800">{f.name}</p>
                                            <p className="text-xs text-slate-400">{f.is_active ? 'Activo' : 'Pausado'}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                            <p className="font-medium mb-1">No hay flujos de campaña disponibles</p>
                            <p className="text-xs text-blue-600">Puedes crear uno automáticamente con un mensaje de bienvenida básico.</p>
                        </div>
                    )}

                    <div className="border-t pt-4">
                        <button onClick={createAndLink} disabled={saving}
                            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Crear flujo de bienvenida automáticamente
                        </button>
                    </div>
                </div>
                {campaignFlows.length > 0 && (
                    <div className="flex gap-3 p-6 border-t">
                        <button onClick={save} disabled={saving || !selectedFlow}
                            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Vincular flujo
                        </button>
                        <button onClick={onClose} className="px-6 py-2.5 rounded-lg border text-slate-600 hover:bg-slate-50 font-medium">Cancelar</button>
                    </div>
                )}
            </div>
        </div>
    );
}

function RoasBadge({ roas }: { roas: number | null }) {
    if (roas === null) return <span className="text-xs text-slate-300">—</span>;
    const color = roas >= 3 ? 'bg-green-100 text-green-700' : roas >= 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
    return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{roas.toFixed(2)}x</span>;
}

function AIInstructionsModal({ campaign, onClose, onSaved }: { campaign: Campaign; onClose: () => void; onSaved: () => void }) {
    const [instructions, setInstructions] = useState(campaign.ai_instructions || '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await apiFetch(`/api/campaigns/${campaign.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ ai_instructions: instructions }),
            });
            onSaved();
        } catch (e) {
            console.error('Error saving instructions', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b shrink-0">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2"><Bot className="w-5 h-5 text-blue-500" /> Conocimiento de Campaña</h3>
                        <p className="text-sm text-slate-500">{campaign.name || campaign.platform_campaign_id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto space-y-4">
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-sm">
                        <p className="font-semibold mb-1">¿Cómo funciona esto?</p>
                        <p>Estas instrucciones se injectarán al "cerebro" del bot cuando un cliente interaccione por primera vez a través de este anuncio. Úsalo para explicar sobre la promoción, el producto específico del anuncio, precios especiales, objeciones comunes, etc. Si lo dejas en blanco, el bot usará la atención regular configurada en los flujos generales.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Instrucciones o Contexto del Anuncio</label>
                        <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="Ej: Esta campaña es sobre la prueba 'Cardiac Combo Advanced'. Cuesta $975 MXN. La oferta principal es que el envío es gratis en la primera compra. Si preguntan por caducidad, diles que tienen 18 meses. Proyecta un tono médico y serio pero persuasivo a la venta."
                            className="w-full h-64 border border-slate-300 rounded-xl p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                        />
                    </div>
                </div>
                <div className="flex gap-3 p-6 border-t shrink-0">
                    <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar Conocimiento
                    </button>
                    <button onClick={onClose} className="px-6 py-2.5 border rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
                </div>
            </div>
        </div>
    );
}

export default function CampaignsPage() {
    const [mode, setMode] = useState<'atribution' | 'bulk'>('atribution');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [attrSummary, setAttrSummary] = useState<AttributionSummary[]>([]);
    const [bulkCampaigns, setBulkCampaigns] = useState<any[]>([]);
    const [flows, setFlows] = useState<BotFlow[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [editingAI, setEditingAI] = useState<Campaign | null>(null);
    const [showNew, setShowNew] = useState(false);
    const [showNewBulk, setShowNewBulk] = useState(false);
    const [linkingCampaign, setLinkingCampaign] = useState<Campaign | null>(null);
    const [period, setPeriod] = useState<Period>('30d');
    const [syncingFacebook, setSyncingFacebook] = useState(false);
    const [syncingGoogle, setSyncingGoogle] = useState(false);
    const [syncResult, setSyncResult] = useState<{
        imported: number;
        accounts: { id: string; name: string; campaigns: number }[];
        errors?: string[];
        detail?: string;
        source?: 'meta' | 'google';
    } | null>(null);
    const [metaToken, setMetaToken] = useState('');
    const [showTokenInput, setShowTokenInput] = useState(false);

    const handleSyncFacebook = async (tokenOverride?: string) => {
        setSyncingFacebook(true);
        setSyncResult(null);
        try {
            const body: any = {};
            if (tokenOverride) body.access_token = tokenOverride;
            const res = await apiFetch('/api/campaigns/sync-facebook', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                setSyncResult({ imported: 0, accounts: [], detail: data.detail || data.error || 'Error desconocido', errors: data.hint ? [data.hint] : undefined });
                setShowTokenInput(true);
                return;
            }
            await loadCampaigns();
            setSyncResult(data);
            setShowTokenInput(false);
            setMetaToken('');
        } catch (e: any) {
            console.error('[handleSyncFacebook] caught error:', e?.message, e?.stack);
            setSyncResult({ imported: 0, accounts: [], detail: e?.message || 'Error de conexión con el servidor' });
        } finally {
            setSyncingFacebook(false);
        }
    };

    const handleSyncGoogle = async () => {
        setSyncingGoogle(true);
        setSyncResult(null);
        try {
            const res = await apiFetch('/api/campaigns/sync-google', { method: 'POST', body: JSON.stringify({}) });
            const data = await res.json();
            await loadCampaigns();
            setSyncResult({ ...data, source: 'google' });
        } catch (e: any) {
            console.error('[handleSyncGoogle] caught error:', e?.message);
            setSyncResult({ imported: 0, accounts: [], detail: e?.message || 'Error al sincronizar Google Ads', source: 'google' });
        } finally {
            setSyncingGoogle(false);
        }
    };

    const loadBulkCampaigns = async () => {
        try {
            const res = await apiFetch('/api/bulk-campaigns');
            const data = await res.json();
            setBulkCampaigns(data);
        } catch (e) { console.error(e); }
    };

    const loadCampaigns = useCallback(async () => {
        const data = await apiFetch('/api/campaigns').then(r => r.json());
        setCampaigns(data.map((c: any) => ({
            ...c,
            total_customers: Number(c.total_customers),
            total_conversations: Number(c.total_conversations),
            resolved_conversations: Number(c.resolved_conversations),
            total_orders: Number(c.total_orders),
            total_revenue: parseFloat(c.total_revenue),
            woocommerce_pending: Number(c.woocommerce_pending),
        })));
    }, []);

    const loadAttrSummary = useCallback(async (p: Period) => {
        try {
            const data = await apiFetch(`/api/attributions/summary?period=${p}`).then(r => r.json());
            setAttrSummary(data.map((s: any) => ({
                ...s,
                total_leads: Number(s.total_leads),
                wc_sales_count: Number(s.wc_sales_count),
                sk_sales_count: Number(s.sk_sales_count),
                manual_sales_count: Number(s.manual_sales_count),
                wc_revenue: parseFloat(s.wc_revenue),
                sk_revenue: parseFloat(s.sk_revenue),
                manual_revenue: parseFloat(s.manual_revenue),
                total_revenue: parseFloat(s.total_revenue),
                total_spend: s.total_spend != null ? parseFloat(s.total_spend) : null,
                roas: s.roas !== null ? parseFloat(s.roas) : null,
            })));
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            loadCampaigns(),
            loadAttrSummary(period),
            loadBulkCampaigns(),
            apiFetch('/api/flows').then(r => r.json()).then(setFlows),
        ]).catch(console.error).finally(() => setLoading(false));
    }, [loadCampaigns, loadAttrSummary, period]);

    const totals = attrSummary.reduce(
        (acc, s) => ({
            leads: acc.leads + s.total_leads,
            wc: acc.wc + s.wc_sales_count,
            sk: acc.sk + s.sk_sales_count,
            manual: acc.manual + s.manual_sales_count,
            revenue: acc.revenue + s.total_revenue,
            spend: acc.spend + (s.total_spend ?? 0),
        }),
        { leads: 0, wc: 0, sk: 0, manual: 0, revenue: 0, spend: 0 }
    );
    const totalRoas = totals.spend > 0 ? totals.revenue / totals.spend : null;

    const toggleCampaign = async (c: Campaign) => {
        await apiFetch(`/api/campaigns/${c.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !c.is_active }) });
        setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex border-b">
                <button onClick={() => setMode('atribution')}
                    className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${mode === 'atribution' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                    Inbound (Atribución)
                </button>
                <button onClick={() => setMode('bulk')}
                    className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${mode === 'bulk' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                    Outbound (Campañas Masivas)
                </button>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{mode === 'atribution' ? 'Atribución de Campañas' : 'Campañas Masivas'}</h1>
                    <p className="text-slate-500 text-sm mt-1">{mode === 'atribution' ? 'ROAS · Leads → WC · Agentes (SalesKing) · Manual' : 'Envío masivo de mensajes a tus contactos'}</p>
                </div>
                {mode === 'atribution' ? (
                    <div className="flex items-center gap-3">
                        {/* Period filter */}
                        <div className="flex rounded-lg border overflow-hidden bg-white text-xs font-medium">
                            {(['7d', '30d', '90d', 'all'] as Period[]).map(p => (
                                <button key={p} onClick={() => { setPeriod(p); loadAttrSummary(p); }}
                                    className={`px-3 py-2 transition-colors ${period === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    {p === 'all' ? 'Todo' : p}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => handleSyncFacebook()} disabled={syncingFacebook || syncingGoogle} className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors shadow-sm disabled:opacity-50">
                            {syncingFacebook ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {syncingFacebook ? 'Sincronizando...' : '📘 Meta'}
                        </button>
                        <button onClick={() => handleSyncGoogle()} disabled={syncingFacebook || syncingGoogle} className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors shadow-sm disabled:opacity-50">
                            {syncingGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {syncingGoogle ? 'Sincronizando...' : '🔍 Google'}
                        </button>
                        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 bg-white border px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
                            <Plus className="w-4 h-4" /> Registrar manual
                        </button>
                    </div>
                ) : (
                    <button onClick={() => setShowNewBulk(true)} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                        <Plus className="w-4 h-4" /> Nueva Campaña Masiva
                    </button>
                )}
            </div>

            {mode === 'atribution' ? (
                <>
                    {/* Resultado de sincronización / input de token */}
                    {(syncResult || showTokenInput) && (
                        <div className={`rounded-xl border p-4 space-y-3 ${syncResult?.detail ? 'bg-red-50 border-red-200' : syncResult ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex gap-3 items-start">
                                <div className="flex-1">
                                    {syncResult?.detail ? (
                                        <>
                                            <p className="text-sm font-semibold text-red-700">Error al sincronizar</p>
                                            <p className="text-xs text-red-600 mt-0.5">{syncResult.detail}</p>
                                            {syncResult.errors?.map((e, i) => <p key={i} className="text-xs text-red-500 mt-0.5">{e}</p>)}
                                        </>
                                    ) : syncResult ? (
                                        <>
                                            <p className="text-sm font-semibold text-green-700">
                                                {syncResult.source === 'google' ? '🔍 Google Ads' : '📘 Meta Ads'} — {syncResult.imported} campaña{syncResult.imported !== 1 ? 's' : ''} importada{syncResult.imported !== 1 ? 's' : ''}
                                            </p>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {syncResult.accounts?.map(a => (
                                                    <span key={a.id} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                                        {a.name}: {a.campaigns} campaña{a.campaigns !== 1 ? 's' : ''}
                                                    </span>
                                                ))}
                                            </div>
                                            {syncResult.errors && syncResult.errors.length > 0 && (
                                                <div className="mt-2">{syncResult.errors.map((e, i) => <p key={i} className="text-xs text-amber-600">{e}</p>)}</div>
                                            )}
                                        </>
                                    ) : null}
                                </div>
                                <button onClick={() => { setSyncResult(null); setShowTokenInput(false); setMetaToken(''); }} className="text-slate-400 hover:text-slate-600 p-1">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Input para pegar token ad-hoc cuando no hay token configurado */}
                            {showTokenInput && (
                                <div className="border-t border-red-200 pt-3 space-y-2">
                                    <p className="text-xs font-semibold text-slate-700">Pega tu Meta Access Token para continuar:</p>
                                    <div className="flex gap-2">
                                        <input
                                            value={metaToken}
                                            onChange={e => setMetaToken(e.target.value)}
                                            placeholder="EAAxxxxxxxxxx..."
                                            className="flex-1 border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        />
                                        <button
                                            onClick={() => handleSyncFacebook(metaToken)}
                                            disabled={!metaToken.startsWith('EAA') || syncingFacebook}
                                            className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-1">
                                            {syncingFacebook ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                            Reintentar
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-500">
                                        Genera un token con permisos <code className="bg-slate-100 px-1 rounded">ads_read</code> en{' '}
                                        <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">
                                            Graph API Explorer
                                        </a>
                                        {' '}o guárdalo permanentemente en <code className="bg-slate-100 px-1 rounded">.env → META_ACCESS_TOKEN</code>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* KPI cards */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <StatCard icon={<Users className="w-5 h-5 text-blue-500" />} label="Leads totales" value={totals.leads} />
                        <StatCard icon={<ShoppingCart className="w-5 h-5 text-purple-500" />} label="Ventas WC" value={totals.wc} />
                        <StatCard icon={<CheckCircle className="w-5 h-5 text-orange-500" />} label="Ventas Agentes" value={totals.sk + totals.manual} />
                        <StatCard icon={<DollarSign className="w-5 h-5 text-green-500" />} label="Revenue total" value={`$${totals.revenue.toLocaleString()}`} />
                        <StatCard icon={<TrendingUp className="w-5 h-5 text-slate-500" />} label="Gasto estimado" value={totals.spend > 0 ? `$${totals.spend.toLocaleString()}` : '—'} />
                        <StatCard icon={<BarChart2 className="w-5 h-5 text-indigo-500" />}
                            label="ROAS global"
                            value={totalRoas !== null ? `${totalRoas.toFixed(2)}x` : '—'}
                            highlight={totalRoas !== null && totalRoas >= 3} />
                    </div>

                    {/* Attribution table */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden min-h-[300px]">
                        {loading ? (
                            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                        ) : attrSummary.length === 0 && campaigns.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">Sin campañas registradas</div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="w-8 px-2"></th>
                                        <th className="text-left px-4 py-3 font-medium text-slate-600">Campaña</th>
                                        <th className="text-left px-4 py-3 font-medium text-slate-600">Plataforma</th>
                                        <th className="text-right px-4 py-3 font-medium text-slate-600">Leads</th>
                                        <th className="text-right px-4 py-3 font-medium text-slate-600">
                                            <span title="Ventas de WooCommerce online">Ventas WC</span>
                                        </th>
                                        <th className="text-right px-4 py-3 font-medium text-slate-600">
                                            <span title="Ventas cerradas por agentes (SalesKing + manual)">Ventas Agentes</span>
                                        </th>
                                        <th className="text-right px-4 py-3 font-medium text-slate-600">Revenue</th>
                                        <th className="text-right px-4 py-3 font-medium text-slate-600">Conv%</th>
                                        <th className="text-center px-4 py-3 font-medium text-slate-600">ROAS</th>
                                        <th className="w-8 px-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {attrSummary.map(s => {
                                        const style = PLATFORM_STYLE[s.platform] ?? PLATFORM_STYLE.facebook;
                                        const convPct = s.total_leads > 0 ? Math.round(((s.wc_sales_count + s.sk_sales_count + s.manual_sales_count) / s.total_leads) * 100) : 0;
                                        const isExpanded = expanded === s.campaign_id;
                                        return (
                                            <React.Fragment key={s.campaign_id}>
                                                <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : s.campaign_id)}>
                                                    <td className="px-2 py-3 text-slate-400">
                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-slate-800">{s.campaign_name || s.campaign_id}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}>
                                                            {style.emoji} {style.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">{s.total_leads}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="text-purple-700 font-medium">{s.wc_sales_count}</span>
                                                        {s.wc_revenue > 0 && <span className="text-xs text-slate-400 ml-1">${s.wc_revenue.toLocaleString()}</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="text-orange-600 font-medium">{s.sk_sales_count + s.manual_sales_count}</span>
                                                        {(s.sk_revenue + s.manual_revenue) > 0 && <span className="text-xs text-slate-400 ml-1">${(s.sk_revenue + s.manual_revenue).toLocaleString()}</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-800">${s.total_revenue.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right text-xs">{convPct > 0 ? `${convPct}%` : <span className="text-slate-300">—</span>}</td>
                                                    <td className="px-4 py-3 text-center"><RoasBadge roas={s.roas} /></td>
                                                    <td className="px-2 py-3">
                                                        {/* Keep toggle from campaigns list */}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-blue-50/50">
                                                        <td colSpan={10} className="px-8 py-3">
                                                            <div className="grid grid-cols-3 gap-4 text-xs">
                                                                <div className="bg-white rounded-lg border p-3">
                                                                    <p className="font-semibold text-purple-700 mb-1">🛒 WooCommerce (online)</p>
                                                                    <p>{s.wc_sales_count} ventas — ${s.wc_revenue.toLocaleString()}</p>
                                                                </div>
                                                                <div className="bg-white rounded-lg border p-3">
                                                                    <p className="font-semibold text-orange-600 mb-1">👑 SalesKing (agentes)</p>
                                                                    <p>{s.sk_sales_count} ventas — ${s.sk_revenue.toLocaleString()}</p>
                                                                </div>
                                                                <div className="bg-white rounded-lg border p-3">
                                                                    <p className="font-semibold text-slate-600 mb-1">✍️ Manual (inbox)</p>
                                                                    <p>{s.manual_sales_count} ventas — ${s.manual_revenue.toLocaleString()}</p>
                                                                </div>
                                                            </div>
                                                            {s.total_spend !== null && s.total_spend !== undefined && (
                                                                <p className="mt-2 text-xs text-slate-500">Gasto estimado: ${Number(s.total_spend).toLocaleString()} {s.spend_currency}</p>
                                                            )}

                                                            {(() => {
                                                                const campaign = campaigns.find(c => c.id === s.campaign_id);
                                                                if (!campaign) return null;
                                                                return (
                                                                    <div className="mt-3 bg-white rounded-lg border p-4 flex flex-col md:flex-row justify-between items-start gap-4 shadow-sm">
                                                                        <div className="flex-1">
                                                                            <p className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1"><Bot className="w-4 h-4 text-blue-500" /> Conocimiento Bot (Campañas)</p>
                                                                            <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">
                                                                                {campaign.ai_instructions || 'Usa atención regular. No se han definido instrucciones para esta campaña. Agrega contexto para una respuesta más acertada.'}
                                                                            </p>
                                                                        </div>
                                                                        <button onClick={() => setEditingAI(campaign)} className="shrink-0 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg border border-blue-200 font-medium flex items-center gap-2 transition-colors text-xs whitespace-nowrap">
                                                                            <Edit2 className="w-3.5 h-3.5" /> Editar AI
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                    {/* Also show campaigns without attribution data */}
                                    {campaigns.filter(c => !attrSummary.find(s => s.campaign_id === c.id)).map(c => {
                                        const style = PLATFORM_STYLE[c.platform] ?? PLATFORM_STYLE.facebook;
                                        const isExpanded = expanded === c.id;
                                        return (
                                            <React.Fragment key={c.id}>
                                                <tr className={`hover:bg-slate-50 ${isExpanded ? 'bg-slate-50' : ''}`}>
                                                    <td className="px-2 py-3 cursor-pointer text-slate-400" onClick={() => setExpanded(isExpanded ? null : c.id)}>
                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium cursor-pointer" onClick={() => setExpanded(isExpanded ? null : c.id)}>{c.name || c.id}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}>
                                                            {style.emoji} {style.label}
                                                        </span>
                                                    </td>
                                                    <td colSpan={6} className="px-4 py-3 text-xs text-slate-400">Sin datos de atribución en este período</td>
                                                    <td className="px-2 py-3">
                                                        <button onClick={() => toggleCampaign(c)} className="p-1 rounded hover:bg-slate-200">
                                                            {c.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-slate-50">
                                                        <td colSpan={10} className="px-8 pb-4">
                                                            <div className="bg-white rounded-lg border p-4 flex flex-col md:flex-row justify-between items-start gap-4 shadow-sm">
                                                                <div className="flex-1">
                                                                    <p className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1"><Bot className="w-4 h-4 text-blue-500" /> Conocimiento Bot (Campañas)</p>
                                                                    <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">
                                                                        {c.ai_instructions || 'Usa atención regular. No se han definido instrucciones para esta campaña. Agrega contexto para una respuesta más acertada.'}
                                                                    </p>
                                                                </div>
                                                                <button onClick={() => setEditingAI(c)} className="shrink-0 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg border border-blue-200 font-medium flex items-center gap-2 transition-colors text-xs whitespace-nowrap">
                                                                    <Edit2 className="w-3.5 h-3.5" /> Editar AI
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            ) : (
                <BulkCampaignList campaigns={bulkCampaigns} onRefresh={loadBulkCampaigns} />
            )}

            {showNew && <NewCampaignModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); loadCampaigns(); }} />}
            {showNewBulk && <NewBulkCampaignModal onClose={() => setShowNewBulk(false)} onSaved={() => { setShowNewBulk(false); loadBulkCampaigns(); }} />}
            {linkingCampaign && <LinkFlowModal campaign={linkingCampaign} flows={flows} onClose={() => setLinkingCampaign(null)} onSaved={() => { setLinkingCampaign(null); loadCampaigns(); }} />}
            {editingAI && <AIInstructionsModal campaign={editingAI} onClose={() => setEditingAI(null)} onSaved={() => { setEditingAI(null); loadCampaigns(); }} />}
        </div>
    );
}

function BulkCampaignList({ campaigns, onRefresh }: { campaigns: any[], onRefresh: () => void }) {
    const startCampaign = async (id: string) => {
        await apiFetch(`/api/bulk-campaigns/${id}/start`, { method: 'POST' });
        onRefresh();
    };

    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden min-h-[300px]">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                    <tr>
                        <th className="text-left px-4 py-3">Campaña</th>
                        <th className="text-left px-4 py-3">Estado</th>
                        <th className="text-right px-4 py-3">Progreso</th>
                        <th className="text-right px-4 py-3">Creada</th>
                        <th className="w-24 px-4 py-3">Acción</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {campaigns.map(c => (
                        <tr key={c.id}>
                            <td className="px-4 py-3 font-medium">{c.name}</td>
                            <td className="px-4 py-3 uppercase text-[10px] font-bold">
                                <span className={`px-2 py-0.5 rounded ${c.status === 'completed' ? 'bg-green-100 text-green-700' : c.status === 'running' ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
                                    {c.status}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-right">{c.sent_count} / {c.total_count}</td>
                            <td className="px-4 py-3 text-right text-slate-400">{new Date(c.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-center">
                                {c.status === 'draft' && (
                                    <button onClick={() => startCampaign(c.id)} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-blue-700">Enviar</button>
                                )}
                            </td>
                        </tr>
                    ))}
                    {campaigns.length === 0 && (
                        <tr><td colSpan={5} className="py-20 text-center text-slate-400">Sin campañas masivas registradas</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

function NewBulkCampaignModal({ onClose, onSaved }: { onClose: () => void, onSaved: () => void }) {
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [label, setLabel] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!name || !message) return;
        setSaving(true);
        try {
            await apiFetch('/api/bulk-campaigns', {
                method: 'POST',
                body: JSON.stringify({ name, message_template: message, filters: { label } })
            });
            onSaved();
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="font-bold text-lg">Nueva Campaña Masiva</h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la campaña</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ej: Promo Marzo" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Filtrar por Etiqueta</label>
                        <input value={label} onChange={e => setLabel(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ej: clientes_vip" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mensaje</label>
                        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Hola {{name}}, tenemos una oferta..." />
                        <p className="text-[10px] text-slate-400 mt-1">Usa {"{{name}}"} para personalizar el mensaje.</p>
                    </div>
                </div>
                <div className="flex gap-3 p-6 border-t">
                    <button onClick={save} disabled={saving || !name || !message} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">
                        {saving ? 'Guardando...' : 'Crear Campaña'}
                    </button>
                    <button onClick={onClose} className="px-6 py-2.5 rounded-lg border text-slate-600 hover:bg-slate-50">Cancelar</button>
                </div>
            </div>
        </div>
    );
}
