'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, Filter, Download, RefreshCw, Settings2 } from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CampaignAttribution {
    campaign_id: string;
    campaign_name: string;
    platform: string;
    platform_campaign_id: string;
    touchpoints: string;
    conversations: string;
    orders: string;
    total_revenue: string;
    avg_order_value: string;
}

interface ROASData {
    campaign_id: string;
    campaign_name: string;
    platform: string;
    ad_spend: string;
    revenue: string;
    roas: string | null;
    conversions: string;
    clicks: string;
    cost_per_click: string | null;
    cost_per_conversion: string | null;
}

interface FunnelData {
    total_touchpoints: string;
    unique_leads: string;
    total_conversations: string;
    attributed_conversations: string;
    attributed_orders: string;
    total_attributed_revenue: string;
}

interface TrendPoint {
    period: string;
    orders: string;
    revenue: string;
    attributed_revenue: string;
}

interface ConversionEvent {
    id: number;
    platform: string;
    event_name: string;
    event_id: string;
    event_value: string | null;
    currency: string;
    status: string;
    external_order_id: string | null;
    customer_name: string | null;
    created_at: string;
}

interface AttributionConfig {
    model_type: string;
    time_decay_halflife_days: number;
    position_first_weight: number;
    position_last_weight: number;
    lookback_window_days: number;
}

type TabId = 'overview' | 'roas' | 'events' | 'settings';

// ─────────────────────────────────────────────
// Formatting Helpers
// ─────────────────────────────────────────────

