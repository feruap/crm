'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, Package, MessageSquare, ArrowUpDown } from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Agent {
    id: string;
    name: string;
    email: string;
}

interface CRMMetrics {
    resolved_conversations: string;
    active_conversations: string;
    handoffs_received: string;
    orders_this_month: string;
    revenue_this_month: string;
}

interface CommissionData {
    earnings_total: number;
    earnings_pending: number;
    earnings_paid: number;
    orders_count: number;
}

interface MonthlyHistory {
    month: string;
    orders: string;
    revenue: string;
    conversations_handled: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function fmtMXN(v: string | number): string {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function MetricCard({ label, value, icon: Icon, color }: {
    label: string; value: string; icon: typeof DollarSign; color: string;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${color}`}>
                    <Icon size={18} className="text-white" />
                </div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
    );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function CommissionsPage() {
    const { authFetch } = useAuth();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>('');
    const [metrics, setMetrics] = useState<CRMMetrics | null>(null);
    const [commissions, setCommissions] = useState<CommissionData | null>(null);
    const [history, setHistory] = useState<MonthlyHistory[]>([]);
    const [error, setError] = useState('');

    // Fetch agents list on mount
    useEffect(() => {
        async function fetchAgents() {
            try {
                // Get agents from conversations (who has been assigned)
                const res = await authFetch(`${API_URL}/api/settings/ai`);
                // Fallback: fetch from a simple agents endpoint or use hardcoded for now
                // In a real app, there would be an /api/agents endpoint
                // For now, we'll use the agent commissions endpoint directly
                setAgents([]);
            } catch {
                // Agents list not available
            }
        }
        fetchAgents();
    }, [authFetch]);

    const fetchCommissions = useCallback(async (agentId: string) => {
        if (!agentId) return;
        setError('');
        try {
            const [summaryRes, historyRes] = await Promise.all([
                authFetch(`${API_URL}/api/agent-commissions/${agentId}`),
                authFetch(`${API_URL}/api/agent-commissions/${agentId}/history?months=6`),
            ]);

            if (summaryRes.ok) {
                const data = await summaryRes.json();
                setMetrics(data.crm_metrics);
                setCommissions(data.commissions);
                if (!agents.find(a => a.id === agentId)) {
                    setAgents(prev => [...prev, data.agent]);
                }
            } else {
                setError('Error cargando datos del agente');
            }

            if (historyRes.ok) {
                setHistory(await historyRes.json());
            }
        } catch {
            setError('Error de conexión');
        }
    }, [agents, authFetch]);

    useEffect(() => {
        if (selectedAgent) fetchCommissions(selectedAgent);
    }, [selectedAgent, fetchCommissions]);

    const maxRevenue = Math.max(...history.map(h => parseFloat(h.revenue || '0')), 1);

    return (
        <div className="p-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Comisiones de Agentes</h1>
                    <p className="text-slate-500 mt-1">
                        Resumen de ventas, comisiones SalesKing, y rendimiento por agente.
                    </p>
                </div>
                <div>
                    <input
                        type="text"
                        placeholder="Pegar UUID del agente..."
                        value={selectedAgent}
                        onChange={e => setSelectedAgent(e.target.value.trim())}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
                    />
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {!selectedAgent && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center text-slate-400">
                    Ingresa el UUID de un agente para ver sus comisiones y métricas.
                </div>
            )}

            {selectedAgent && metrics && (
                <>
                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <MetricCard
                            label="Revenue del Mes"
                            value={fmtMXN(metrics.revenue_this_month || '0')}
                            icon={DollarSign}
                            color="bg-green-500"
                        />
                        <MetricCard
                            label="Órdenes del Mes"
                            value={metrics.orders_this_month || '0'}
                            icon={Package}
                            color="bg-blue-500"
                        />
                        <MetricCard
                            label="Conversaciones Activas"
                            value={metrics.active_conversations || '0'}
                            icon={MessageSquare}
                            color="bg-purple-500"
                        />
                        <MetricCard
                            label="Handoffs Recibidos"
                            value={metrics.handoffs_received || '0'}
                            icon={ArrowUpDown}
                            color="bg-orange-500"
                        />
                    </div>

                    {/* SalesKing Commissions */}
                    {commissions && (commissions.earnings_total > 0 || commissions.earnings_pending > 0) && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-6">
                            <h3 className="text-sm font-semibold text-slate-700 mb-4">Comisiones SalesKing</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase">Total Ganado</p>
                                    <p className="text-xl font-bold text-green-600">{fmtMXN(commissions.earnings_total)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase">Pendiente de Pago</p>
                                    <p className="text-xl font-bold text-amber-600">{fmtMXN(commissions.earnings_pending)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase">Ya Pagado</p>
                                    <p className="text-xl font-bold text-slate-700">{fmtMXN(commissions.earnings_paid)}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Monthly History Chart */}
                    {history.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-6">
                            <h3 className="text-sm font-semibold text-slate-700 mb-4">Historial Mensual</h3>
                            <div className="flex items-end gap-3" style={{ minHeight: 160 }}>
                                {history.map((h, i) => {
                                    const height = (parseFloat(h.revenue || '0') / maxRevenue) * 140;
                                    return (
                                        <div key={i} className="flex flex-col items-center flex-1">
                                            <span className="text-xs text-slate-500 mb-1">{fmtMXN(h.revenue)}</span>
                                            <span className="text-xs text-slate-400 mb-1">{h.orders} órd.</span>
                                            <div
                                                className="w-full bg-blue-500 rounded-t transition-all duration-300"
                                                style={{ height: `${Math.max(height, 4)}px` }}
                                            />
                                            <span className="text-xs text-slate-400 mt-2">
                                                {new Date(h.month).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* History Table */}
                    {history.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mes</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Órdenes</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversaciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {history.map((h, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm text-slate-700">
                                                {new Date(h.month).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm font-semibold text-slate-700">{h.orders}</td>
                                            <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{fmtMXN(h.revenue)}</td>
                                            <td className="px-4 py-3 text-center text-sm text-slate-600">{h.conversations_handled}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
