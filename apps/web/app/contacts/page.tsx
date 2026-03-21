"use client";
import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
const {
    Search, User, Filter, MoreVertical, ChevronLeft, ChevronRight,
    Download, Upload, Edit2, Trash2, Mail, Phone, MessageSquare, X, Loader2, AlertCircle
} = Lucide as any;

import { useAuth } from '../../components/AuthProvider';
import Link from 'next/link';

interface Customer {
    id: string;
    display_name: string;
    avatar_url: string | null;
    conversation_count: string;
    last_label: string | null;
    created_at: string;
}

function ImportModal({ onClose, onImported, authFetch }: { onClose: () => void; onImported: () => void; authFetch: (url: string, options?: RequestInit) => Promise<Response> }) {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<{ created: number } | null>(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

    const handleUpload = async () => {
        if (!file) return;
        setImporting(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await authFetch(`${API_URL}/api/customers/import`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Error en el servidor');
            const data = await res.json();
            setResult(data);
            onImported();
        } catch (err: any) {
            setError(err.message || 'Error al importar');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="font-bold text-lg text-slate-800">Importar Contactos</h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    {!result ? (
                        <>
                            <p className="text-sm text-slate-600">
                                Sube un archivo CSV con columnas <code>name</code> (o <code>display_name</code>) y <code>phone</code> (o <code>whatsapp</code>).
                            </p>
                            <label className="block border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group">
                                <input type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                        <Upload className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">{file ? file.name : 'Haz clic para seleccionar un archivo CSV'}</span>
                                    {!file && <span className="text-xs text-slate-400">Tamaño máximo: 5MB</span>}
                                </div>
                            </label>
                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-4 space-y-3">
                            <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                                <Lucide.Check className="w-8 h-8" />
                            </div>
                            <h4 className="font-bold text-xl text-slate-800">¡Importación completada!</h4>
                            <p className="text-slate-600">Se han creado {result.created} nuevos contactos exitosamente.</p>
                        </div>
                    )}
                </div>
                <div className="flex gap-3 p-6 border-t bg-slate-50">
                    {!result ? (
                        <>
                            <button
                                onClick={handleUpload}
                                disabled={!file || importing}
                                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                                {importing ? 'Importando...' : 'Comenzar Importación'}
                            </button>
                            <button onClick={onClose} className="px-6 py-2.5 rounded-lg border bg-white text-slate-600 hover:bg-slate-50 font-medium font-semibold">Cancelar</button>
                        </>
                    ) : (
                        <button onClick={onClose} className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-semibold hover:bg-slate-900 transition-all">
                            Cerrar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ContactsPage() {
    const { authFetch } = useAuth();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [labelFilter, setLabelFilter] = useState('');
    const [showImport, setShowImport] = useState(false);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';
    const limit = 10;

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search,
                label: labelFilter
            });
            const res = await authFetch(`${API_URL}/api/customers?${params}`);
            const data = await res.json();
            setCustomers(data.data);
            setTotal(data.total);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeout = setTimeout(fetchCustomers, 300);
        return () => clearTimeout(timeout);
    }, [page, search, labelFilter]);

    const handleExport = () => {
        // Simple export to CSV (client-side for now)
        const headers = ['ID', 'Nombre', 'Etiqueta', 'Conversaciones', 'Fecha Registro'];
        const rows = customers.map(c => [
            c.id, c.display_name, c.last_label || '', c.conversation_count, c.created_at
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `contactos_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b px-8 py-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Directorio de Contactos</h1>
                    <p className="text-sm text-slate-500">{total} contactos registrados</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border rounded-lg hover:bg-slate-50 transition-colors border shadow-sm"
                    >
                        <Download className="w-4 h-4" /> Exportar
                    </button>
                    <button
                        onClick={() => setShowImport(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                    >
                        <Upload className="w-4 h-4" /> Importar CSV
                    </button>
                </div>
            </header>

            {/* Filters & Search */}
            <div className="p-8 pb-4">
                <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
                    <div className="flex items-center gap-4 flex-1 max-w-2xl">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, teléfono o ID..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                            />
                        </div>
                        <select
                            value={labelFilter}
                            onChange={(e) => { setLabelFilter(e.target.value); setPage(1); }}
                            className="px-4 py-2 border rounded-lg bg-slate-50 text-slate-600 focus:outline-none text-sm font-medium"
                        >
                            <option value="">Todas las etiquetas</option>
                            <option value="Nuevo Cliente">Nuevo Cliente</option>
                            <option value="Negociación">Negociación</option>
                            <option value="Seguimiento">Seguimiento</option>
                            <option value="Cerrado">Cerrado</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="px-8 flex-1 overflow-hidden flex flex-col mb-8">
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Etiqueta</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Conversas.</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Registrado</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                                        </tr>
                                    ))
                                ) : customers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <User className="w-8 h-8 text-slate-200" />
                                                <p className="text-sm font-medium">No se encontraron contactos</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    customers.map((c) => (
                                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold overflow-hidden shrink-0">
                                                        {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <Link href={`/inbox?customer=${c.id}`} className="font-bold text-slate-800 hover:text-blue-600 transition-colors truncate block">
                                                            {c.display_name}
                                                        </Link>
                                                        <p className="text-[10px] text-slate-400 uppercase font-mono tracking-tighter">ID: {c.id.substring(0, 8)}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {c.last_label ? (
                                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-600 border border-blue-100">
                                                        {c.last_label}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-slate-600 text-sm font-medium">
                                                    <MessageSquare className="w-3.5 h-3.5 text-slate-300" />
                                                    {c.conversation_count}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                                {new Date(c.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button title="Editar" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <Link href={`/inbox?customer=${c.id}`} title="Conversación" className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 bg-slate-50 border-t flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            Mostrando <span className="font-bold text-slate-700">{(page - 1) * limit + 1}</span> a <span className="font-bold text-slate-700">{Math.min(page * limit, total)}</span> de <span className="font-bold text-slate-700">{total}</span>
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 border rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                const p = i + 1;
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`w-9 h-9 text-xs font-bold rounded-lg transition-all ${page === p ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border text-slate-600 hover:border-slate-300 shadow-sm'}`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || totalPages === 0}
                                className="p-2 border rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showImport && (
                <ImportModal
                    onClose={() => setShowImport(false)}
                    onImported={() => { fetchCustomers(); }}
                    authFetch={authFetch}
                />
            )}
        </div>
    );
}
