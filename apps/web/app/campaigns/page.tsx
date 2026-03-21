"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Users, ShoppingCart, DollarSign, CheckCircle, Clock, RefreshCw, Facebook } from 'lucide-react';

type Platform = 'facebook' | 'instagram' | 'tiktok' | 'google';

interface Campaign {
    id: string;
    platform: Platform;
    name: string;
    total_customers: number;
    total_orders: number;
    total_revenue: number;
    woocommerce_pending?: number;
    metadata?: any;
}

const PLATFORM_STYLE: Record<string, { label: string; bg: string; text: string }> = {
    facebook:  { label: 'Facebook',  bg: 'bg-blue-100',   text: 'text-blue-700'   },
    instagram: { label: 'Instagram', bg: 'bg-pink-100',   text: 'text-pink-700'   },
    tiktok:    { label: 'TikTok',    bg: 'bg-black',      text: 'text-white'      },
    google:    { label: 'Google',    bg: 'bg-red-100',    text: 'text-red-700'    },
};

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncMsg, setSyncMsg] = useState('');

    const fetchCampaigns = useCallback(async () => {
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/campaigns', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setCampaigns(data.map((c: any) => ({
                    ...c,
                    total_customers: Number(c.total_customers) || 0,
                    total_orders: Number(c.total_orders) || 0,
                    total_revenue: Number(c.total_revenue) || 0,
                    woocommerce_pending: 0,
                })));
            }
        } catch (err) {
            console.error('Error fetching campaigns:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

    const totals = campaigns.reduce(
        (acc, c) => ({
            customers: acc.customers + c.total_customers,
            orders: acc.orders + c.total_orders,
            revenue: acc.revenue + c.total_revenue,
            pending: acc.pending + (c.woocommerce_pending || 0),
        }),
        { customers: 0, orders: 0, revenue: 0, pending: 0 }
    );

    const syncFacebook = async () => {
        setSyncing(true);
        setSyncMsg('');
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/campaigns/sync-facebook', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
                setSyncMsg(`Sincronizado: ${data.imported} campanas importadas de Facebook`);
                fetchCampaigns();
            } else {
                setSyncMsg(`Error: ${data.details || data.error}`);
            }
        } catch (err: any) {
            setSyncMsg(`Error de red: ${err.message}`);
        } finally {
            setSyncing(false);
        }
    };

    const syncWooCommerce = async () => {
        const token = localStorage.getItem('token') || '';
        await fetch('/api/attributions/sync-woocommerce', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        setSyncMsg('Sincronizacion enviada a WooCommerce');
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center h-64">
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="ml-2 text-slate-500">Cargando campanas...</span>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Atribucion de Campanas</h1>
                    <p className="text-slate-500 text-sm mt-1">FB - IG - TikTok - Google Ads - WooCommerce</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={syncFacebook}
                        disabled={syncing}
                        className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors disabled:opacity-50"
                    >
                        {syncing
                            ? <RefreshCw className="w-4 h-4 animate-spin" />
                            : <Facebook className="w-4 h-4" />
                        }
                        {syncing ? 'Sincronizando...' : 'Sincronizar Facebook'}
                    </button>
                    <button
                        onClick={syncWooCommerce}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                    >
                        <TrendingUp className="w-4 h-4" />
                        Sync WooCommerce
                    </button>
                </div>
            </div>

            {syncMsg && (
                <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
                    syncMsg.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                    {syncMsg}
                </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard icon={<Users className="w-5 h-5 text-blue-500" />}   label="Clientes atribuidos" value={totals.customers} />
                <StatCard icon={<ShoppingCart className="w-5 h-5 text-green-500" />} label="Ordenes convertidas" value={totals.orders} />
                <StatCard icon={<DollarSign className="w-5 h-5 text-yellow-500" />}  label="Revenue total" value={`$${totals.revenue.toLocaleString()}`} />
                <StatCard icon={<RefreshCw className="w-5 h-5 text-indigo-500" />} label="Total campanas" value={campaigns.length} />
            </div>

            {/* Campaign table */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {campaigns.length === 0 ? (
                    <div className="p-12 text-center">
                        <Facebook className="w-12 h-12 text-blue-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-slate-700 mb-1">No hay campanas sincronizadas</h3>
                        <p className="text-slate-500 text-sm mb-4">Haz click en "Sincronizar Facebook" para importar tus campanas de Meta Ads</p>
                        <button
                            onClick={syncFacebook}
                            disabled={syncing}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                        >
                            Sincronizar ahora
                        </button>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Campana</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Plataforma</th>
                                <th className="text-right px-4 py-3 text-slate-500 font-medium">Clientes</th>
                                <th className="text-right px-4 py-3 text-slate-500 font-medium">Ordenes</th>
                                <th className="text-right px-4 py-3 text-slate-500 font-medium">Revenue</th>
                                <th className="text-center px-4 py-3 text-slate-500 font-medium">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {campaigns.map(c => {
                                const style = PLATFORM_STYLE[c.platform] || { label: c.platform, bg: 'bg-gray-100', text: 'text-gray-700' };
                                const status = c.metadata?.status;
                                return (
                                    <tr key={c.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                                                {style.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-700">{c.total_customers}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{c.total_orders}</td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                                            ${Number(c.total_revenue).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {status === 'ACTIVE'
                                                ? <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">Activa</span>
                                                : status === 'PAUSED'
                                                ? <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full font-medium">Pausada</span>
                                                : <CheckCircle className="w-4 h-4 text-slate-400 mx-auto" />
                                            }
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, highlight = false }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    highlight?: boolean;
}) {
    return (
        <div className={`bg-white rounded-xl border p-4 shadow-sm ${highlight ? 'border-orange-300' : ''}`}>
            <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-slate-500">{label}</span></div>
            <p className={`text-2xl font-bold ${highlight ? 'text-orange-600' : 'text-slate-800'}`}>{value}</p>
        </div>
    );
}
