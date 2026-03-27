"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as Lucide from 'lucide-react';
const { MessageSquare, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft, Loader2 } = Lucide as any;

const API = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('El enlace de recuperación no es válido o ha expirado.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Error al restablecer la contraseña');
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
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">MyAlice</h1>
                    <p className="text-slate-400 text-sm mt-1">CRM Omnicanal con IA</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl p-8 shadow-xl">
                    {success ? (
                        <div className="text-center py-2">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800 mb-2">¡Contraseña actualizada!</h2>
                            <p className="text-sm text-slate-500 mb-6">
                                Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.
                            </p>
                            <button
                                onClick={() => router.replace('/login')}
                                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline mx-auto"
                            >
                                <ArrowLeft className="w-4 h-4" /> Ir al inicio de sesión
                            </button>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-lg font-bold text-slate-800 mb-2">Nueva contraseña</h2>
                            <p className="text-sm text-slate-500 mb-6">
                                Crea una contraseña segura de al menos 6 caracteres.
                            </p>

                            {!token ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        El enlace de recuperación no es válido o ha expirado.
                                    </div>
                                    <button
                                        onClick={() => router.replace('/login')}
                                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Nueva contraseña
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPwd ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                required
                                                autoFocus
                                                minLength={6}
                                                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                                                placeholder="Mínimo 6 caracteres"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPwd(v => !v)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Confirmar contraseña
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showConfirm ? 'text' : 'password'}
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                required
                                                minLength={6}
                                                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                                                placeholder="Repite tu contraseña"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirm(v => !v)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
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
                                        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                    >
                                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {loading ? 'Cambiando contraseña...' : 'Cambiar contraseña'}
                                    </button>

                                    <div className="text-center pt-1">
                                        <button
                                            type="button"
                                            onClick={() => router.replace('/login')}
                                            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 hover:underline mx-auto"
                                        >
                                            <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