function fmtMXN(v: string | number): string {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(numerator: number, denominator: number): string {
    if (denominator === 0) return '—';
    return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

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

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        sent: 'bg-green-100 text-green-700',
        pending: 'bg-yellow-100 text-yellow-700',
        failed: 'bg-red-100 text-red-700',
        duplicate: 'bg-slate-100 text-slate-500',
    };
    return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] || 'bg-slate-100'}`}>
            {status}
        </span>
    );
}

// ─────────────────────────────────────────────
// Metric Card
// ─────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
    );
}

// ─────────────────────────────────────────────
// Funnel Bar (simple CSS bar)
// ─────────────────────────────────────────────

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold text-slate-800">{value.toLocaleString('es-MX')}</span>
            </div>
            <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function AnalyticsPage() {
    const { authFetch } = useAuth();
    const [tab, setTab] = useState<TabId>('overview');
    const [days, setDays] = useState(30);
    const [platformFilter, setPlatformFilter] = useState('');

    const [campaigns, setCampaigns] = useState<CampaignAttribution[]>([]);
    const [roasData, setRoasData] = useState<ROASData[]>([]);
    const [funnel, setFunnel] = useState<FunnelData | null>(null);
    const [trend, setTrend] = useState<TrendPoint[]>([]);
    const [events, setEvents] = useState<ConversionEvent[]>([]);
    const [config, setConfig] = useState<AttributionConfig | null>(null);
    const [error, setError] = useState('');
    const [recalculating, setRecalculating] = useState(false);

    const fetchOverview = useCallback(async () => {
        try {
            const qp = `days=${days}${platformFilter ? `&platform=${platformFilter}` : ''}`;
            const [campRes, funnelRes, trendRes] = await Promise.all([
                authFetch(`${API_URL}/api/analytics/attribution?${qp}`),
                authFetch(`${API_URL}/api/analytics/attribution/funnel?days=${days}`),
                authFetch(`${API_URL}/api/analytics/attribution/trend?days=${days}`),
            ]);
            setCampaigns(await campRes.json());
            setFunnel(await funnelRes.json());
            setTrend(await trendRes.json());
        } catch { setError('Error cargando datos de atribución'); }
    }, [days, platformFilter, authFetch]);

    const fetchROAS = useCallback(async () => {
        try {
            const res = await authFetch(`${API_URL}/api/analytics/attribution/roas?days=${days}`);
            setRoasData(await res.json());
        } catch { setError('Error cargando ROAS'); }
    }, [days, authFetch]);

    const fetchEvents = useCallback(async () => {
        try {
            const res = await authFetch(`${API_URL}/api/analytics/conversion-events?limit=100`);
            setEvents(await res.json());
        } catch { setError('Error cargando eventos'); }
    }, [authFetch]);

    const fetchConfig = useCallback(async () => {
        try {
            const res = await authFetch(`${API_URL}/api/analytics/attribution/config`);
            setConfig(await res.json());
        } catch { setError('Error cargando configuración'); }
    }, [authFetch]);

    useEffect(() => {
        fetchOverview();
    }, [fetchOverview]);

    useEffect(() => {
        if (tab === 'roas') fetchROAS();
        if (tab === 'events') fetchEvents();
        if (tab === 'settings') fetchConfig();
    }, [tab, fetchROAS, fetchEvents, fetchConfig]);

    async function handleRecalculate() {
        setRecalculating(true);
        try {
            const res = await authFetch(`${API_URL}/api/analytics/attribution/recalculate`, { method: 'POST' });
            const data = await res.json();
            alert(`Atribuciones recalculadas: ${data.orders_processed} órdenes procesadas con modelo "${data.model}"`);
            fetchOverview();
        } catch {
            setError('Error recalculando');
        } finally {
            setRecalculating(false);
        }
    }

    async function handleSaveConfig() {
        if (!config) return;
        try {
            const res = await authFetch(`${API_URL}/api/analytics/attribution/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            const updated = await res.json();
            setConfig(updated);
            alert('Configuración guardada. Recalcula las atribuciones para aplicar el cambio.');
        } catch {
            setError('Error guardando configuración');
        }
    }

    async function handleExportCSV() {
        const rows = campaigns.map(c => ({
            Campaña: c.campaign_name || c.platform_campaign_id,
            Plataforma: c.platform,
            Touchpoints: c.touchpoints,
            Conversaciones: c.conversations,
            Órdenes: c.orders,
            Revenue: c.total_revenue,
            'Ticket Promedio': c.avg_order_value,
        }));

        const headers = Object.keys(rows[0] || {});
        const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r as Record<string, string>)[h] ?? ''}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `atribucion_${days}d_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Tabs ──
    const tabs: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
        { id: 'overview', label: 'Resumen', icon: BarChart3 },
        { id: 'roas', label: 'ROAS', icon: TrendingUp },
        { id: 'events', label: 'Eventos CAPI', icon: RefreshCw },
        { id: 'settings', label: 'Modelo', icon: Settings2 },
    ];

    const totalRevenue = campaigns.reduce((s, c) => s + parseFloat(c.total_revenue || '0'), 0);
    const totalOrders = campaigns.reduce((s, c) => s + parseInt(c.orders || '0', 10), 0);
    const totalTouchpoints = campaigns.reduce((s, c) => s + parseInt(c.touchpoints || '0', 10), 0);

    return (
        <div className="p-6 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Atribución & Analytics</h1>
                    <p className="text-slate-500 mt-1">
                        Análisis de rendimiento por campaña y modelo de atribución multi-touch.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Days filter */}
                    <select
                        value={days}
                        onChange={e => setDays(Number(e.target.value))}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value={7}>7 días</option>
                        <option value={14}>14 días</option>
                        <option value={30}>30 días</option>
                        <option value={60}>60 días</option>
                        <option value={90}>90 días</option>
                    </select>

                    {/* Platform filter */}
                    <select
                        value={platformFilter}
                        onChange={e => setPlatformFilter(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Todas las plataformas</option>
                        <option value="facebook">Facebook</option>
                        <option value="instagram">Instagram</option>
                        <option value="google">Google</option>
                        <option value="tiktok">TikTok</option>
                    </select>

                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
                    >
                        <Download size={16} />
                        CSV
                    </button>
                </div>
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

            {/* ═══ OVERVIEW TAB ═══ */}
            {tab === 'overview' && (
                <>
                    {/* Metric cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <MetricCard label="Revenue Atribuido" value={fmtMXN(totalRevenue)} sub={`${days} días`} />
                        <MetricCard label="Órdenes" value={totalOrders.toLocaleString('es-MX')} />
                        <MetricCard label="Touchpoints" value={totalTouchpoints.toLocaleString('es-MX')} />
                        <MetricCard
                            label="Conversión"
                            value={fmtPct(totalOrders, parseInt(funnel?.unique_leads || '0', 10))}
                            sub={`${funnel?.unique_leads || 0} leads únicos`}
                        />
                    </div>

                    {/* Funnel */}
                    {funnel && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-6">
                            <h3 className="text-sm font-semibold text-slate-700 mb-4">Funnel de Conversión</h3>
                            <FunnelBar label="Touchpoints" value={parseInt(funnel.total_touchpoints)} max={parseInt(funnel.total_touchpoints)} color="bg-blue-400" />
                            <FunnelBar label="Leads Únicos" value={parseInt(funnel.unique_leads)} max={parseInt(funnel.total_touchpoints)} color="bg-indigo-400" />
                            <FunnelBar label="Conversaciones" value={parseInt(funnel.total_conversations)} max={parseInt(funnel.total_touchpoints)} color="bg-purple-400" />
                            <FunnelBar label="Con Atribución" value={parseInt(funnel.attributed_conversations)} max={parseInt(funnel.total_touchpoints)} color="bg-violet-400" />
                            <FunnelBar label="Órdenes" value={parseInt(funnel.attributed_orders)} max={parseInt(funnel.total_touchpoints)} color="bg-green-500" />
                        </div>
                    )}

                    {/* Revenue Trend (simple table, no chart lib required) */}
                    {trend.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-6">
                            <h3 className="text-sm font-semibold text-slate-700 mb-4">Tendencia de Revenue</h3>
                            <div className="overflow-x-auto">
                                <div className="flex items-end gap-1" style={{ minHeight: 120 }}>
                                    {trend.map((t, i) => {
                                        const maxRev = Math.max(...trend.map(x => parseFloat(x.revenue || '0')), 1);
                                        const height = (parseFloat(t.revenue || '0') / maxRev) * 100;
                                        return (
                                            <div key={i} className="flex flex-col items-center flex-1 min-w-[30px]">
                                                <span className="text-xs text-slate-500 mb-1">{fmtMXN(t.revenue)}</span>
                                                <div
                                                    className="w-full bg-blue-500 rounded-t"
                                                    style={{ height: `${Math.max(height, 4)}px` }}
                                                    title={`${t.orders} órdenes`}
                                                />
                                                <span className="text-xs text-slate-400 mt-1">
                                                    {new Date(t.period).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Campaign Table */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Campaña</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Touchpoints</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversaciones</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Órdenes</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ticket Prom.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {campaigns.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                            No hay datos de atribución para el periodo seleccionado.
                                        </td>
                                    </tr>
                                )}
                                {campaigns.map(c => (
                                    <tr key={c.campaign_id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-medium text-slate-800">{c.campaign_name || c.platform_campaign_id}</span>
                                                <PlatformBadge platform={c.platform} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-slate-600">{c.touchpoints}</td>
                                        <td className="px-4 py-3 text-center text-sm text-slate-600">{c.conversations}</td>
                                        <td className="px-4 py-3 text-center text-sm font-semibold text-slate-700">{c.orders}</td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{fmtMXN(c.total_revenue)}</td>
                                        <td className="px-4 py-3 text-right text-sm text-slate-600">{fmtMXN(c.avg_order_value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ═══ ROAS TAB ═══ */}
            {tab === 'roas' && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Campaña</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Gasto</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">ROAS</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversiones</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">CPC</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">CPA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {roasData.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                        No hay datos de ROAS. Asegúrate de tener campañas con gasto registrado en metadata.
                                    </td>
                                </tr>
                            )}
                            {roasData.map(r => (
                                <tr key={r.campaign_id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-medium text-slate-800">{r.campaign_name}</span>
                                            <PlatformBadge platform={r.platform} />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-slate-600">{fmtMXN(r.ad_spend)}</td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{fmtMXN(r.revenue)}</td>
                                    <td className="px-4 py-3 text-right">
                                        {r.roas ? (
                                            <span className={`text-sm font-bold ${parseFloat(r.roas) >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                                                {r.roas}x
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-slate-700">{r.conversions}</td>
                                    <td className="px-4 py-3 text-right text-sm text-slate-600">{r.cost_per_click ? fmtMXN(r.cost_per_click) : '—'}</td>
                                    <td className="px-4 py-3 text-right text-sm text-slate-600">{r.cost_per_conversion ? fmtMXN(r.cost_per_conversion) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══ EVENTS TAB ═══ */}
            {tab === 'events' && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plataforma</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Evento</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Orden</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {events.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                        No hay eventos de conversión registrados. Se crean al completar órdenes con atribución.
                                    </td>
                                </tr>
                            )}
                            {events.map(e => (
                                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-xs text-slate-500">
                                        {new Date(e.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-4 py-3">
                                        <PlatformBadge platform={e.platform === 'meta' ? 'facebook' : e.platform} />
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700">{e.event_name}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">
                                        {e.external_order_id ? `#${e.external_order_id}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                                        {e.event_value ? fmtMXN(e.event_value) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <StatusBadge status={e.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══ SETTINGS TAB ═══ */}
            {tab === 'settings' && config && (
                <div className="max-w-xl">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Modelo de Atribución</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                                <select
                                    value={config.model_type}
                                    onChange={e => setConfig({ ...config, model_type: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="first_touch">First Touch — 100% al primer contacto</option>
                                    <option value="last_touch">Last Touch — 100% al último contacto</option>
                                    <option value="linear">Linear — distribución equitativa</option>
                                    <option value="time_decay">Time Decay — más peso a lo más reciente</option>
                                    <option value="position_based">Position Based — 40/20/40</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Ventana de lookback (días)
                                </label>
                                <input
                                    type="number"
                                    value={config.lookback_window_days}
                                    onChange={e => setConfig({ ...config, lookback_window_days: Number(e.target.value) })}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {config.model_type === 'time_decay' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Halflife (días) — a los cuántos días el peso se reduce 50%
                                    </label>
                                    <input
                                        type="number"
                                        value={config.time_decay_halflife_days}
                                        onChange={e => setConfig({ ...config, time_decay_halflife_days: Number(e.target.value) })}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            )}

                            {config.model_type === 'position_based' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Peso primer touch</label>
                                        <input
                                            type="number"
                                            step="0.05"
                                            value={config.position_first_weight}
                                            onChange={e => setConfig({ ...config, position_first_weight: Number(e.target.value) })}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Peso último touch</label>
                                        <input
                                            type="number"
                                            step="0.05"
                                            value={config.position_last_weight}
                                            onChange={e => setConfig({ ...config, position_last_weight: Number(e.target.value) })}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleSaveConfig}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                Guardar Configuración
                            </button>
                            <button
                                onClick={handleRecalculate}
                                disabled={recalculating}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
                            >
                                {recalculating ? 'Calculando...' : 'Recalcular Todo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
