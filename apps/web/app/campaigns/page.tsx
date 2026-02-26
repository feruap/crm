"use client";
import React, { useState } from 'react';
import { TrendingUp, Users, ShoppingCart, DollarSign, CheckCircle, Clock } from 'lucide-react';

type Platform = 'facebook' | 'instagram' | 'tiktok' | 'google';

interface Campaign {
    id: string;
    platform: Platform;
    name: string;
    total_customers: number;
    total_orders: number;
    total_revenue: number;
    woocommerce_pending: number;
}

// ── Mock data — replace with fetch('/api/campaigns') ─────────────────────────
const MOCK: Campaign[] = [
    { id: '1', platform: 'facebook',  name: 'Promo Verano FB',       total_customers: 142, total_orders: 38, total_revenue: 18400, woocommerce_pending: 4  },
    { id: '2', platform: 'instagram', name: 'Colección Nueva IG',    total_customers:  89, total_orders: 21, total_revenue:  9300, woocommerce_pending: 0  },
    { id: '3', platform: 'tiktok',    name: 'Viral TikTok Agosto',   total_customers: 310, total_orders: 67, total_revenue: 34200, woocommerce_pending: 12 },
    { id: '4', platform: 'google',    name: 'Search Brand',          total_customers:  55, total_orders: 15, total_revenue:  7100, woocommerce_pending: 1  },
];

const PLATFORM_STYLE: Record<Platform, { label: string; bg: string; text: string }> = {
    facebook:  { label: 'Facebook',  bg: 'bg-blue-100',   text: 'text-blue-700'   },
    instagram: { label: 'Instagram', bg: 'bg-pink-100',   text: 'text-pink-700'   },
    tiktok:    { label: 'TikTok',    bg: 'bg-black',      text: 'text-white'      },
    google:    { label: 'Google',    bg: 'bg-red-100',    text: 'text-red-700'    },
};

export default function CampaignsPage() {
    const [campaigns] = useState<Campaign[]>(MOCK);

    const totals = campaigns.reduce(
        (acc, c) => ({
            customers: acc.customers + c.total_customers,
            orders: acc.orders + c.total_orders,
            revenue: acc.revenue + c.total_revenue,
            pending: acc.pending + c.woocommerce_pending,
        }),
        { customers: 0, orders: 0, revenue: 0, pending: 0 }
    );

    const syncAll = async () => {
        await fetch('/api/attributions/sync-woocommerce', { method: 'POST' });
        alert('Sincronización enviada a WooCommerce');
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Atribución de Campañas</h1>
                    <p className="text-slate-500 text-sm mt-1">FB · IG · TikTok · Google Ads → WooCommerce</p>
                </div>
                <button
                    onClick={syncAll}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    <TrendingUp className="w-4 h-4" />
                    Sincronizar con WooCommerce
                </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard icon={<Users className="w-5 h-5 text-blue-500" />}   label="Clientes atribuidos" value={totals.customers} />
                <StatCard icon={<ShoppingCart className="w-5 h-5 text-green-500" />} label="Órdenes convertidas" value={totals.orders} />
                <StatCard icon={<DollarSign className="w-5 h-5 text-yellow-500" />}  label="Revenue total" value={`$${totals.revenue.toLocaleString()}`} />
                <StatCard
                    icon={<Clock className="w-5 h-5 text-orange-500" />}
                    label="Pendientes WC"
                    value={totals.pending}
                    highlight={totals.pending > 0}
                />
            </div>

            {/* Campaign table */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Campaña</th>
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Plataforma</th>
                            <th className="text-right px-4 py-3 text-slate-500 font-medium">Clientes</th>
                            <th className="text-right px-4 py-3 text-slate-500 font-medium">Órdenes</th>
                            <th className="text-right px-4 py-3 text-slate-500 font-medium">Revenue</th>
                            <th className="text-center px-4 py-3 text-slate-500 font-medium">WooCommerce</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {campaigns.map(c => {
                            const style = PLATFORM_STYLE[c.platform];
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
                                        ${c.total_revenue.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {c.woocommerce_pending === 0
                                            ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                                            : <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                                                {c.woocommerce_pending} pendientes
                                              </span>
                                        }
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
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
