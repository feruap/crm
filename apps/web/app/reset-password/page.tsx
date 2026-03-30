"use client";
import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import * as Lucide from 'lucide-react';
const { MessageSquare, Eye, EyeOff, AlertCircle, CheckCircle } = Lucide as any;

const API = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token') || '';

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== confirm) {
            setError('Las contraseñas no coinciden');
            return;
        }
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Error al actualizar la contraseña');
                return;
            }
            setSuccess(true);
        } catch {
            setError('No se pudo conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Amunet</h1>
                    <p className="text-slate-400 text-sm mt-1">CRM Omnicanal con IA</p>
                </div>

                <div className="bg-white rounded-2xl p-8 shadow-xl">
                    <h2 className="text-lg font-bold text-slate-800 mb-6">Nueva contraseña</h2>

                    {success ? (
                        <div className="text-center space-y-4">
                            <div className="flex justify-center">
                                <CheckCircle className="w-12 h-12 text-green-500" />
                            </div>
                            <p className="text-slate-700 font-medium">¡Contraseña actualizada!</p>
                            <a
                                href="/login"
                                className="block w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center text-sm"
                            >
                                Ir al inicio de sesión
                            </a>
                        </div>
                    ) : !token ? (
                        <div className="text-center space-y-4">
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                Link inválido. Por favor solicita un nuevo link de recuperación.
                            </div>
                            <a href="/login" className="text-blue-600 hover:underline text-sm">Volver al inicio de sesión</a>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña</label>
                                <div className="relative">
                                    <input
                                        type={showPwd ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                                        placeholder="••••••••"
                                    />
                                    <button type="button" onClick={() => setShowPwd(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
                                <div className="relative">
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirm}
                                        onChange={e => setConfirm(e.target.value)}
                                        required
                                        className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                                        placeholder="••••••••"
                                    />
                                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
                            >
                                {loading ? 'Actualizando...' : 'Actualizar contraseña'}
                            </button>

                            <div className="text-center">
                                <a href="/login" className="text-sm text-blue-600 hover:underline">Volver al inicio de sesión</a>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-white">Cargando...</div></div>}>
            <ResetPasswordForm />
        </Suspense>
    );
}
