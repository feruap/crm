"use client";
import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
const {
    Users, MessageSquare, Bot, AlertCircle, Clock, DollarSign,
    CheckCircle, Star, ChevronRight, BarChart2, X, Loader2,
    TrendingUp, TrendingDown, Layout, Target, PieChart, Info
} = Lucide as any;

import { apiFetch } from '../../hooks/useAuth';

interface AnalyticsData {
    new_conversations: number;
    resolved: number;
    messages_sent: number;
    messages_received: number;
    avg_response_time_minutes: number;
    stagnant_count: number;
    label_breakdown: { label: string; count: number }[];
}

export default function AnalyticsDashboard() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [agents, setAgents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('7d');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [sumRes, agentRes] = await Promise.all([
                    apiFetch('/api/analytics/summary'),
                    apiFetch('/api/analytics/by-agent')
                ]);
                const sumData = await sumRes.json();
                const agentData = await agentRes.json();

                setData({
                    ...sumData,
                    label_breakdown: Array.isArray(sumData.label_breakdown) ? sumData.label_breakdown : []
                });
                setAgents(Array.isArray(agentData) ? agentData : []);
            } catch (e) {
                console.error('Error fetching analytics:', e);
                setData({
                    new_conversations: 0,
                    resolved: 0,
                    messages_sent: 0,
                    messages_received: 0,
                    avg_response_time_minutes: 0,
                    stagnant_count: 0,
                    label_breakdown: []
                });
                setAgents([]);
            }
            finally { setLoading(false); }
        };
        fetchData();
    }, [timeframe]);

    if (loading || !data) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 bg-slate-50">
                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold animate-pulse">Calculando métricas en tiempo real...</p>
            </div>
        );
    }

    const stats = [
        { label: 'Conversaciones', value: data.new_conversations, icon: <MessageSquare />, trend: '+12%', color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Resueltas', value: data.resolved, icon: <CheckCircle />, trend: '+5%', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Tiempo Resp.', value: `${data.avg_response_time_minutes.toFixed(1)}m`, icon: <Clock />, trend: '-2m', color: 'text-orange-600', bg: 'bg-orange-50' },
        { label: 'Estancados', value: data.stagnant_count, icon: <AlertCircle />, trend: 'Stable', color: 'text-rose-600', bg: 'bg-rose-50' },
    ];

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-8 bg-slate-50 min-h-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <BarChart2 className="w-8 h-8 text-indigo-600" />
                        Live Control Room
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Monitorea el rendimiento de tu equipo y campañas</p>
                </div>

                <div className="flex bg-white p-1 rounded-2xl border shadow-sm self-start md:self-center">
                    {['24h', '7d', '30d', 'Año'].map(t => (
                        <button
                            key={t}
                            onClick={() => setTimeframe(t)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${timeframe === t ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((s, idx) => (
                    <div key={idx} className="bg-white rounded-[2rem] p-8 border shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                        <div className={`absolute top-0 right-0 w-32 h-32 ${s.bg} rounded-full -mr-16 -mt-16 opacity-20 group-hover:scale-110 transition-transform duration-500`}></div>
                        <div className="flex items-center justify-between mb-6">
                            <div className={`p-4 rounded-2xl ${s.bg} ${s.color}`}>
                                {React.cloneElement(s.icon as any, { className: 'w-6 h-6' })}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {s.trend.startsWith('+') ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                                {s.trend}
                            </div>
                        </div>
                        <h3 className="text-4xl font-black text-slate-800 mb-1">{s.value}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Agent Performance Table */}
                <div className="lg:col-span-8 bg-white rounded-[2.5rem] border shadow-sm p-8 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Rendimiento por Agente</h2>
                            <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">Productividad individual</p>
                        </div>
                        <button className="text-xs font-black text-indigo-600 hover:underline">Exportar Reporte</button>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b">
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Agente</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center text-center">Nuevos</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Resueltos</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ratio</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Progreso</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {agents.map((agent) => {
                                    const ratio = agent.new_conversations > 0 ? (agent.resolved / agent.new_conversations) * 100 : 0;
                                    return (
                                        <tr key={agent.agent_id} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-black text-xs">
                                                        {agent.name[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800">{agent.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">{agent.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-5 text-center text-sm font-bold text-slate-600">{agent.new_conversations}</td>
                                            <td className="py-5 text-center text-sm font-bold text-slate-800">{agent.resolved}</td>
                                            <td className="py-5 text-center">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${ratio > 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                                                    {ratio.toFixed(0)}%
                                                </span>
                                            </td>
                                            <td className="py-5 text-right w-32">
                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ${ratio > 70 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                                                        style={{ width: `${Math.min(100, ratio)}%` }}
                                                    ></div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Column: Label Breakdown & Insights */}
                <div className="lg:col-span-4 space-y-8">
                    {/* Label Breakdown Card */}
                    <div className="bg-white rounded-[2.5rem] border shadow-sm p-8 flex flex-col">
                        <div className="flex items-center gap-3 mb-8">
                            <PieChart className="w-5 h-5 text-indigo-500" />
                            <h2 className="text-lg font-black text-slate-800 tracking-tight">Motivo de Contacto</h2>
                        </div>

                        <div className="space-y-4">
                            {data.label_breakdown.map((item, idx) => {
                                const percentage = (item.count / data.new_conversations) * 100;
                                const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-orange-500'];
                                return (
                                    <div key={idx} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
                                            <span>{item.label}</span>
                                            <span className="text-slate-800 font-black">{item.count}</span>
                                        </div>
                                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${colors[idx % colors.length]} rounded-full transition-all duration-1000`}
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Quick Insight Card */}
                    <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                        <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-125 transition-transform duration-700">
                            <Bot className="w-48 h-48" />
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="bg-white/20 p-2 rounded-xl">
                                <Info className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest">IA Insight</span>
                        </div>
                        <h3 className="font-black text-lg mb-4 leading-tight">Tu tasa de resolución ha subido un 12%</h3>
                        <p className="text-indigo-100 text-xs font-medium leading-relaxed opacity-80">
                            El tiempo de respuesta ha bajado significativamente después de implementar las Respuestas Rápidas globales.
                        </p>
                        <button className="mt-8 bg-white text-indigo-600 px-6 py-3 rounded-2xl text-xs font-black hover:bg-indigo-50 transition-all uppercase tracking-widest">
                            Configurar Alertas
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
