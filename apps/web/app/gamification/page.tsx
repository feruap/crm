"use client";
import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
const {
    Trophy, Star, Zap, Target, TrendingUp, Award,
    MessageSquare, CheckCircle, Bot, Clock, Loader2, Crown
} = Lucide as any;

import { useAuth } from '../../components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentRaw {
    id: string;
    name: string;
    role: string;
    is_active: boolean;
    active_conversations: number;
    resolved_today: number;
    pipeline_value: number;
    bot_rate: number;
    avg_response_min: number;
}

interface AgentStats extends AgentRaw {
    points: number;
    level: number;
    levelName: string;
    avatarColor: string;
    badges: Badge[];
    rank: number;
}

interface Badge {
    id: string;
    icon: React.ReactNode;
    label: string;
    description: string;
    color: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
    'bg-orange-500', 'bg-rose-500', 'bg-cyan-500',
];

const LEVELS = [
    { min: 0, name: 'Principiante', color: 'text-slate-500' },
    { min: 50, name: 'Agente Jr.', color: 'text-green-600' },
    { min: 150, name: 'Agente', color: 'text-blue-600' },
    { min: 300, name: 'Senior', color: 'text-purple-600' },
    { min: 500, name: 'Experto', color: 'text-orange-600' },
    { min: 800, name: 'Elite', color: 'text-rose-600' },
    { min: 1200, name: 'Leyenda', color: 'text-yellow-600' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatarColor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function computePoints(a: AgentRaw): number {
    return (
        a.resolved_today * 10 +
        Math.round(a.pipeline_value / 100) +
        (a.avg_response_min > 0 && a.avg_response_min <= 3 ? 30 : 0) +
        (a.bot_rate >= 70 ? 20 : 0)
    );
}

function computeLevel(points: number): { level: number; levelName: string; levelColor: string; nextAt: number; progress: number } {
    let idx = 0;
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (points >= LEVELS[i].min) { idx = i; break; }
    }
    const current = LEVELS[idx];
    const next = LEVELS[idx + 1];
    const nextAt = next?.min ?? current.min;
    const progress = next
        ? Math.round(((points - current.min) / (next.min - current.min)) * 100)
        : 100;
    return { level: idx + 1, levelName: current.name, levelColor: current.color, nextAt, progress };
}

function computeBadges(a: AgentRaw): Badge[] {
    const badges: Badge[] = [];

    if (a.resolved_today >= 10)
        badges.push({ id: 'resolver', icon: <CheckCircle className="w-4 h-4" />, label: 'Resolvedor', description: '10+ resueltas hoy', color: 'bg-green-100 text-green-700 border-green-200' });

    if (a.resolved_today >= 20)
        badges.push({ id: 'turbocloser', icon: <Zap className="w-4 h-4" />, label: 'Turbo Closer', description: '20+ resueltas hoy', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' });

    if (a.pipeline_value >= 10000)
        badges.push({ id: 'closer', icon: <Trophy className="w-4 h-4" />, label: 'Closer', description: 'Pipeline $10k+', color: 'bg-purple-100 text-purple-700 border-purple-200' });

    if (a.avg_response_min > 0 && a.avg_response_min <= 3)
        badges.push({ id: 'speed', icon: <Zap className="w-4 h-4" />, label: 'Speed', description: 'Resp. avg <3 min', color: 'bg-blue-100 text-blue-700 border-blue-200' });

    if (a.bot_rate >= 70)
        badges.push({ id: 'automator', icon: <Bot className="w-4 h-4" />, label: 'Automator', description: 'Bot rate 70%+', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' });

    if (a.active_conversations >= 10)
        badges.push({ id: 'multitask', icon: <MessageSquare className="w-4 h-4" />, label: 'Multitask', description: '10+ convs activas', color: 'bg-rose-100 text-rose-700 border-rose-200' });

    return badges;
}

// Weekly challenge targets (arbitrary, illustrative)
const WEEKLY_CHALLENGES = [
    { id: 'w1', label: 'Resolver 50 conversaciones esta semana', metric: 'resolved_today', target: 50, icon: <CheckCircle className="w-5 h-5 text-green-500" />, color: 'bg-green-500' },
    { id: 'w2', label: 'Mantener tiempo de respuesta < 5 min', metric: 'avg_response', target: 5, icon: <Clock className="w-5 h-5 text-blue-500" />, color: 'bg-blue-500' },
    { id: 'w3', label: 'Alcanzar pipeline de $20,000', metric: 'pipeline', target: 20000, icon: <Trophy className="w-5 h-5 text-yellow-500" />, color: 'bg-yellow-500' },
    { id: 'w4', label: 'Subir automatización del bot al 75%', metric: 'bot_rate', target: 75, icon: <Bot className="w-5 h-5 text-purple-500" />, color: 'bg-purple-500' },
];

// ── Components ────────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <span className="text-slate-400 font-bold text-sm">#2</span>;
    if (rank === 3) return <span className="text-orange-400 font-bold text-sm">#3</span>;
    return <span className="text-slate-400 text-sm">#{rank}</span>;
}

function LevelBar({ progress, color }: { progress: number; color: string }) {
    return (
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${color.replace('text-', 'bg-')}`}
                style={{ width: `${Math.min(100, progress)}%` }}
            />
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GamificationPage() {
    const { authFetch } = useAuth();
    const [agentsRaw, setAgentsRaw] = useState<AgentRaw[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'leaderboard' | 'badges' | 'challenges'>('leaderboard');

    useEffect(() => {
        authFetch(`${API_URL}/api/agents`)
            .then(r => r.json())
            .then((data: any[]) => setAgentsRaw(data.map(a => ({
                ...a,
                pipeline_value: Number(a.pipeline_value) || 0,
                bot_rate: Number(a.bot_rate) || 0,
                avg_response_min: Number(a.avg_response_min) || 0,
            }))))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [authFetch]);

    const agents: AgentStats[] = agentsRaw
        .map(a => {
            const points = computePoints(a);
            const { level, levelName, levelColor, nextAt, progress } = computeLevel(points);
            return {
                ...a,
                points,
                level,
                levelName,
                levelColor,
                levelProgress: progress,
                levelNextAt: nextAt,
                avatarColor: avatarColor(a.id),
                badges: computeBadges(a),
                rank: 0,
            } as AgentStats & { levelColor: string; levelProgress: number; levelNextAt: number };
        })
        .sort((a, b) => b.points - a.points)
        .map((a, i) => ({ ...a, rank: i + 1 }));

    const leader = agents[0];

    // Team totals for challenge progress
    const teamResolved = agentsRaw.reduce((s, a) => s + a.resolved_today, 0);
    const teamPipeline = agentsRaw.reduce((s, a) => s + a.pipeline_value, 0);
    const avgResponse = agentsRaw.length
        ? agentsRaw.reduce((s, a) => s + a.avg_response_min, 0) / agentsRaw.length
        : 0;
    const avgBotRate = agentsRaw.length
        ? agentsRaw.reduce((s, a) => s + a.bot_rate, 0) / agentsRaw.length
        : 0;

    const challengeProgress = (id: string): number => {
        switch (id) {
            case 'w1': return Math.min(100, (teamResolved / 50) * 100);
            case 'w2': return avgResponse > 0 ? Math.min(100, (5 / avgResponse) * 100) : 0;
            case 'w3': return Math.min(100, (teamPipeline / 20000) * 100);
            case 'w4': return Math.min(100, (avgBotRate / 75) * 100);
            default: return 0;
        }
    };

    const TABS = [
        { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="w-4 h-4" /> },
        { id: 'badges', label: 'Badges', icon: <Award className="w-4 h-4" /> },
        { id: 'challenges', label: 'Desafíos', icon: <Target className="w-4 h-4" /> },
    ] as const;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-500" /> Gamificación del Equipo
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Competencia sana, mejor desempeño</p>
                </div>
                {!loading && leader && (
                    <div className="hidden md:flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                        <Crown className="w-5 h-5 text-yellow-500 shrink-0" />
                        <div>
                            <p className="text-xs text-yellow-700 font-medium">Líder del día</p>
                            <p className="text-sm font-bold text-slate-800">{leader.name}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold text-yellow-600">{leader.points} pts</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                            ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
            )}

            {!loading && agents.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                    <Trophy className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">No hay agentes registrados aún.</p>
                </div>
            )}

            {/* ── Leaderboard ── */}
            {!loading && tab === 'leaderboard' && (
                <div className="space-y-4">
                    {/* Podium for top 3 */}
                    {agents.length >= 3 && (
                        <div className="flex items-end justify-center gap-4 py-4">
                            {/* 2nd */}
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-14 h-14 ${agents[1].avatarColor} rounded-full flex items-center justify-center text-white font-bold text-xl`}>
                                    {agents[1].name[0]}
                                </div>
                                <p className="text-xs font-semibold text-slate-700 max-w-[72px] text-center truncate">{agents[1].name.split(' ')[0]}</p>
                                <div className="bg-slate-200 rounded-t-lg w-20 h-16 flex items-end justify-center pb-2">
                                    <span className="text-slate-500 font-bold text-sm">#2</span>
                                </div>
                            </div>
                            {/* 1st */}
                            <div className="flex flex-col items-center gap-2">
                                <Crown className="w-6 h-6 text-yellow-500" />
                                <div className={`w-16 h-16 ${agents[0].avatarColor} rounded-full flex items-center justify-center text-white font-bold text-2xl ring-4 ring-yellow-400`}>
                                    {agents[0].name[0]}
                                </div>
                                <p className="text-xs font-semibold text-slate-700 max-w-[72px] text-center truncate">{agents[0].name.split(' ')[0]}</p>
                                <div className="bg-yellow-400 rounded-t-lg w-20 h-24 flex items-end justify-center pb-2">
                                    <span className="text-white font-bold text-sm">#1</span>
                                </div>
                            </div>
                            {/* 3rd */}
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-14 h-14 ${agents[2].avatarColor} rounded-full flex items-center justify-center text-white font-bold text-xl`}>
                                    {agents[2].name[0]}
                                </div>
                                <p className="text-xs font-semibold text-slate-700 max-w-[72px] text-center truncate">{agents[2].name.split(' ')[0]}</p>
                                <div className="bg-orange-200 rounded-t-lg w-20 h-12 flex items-end justify-center pb-2">
                                    <span className="text-orange-600 font-bold text-sm">#3</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Full ranking */}
                    <div className="space-y-2">
                        {agents.map(agent => {
                            const lvl = computeLevel(agent.points);
                            return (
                                <div key={agent.id}
                                    className={`bg-white rounded-xl border p-4 shadow-sm flex items-center gap-4
                                        ${agent.rank === 1 ? 'border-yellow-300 bg-yellow-50' : ''}`}
                                >
                                    {/* Rank */}
                                    <div className="w-8 flex justify-center shrink-0">
                                        <RankBadge rank={agent.rank} />
                                    </div>

                                    {/* Avatar */}
                                    <div className={`w-10 h-10 ${agent.avatarColor} rounded-full flex items-center justify-center text-white font-bold shrink-0`}>
                                        {agent.name[0]}
                                    </div>

                                    {/* Name + level */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-slate-800 text-sm">{agent.name}</p>
                                            <span className={`text-xs font-medium ${lvl.levelColor}`}>{lvl.levelName}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <LevelBar progress={lvl.progress} color={lvl.levelColor} />
                                            <span className="text-xs text-slate-400 shrink-0">{lvl.progress}%</span>
                                        </div>
                                        {/* Mini stats */}
                                        <div className="flex gap-3 mt-1.5 text-xs text-slate-500">
                                            <span className="flex items-center gap-0.5"><CheckCircle className="w-3 h-3 text-green-500" />{agent.resolved_today} res.</span>
                                            <span className="flex items-center gap-0.5"><Bot className="w-3 h-3 text-purple-500" />{agent.bot_rate}%</span>
                                            <span className="flex items-center gap-0.5"><TrendingUp className="w-3 h-3 text-yellow-500" />${(agent.pipeline_value / 1000).toFixed(1)}k</span>
                                        </div>
                                    </div>

                                    {/* Points */}
                                    <div className="text-right shrink-0">
                                        <p className="text-xl font-bold text-slate-800">{agent.points}</p>
                                        <p className="text-xs text-slate-400">puntos</p>
                                    </div>

                                    {/* Badges preview */}
                                    {agent.badges.length > 0 && (
                                        <div className="flex gap-1 shrink-0">
                                            {agent.badges.slice(0, 3).map(b => (
                                                <div key={b.id} title={b.description}
                                                    className={`w-7 h-7 rounded-full border flex items-center justify-center ${b.color}`}>
                                                    {b.icon}
                                                </div>
                                            ))}
                                            {agent.badges.length > 3 && (
                                                <div className="w-7 h-7 rounded-full border bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                                                    +{agent.badges.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Points breakdown */}
                    <div className="bg-slate-50 border rounded-xl p-4 mt-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <Star className="w-4 h-4 text-yellow-500" /> Cómo se calculan los puntos
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
                            <div className="bg-white border rounded-lg p-3">
                                <p className="font-bold text-slate-800 text-base">×10</p>
                                <p>por conv. resuelta</p>
                            </div>
                            <div className="bg-white border rounded-lg p-3">
                                <p className="font-bold text-slate-800 text-base">÷100</p>
                                <p>por cada $100 de pipeline</p>
                            </div>
                            <div className="bg-white border rounded-lg p-3">
                                <p className="font-bold text-slate-800 text-base">+30</p>
                                <p>resp. avg ≤3 min</p>
                            </div>
                            <div className="bg-white border rounded-lg p-3">
                                <p className="font-bold text-slate-800 text-base">+20</p>
                                <p>bot rate ≥70%</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Badges ── */}
            {!loading && tab === 'badges' && (
                <div className="space-y-6">
                    {agents.map(agent => (
                        <div key={agent.id} className="bg-white border rounded-xl p-5 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 ${agent.avatarColor} rounded-full flex items-center justify-center text-white font-bold`}>
                                    {agent.name[0]}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{agent.name}</p>
                                    <p className="text-xs text-slate-400">{agent.badges.length} badges · {agent.points} pts</p>
                                </div>
                            </div>

                            {agent.badges.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">Sin badges aún — ¡a trabajar!</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {agent.badges.map(b => (
                                        <div key={b.id}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${b.color}`}>
                                            {b.icon}
                                            <div>
                                                <span className="font-semibold">{b.label}</span>
                                                <span className="text-opacity-70 ml-1">· {b.description}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Challenges ── */}
            {!loading && tab === 'challenges' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Desafíos semanales del equipo — progreso acumulado de todos los agentes.</p>

                    {WEEKLY_CHALLENGES.map(ch => {
                        const pct = Math.round(challengeProgress(ch.id));
                        const done = pct >= 100;
                        return (
                            <div key={ch.id} className={`bg-white border rounded-xl p-5 shadow-sm ${done ? 'border-green-300' : ''}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`p-2.5 rounded-xl ${done ? 'bg-green-100' : 'bg-slate-100'} shrink-0`}>
                                        {done ? <CheckCircle className="w-5 h-5 text-green-500" /> : ch.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className={`text-sm font-semibold ${done ? 'text-green-700' : 'text-slate-800'}`}>
                                                {ch.label}
                                            </p>
                                            <span className={`text-sm font-bold ${done ? 'text-green-600' : 'text-slate-700'}`}>
                                                {pct}%
                                            </span>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${done ? 'bg-green-400' : ch.color}`}
                                                style={{ width: `${Math.min(100, pct)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <div className="bg-slate-50 border rounded-xl p-4 text-xs text-slate-500">
                        Los desafíos se reinician cada semana. El progreso refleja los datos actuales del equipo.
                    </div>
                </div>
            )}
        </div>
    );
}
