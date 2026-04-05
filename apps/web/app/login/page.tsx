"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Lucide from 'lucide-react';
const { MessageSquare, Eye, EyeOff, AlertCircle } = Lucide as any;


const API = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotMsg, setForgotMsg] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);

    // Redirect to inbox if already authenticated
    useEffect(() => {
        const token = localStorage.getItem('myalice_token');
        if (token) {
            router.replace('/inbox');
        }
    }, [router]);

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotMsg('');
        setForgotLoading(true);
        try {
            const res = await fetch(`${API}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail }),
            });
            const data = await res.json();
            setForgotMsg(data.message || 'Si el correo existe, recibirás un link de recuperación');
        } catch {
            setForgotMsg('No se pudo conectar con el servidor');
        } finally {
            setForgotLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Error al iniciar sesión');
                return;
            }

            localStorage.setItem('myalice_token', data.token);
            router.replace('/inbox');
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
                    <h1 className="text-2xl font-bold text-white">Amunet</h1>
                    <p className="text-slate-400 text-sm mt-1">CRM Omnicanal con IA</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl p-8 shadow-xl">
                    {forgotMode ? (
                        <>
                            <h2 className="text-lg font-bold text-slate-800 mb-2">Recuperar contraseña</h2>
                            <p className="text-slate-500 text-sm mb-5">Ingresa tu correo y te enviaremos un link para restablecer tu contraseña.</p>
                            {forgotMsg ? (
                                <div className="space-y-4">
                                    <div className="flex items-start gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                                        {forgotMsg}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setForgotMode(false); setForgotMsg(''); setForgotEmail(''); }}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        Volver al inicio de sesión
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleForgot} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={forgotEmail}
                                            onChange={e => setForgotEmail(e.target.value)}
                                            required
                                            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="agente@empresa.com"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={forgotLoading}
                                        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
                                    >
                                        {forgotLoading ? 'Enviando...' : 'Enviar link'}
                                    </button>
                                    <div className="text-center">
                                        <button
                                            type="button"
                                            onClick={() => setForgotMode(false)}
                                            className="text-sm text-blue-600 hover:underline"
                                        >
                                            Volver al inicio de sesión
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    ) : (
                        <>
                            <h2 className="text-lg font-bold text-slate-800 mb-6">Iniciar sesión</h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="agente@empresa.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                                    <div className="relative">
                                        <input
                                            type={showPwd ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            required
                                            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                                            placeholder="••••••••"
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
                                    {loading ? 'Iniciando sesión...' : 'Entrar'}
                                </button>

                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={() => setForgotMode(true)}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
