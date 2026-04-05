"use client";
import React, { useState, useEffect, useCallback } from 'react';
import * as Lucide from 'lucide-react';
import { apiFetch } from '../hooks/useAuth';
import { getSocket } from '../hooks/useSocket';

const {
    ShieldAlert, X, Check, XCircle, ChevronDown, ChevronUp, Loader2,
    Clock, CheckCircle2, User, MessageSquare, DollarSign, ArrowUpCircle,
} = Lucide as any;

interface DiscountRequest {
    id: string;
    agent_id: string;
    agent_name: string;
    conversation_id: string | null;
    product_id: number;
    product_name: string;
    original_price: string;
    requested_price: string;
    discount_pct: string;
    status: 'pending' | 'approved' | 'rejected';
    approved_price: string | null;
    supervisor_note: string | null;
    created_at: string;
}

interface ApprovalFormState {
    approvedPrice: string;
    note: string;
    submitting: boolean;
}

export default function DiscountApprovalPanel() {
    const [agentRole, setAgentRole] = useState<string | null>(null);
    const [requests, setRequests] = useState<DiscountRequest[]>([]);
    const [expanded, setExpanded] = useState(false);
    const [forms, setForms] = useState<Record<string, ApprovalFormState>>({});
    const [loadingRequests, setLoadingRequests] = useState(false);

    // Fetch current agent role once
    useEffect(() => {
        apiFetch('/api/auth/me')
            .then(r => r.json())
            .then((data: any) => setAgentRole(data.role ?? null))
            .catch(() => {});
    }, []);

    const isSupervisor = agentRole === 'supervisor' || agentRole === 'admin' || agentRole === 'superadmin';

    // Load pending requests from server
    const loadRequests = useCallback(async () => {
        if (!isSupervisor) return;
        setLoadingRequests(true);
        try {
            const res = await apiFetch('/api/salesking/discount-requests/pending');
            const data = await res.json();
            setRequests(data.requests ?? []);
        } catch {
            setRequests([]);
        } finally {
            setLoadingRequests(false);
        }
    }, [isSupervisor]);

    useEffect(() => {
        if (isSupervisor) {
            loadRequests();
        }
    }, [isSupervisor, loadRequests]);

    // Listen for new discount requests via Socket.IO
    useEffect(() => {
        if (!isSupervisor) return;

        const socket = getSocket();

        const handleNew = (data: {
            id: string; agent_id: string; agent_name: string; product_name: string;
            original_price: number; requested_price: number; discount_pct: number;
            conversation_id: string | null; created_at: string;
        }) => {
            setRequests(prev => {
                // Avoid duplicates
                if (prev.some(r => r.id === data.id)) return prev;
                return [{
                    id: data.id,
                    agent_id: data.agent_id,
                    agent_name: data.agent_name,
                    conversation_id: data.conversation_id,
                    product_id: 0,
                    product_name: data.product_name,
                    original_price: String(data.original_price),
                    requested_price: String(data.requested_price),
                    discount_pct: String(data.discount_pct),
                    status: 'pending',
                    approved_price: null,
                    supervisor_note: null,
                    created_at: data.created_at,
                }, ...prev];
            });
            // Auto-expand when a new request arrives
            setExpanded(true);
        };

        socket.on('discount_request', handleNew);
        return () => { socket.off('discount_request', handleNew); };
    }, [isSupervisor]);

    const getForm = (id: string, originalPrice: string): ApprovalFormState => {
        return forms[id] ?? { approvedPrice: originalPrice, note: '', submitting: false };
    };

    const setForm = (id: string, patch: Partial<ApprovalFormState>) => {
        setForms(prev => ({ ...prev, [id]: { ...getForm(id, ''), ...patch } }));
    };

    const handleApprove = async (req: DiscountRequest) => {
        const form = getForm(req.id, req.requested_price);
        setForm(req.id, { submitting: true });
        try {
            await apiFetch(`/api/salesking/discount-request/${req.id}/approve`, {
                method: 'PUT',
                body: JSON.stringify({
                    approved_price: form.approvedPrice ? parseFloat(form.approvedPrice) : undefined,
                    note: form.note || undefined,
                }),
            });
            setRequests(prev => prev.filter(r => r.id !== req.id));
        } catch (err: any) {
            setForm(req.id, { submitting: false });
        }
    };

    const handleReject = async (req: DiscountRequest) => {
        const form = getForm(req.id, req.requested_price);
        setForm(req.id, { submitting: true });
        try {
            await apiFetch(`/api/salesking/discount-request/${req.id}/reject`, {
                method: 'PUT',
                body: JSON.stringify({ note: form.note || undefined }),
            });
            setRequests(prev => prev.filter(r => r.id !== req.id));
        } catch {
            setForm(req.id, { submitting: false });
        }
    };

    // Only render for supervisors/admins
    if (!isSupervisor) return null;

    const pendingCount = requests.length;

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80">
            {/* Toggle button */}
            <button
                onClick={() => setExpanded(v => !v)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl shadow-lg font-semibold text-sm transition-colors
                    ${pendingCount > 0
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-800 text-white'}`}>
                <span className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    Aprobaciones de descuento
                    {pendingCount > 0 && (
                        <span className="bg-white text-amber-600 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                            {pendingCount}
                        </span>
                    )}
                </span>
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {/* Panel */}
            {expanded && (
                <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-[520px] flex flex-col overflow-hidden">
                    <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between shrink-0">
                        <p className="text-sm font-semibold text-slate-800">Solicitudes pendientes</p>
                        <div className="flex items-center gap-2">
                            <button onClick={loadRequests} className="p-1 hover:bg-slate-200 rounded-lg" title="Actualizar">
                                {loadingRequests
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                                    : <Lucide.RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
                            </button>
                            <button onClick={() => setExpanded(false)} className="p-1 hover:bg-slate-200 rounded-lg">
                                <X className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                        {requests.length === 0 ? (
                            <div className="py-10 text-center">
                                <CheckCircle2 className="w-8 h-8 text-green-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-500">Sin solicitudes pendientes</p>
                            </div>
                        ) : requests.map(req => {
                            const form = getForm(req.id, req.requested_price);
                            const discPct = parseFloat(req.discount_pct);
                            const origPrice = parseFloat(req.original_price);
                            const reqPrice = parseFloat(req.requested_price);

                            return (
                                <div key={req.id} className="p-4 space-y-3">
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-800 truncate">{req.product_name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                                    <User className="w-3 h-3" />{req.agent_name}
                                                </span>
                                                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(req.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0
                                            ${discPct >= 30 ? 'bg-red-100 text-red-700' :
                                              discPct >= 15 ? 'bg-amber-100 text-amber-700' :
                                              'bg-blue-100 text-blue-700'}`}>
                                            {discPct.toFixed(1)}% dto.
                                        </span>
                                    </div>

                                    {/* Price breakdown */}
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2 text-center">
                                            <p className="text-[9px] text-slate-400 uppercase font-semibold">Precio original</p>
                                            <p className="text-sm font-bold text-slate-700">${origPrice.toFixed(2)}</p>
                                        </div>
                                        <div className="flex-1 bg-red-50 rounded-lg px-3 py-2 text-center">
                                            <p className="text-[9px] text-red-400 uppercase font-semibold">Solicitado</p>
                                            <p className="text-sm font-bold text-red-600">${reqPrice.toFixed(2)}</p>
                                        </div>
                                    </div>

                                    {/* Approved price input */}
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-semibold uppercase">Precio a aprobar</label>
                                        <div className="flex items-center gap-1 mt-1">
                                            <span className="text-sm text-slate-400">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                max={origPrice}
                                                value={form.approvedPrice}
                                                onChange={e => setForm(req.id, { approvedPrice: e.target.value })}
                                                className="flex-1 border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 rounded-lg px-2 py-1.5 text-sm font-bold outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Note */}
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-semibold uppercase">Nota (opcional)</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: autorizado por política especial"
                                            value={form.note}
                                            onChange={e => setForm(req.id, { note: e.target.value })}
                                            className="w-full mt-1 border border-slate-200 focus:border-indigo-400 rounded-lg px-2 py-1.5 text-xs outline-none"
                                        />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(req)}
                                            disabled={form.submitting}
                                            className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-60">
                                            {form.submitting
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Check className="w-3.5 h-3.5" />}
                                            Aprobar
                                        </button>
                                        <button
                                            onClick={() => handleReject(req)}
                                            disabled={form.submitting}
                                            className="flex-1 flex items-center justify-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-60">
                                            <XCircle className="w-3.5 h-3.5" />
                                            Rechazar
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
