'use client';

import { useState, useEffect } from 'react';
import { Package, ChevronDown, RefreshCw, Search, ExternalLink } from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Order {
    id: number;
    external_order_id: string;
    customer_id: string;
    customer_name: string;
    total_amount: string;
    currency: string;
    status: string;
    items: Array<{ name: string; quantity: number; total: string }>;
    order_date: string;
    campaign_name?: string;
    campaign_platform?: string;
}

const WC_STATUSES = [
    { value: 'pending', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'processing', label: 'Procesando', color: 'bg-blue-100 text-blue-700' },
    { value: 'on-hold', label: 'En espera', color: 'bg-orange-100 text-orange-700' },
    { value: 'completed', label: 'Completado', color: 'bg-green-100 text-green-700' },
    { value: 'cancelled', label: 'Cancelado', color: 'bg-red-100 text-red-700' },
    { value: 'refunded', label: 'Reembolsado', color: 'bg-purple-100 text-purple-700' },
    { value: 'failed', label: 'Fallido', color: 'bg-red-100 text-red-800' },
];

function getStatusStyle(status: string) {
    return WC_STATUSES.find(s => s.value === status) || { value: status, label: status, color: 'bg-slate-100 text-slate-600' };
}

function formatCurrency(amount: string, currency: string) {
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency || 'MXN' }).format(num);
}

function formatDate(dateStr: string) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

// ─────────────────────────────────────────────
// Status Change Dropdown
// ─────────────────────────────────────────────

function StatusChanger({ order, onStatusChanged }: { order: Order; onStatusChanged: () => void }) {
    const { authFetch } = useAuth();
    const [open, setOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);

    async function changeStatus(newStatus: string) {
        if (newStatus === order.status) { setOpen(false); return; }

        setSyncing(true);
        try {
            const res = await authFetch(`${API_URL}/api/orders/${order.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            if (res.ok) {
                onStatusChanged();
            }
        } catch (err) {
            console.error('Error changing status:', err);
        } finally {
            setSyncing(false);
            setOpen(false);
        }
    }

    const current = getStatusStyle(order.status);

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                disabled={syncing}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${current.color} ${syncing ? 'opacity-50' : 'hover:opacity-80 cursor-pointer'}`}
            >
                {syncing ? <RefreshCw size={12} className="animate-spin" /> : null}
                {current.label}
                <ChevronDown size={12} />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                        {WC_STATUSES.map(s => (
                            <button
                                key={s.value}
                                onClick={() => changeStatus(s.value)}
                                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors ${
                                    s.value === order.status ? 'font-semibold text-blue-600' : 'text-slate-700'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function OrdersPage() {
    const { authFetch } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => { fetchOrders(); }, [statusFilter]);

    async function fetchOrders() {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.set('status', statusFilter);
            params.set('limit', '100');

            const res = await authFetch(`${API_URL}/api/orders?${params}`);
            const data = await res.json();
            setOrders(data);
        } catch {
            console.error('Error fetching orders');
        } finally {
            setLoading(false);
        }
    }

    const filtered = search
        ? orders.filter(o =>
            o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
            o.external_order_id?.includes(search)
        )
        : orders;

    return (
        <div className="p-6 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Órdenes</h1>
                    <p className="text-slate-500 mt-1">
                        Gestiona pedidos de WooCommerce. Los cambios de estado se sincronizan bidireccionalmenente.
                    </p>
                </div>
                <button
                    onClick={fetchOrders}
                    className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                    <RefreshCw size={16} />
                    Actualizar
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por cliente o # orden..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Todos los estados</option>
                    {WC_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
            </div>

            {/* Orders Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"># Orden</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Campaña</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                    Cargando órdenes...
                                </td>
                            </tr>
                        )}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                    No se encontraron órdenes.
                                </td>
                            </tr>
                        )}
                        {filtered.map(o => (
                            <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                    <span className="text-sm font-medium text-blue-600">
                                        #{o.external_order_id}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-sm text-slate-700">{o.customer_name || '—'}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <StatusChanger order={o} onStatusChanged={fetchOrders} />
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <span className="text-sm font-semibold text-slate-800">
                                        {formatCurrency(o.total_amount, o.currency)}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {o.campaign_name ? (
                                        <span className="text-xs text-slate-500">{o.campaign_name}</span>
                                    ) : (
                                        <span className="text-xs text-slate-300">Directo</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs text-slate-500">{formatDate(o.order_date)}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
