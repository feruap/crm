"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Lucide from 'lucide-react';
const { MessageSquare, Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle } = Lucide as any;


const API = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

type View = 'login' | 'forgot' | 'forgot_sent';

export default function LoginPage() {
    const router = useRouter();
    const [view, setView] = useState<View>('login');

    // Login state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Forgot password state
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState('');

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

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotError('');
        setForgotLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail }),
            });

            const data = await res.json();

            if (!res.ok) {
                setForgotError(data.error || 'Error al enviar el correo');
                return;
            }

            setView('forgot_sent');
        } catch {
            setForgotError('No se pudo conectar con el servidor');
        } finally {
            setForgotLoading(false);
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
                    {/* ── Login ── */}
                    {view === 'login' && (
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

                                <div className="text-center pt-1">
                                    <button
                                        type="button"
                                        onClick={() => { setView('forgot'); setForgotError(''); setForgotEmail(''); }}
                                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* ── Forgot Password Form ── */}
                    {view === 'forgot' && (
                        <>
                            <button
                                onClick={() => setView('login')}
                                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-5"
                            >
                                <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
                            </button>

                            <h2 className="text-lg font-bold text-slate-800 mb-2">Recuperar contraseña</h2>
                            <p className="text-sm text-slate-500 mb-6">
                                Ingresa tu correo y te enviaremos un link para crear una nueva contraseña.
                            </p>

                            <form onSubmit={handleForgot} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={forgotEmail}
                                        onChange={e => setForgotEmail(e.target.value)}
                                        required
                                        autoFocus
                                        className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="agente@empresa.com"
                                    />
                                </div>

                                {forgotError && (
                                    <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        {forgotError}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={forgotLoading}
                                    className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
                                >
                                    {forgotLoading ? 'Enviando...' : 'Enviar link de recuperación'}
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── Forgot Sent Confirmation ── */}
                    {view === 'forgot_sent' && (
                        <div className="text-center py-2">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800 mb-2">Revisa tu correo</h2>
                            <p className="text-sm text-slate-500 mb-6">
                                Si el correo existe en el sistema, recibirás un link de recuperación en breve.
                            </p>
                            <button
                                onClick={() => setView('login')}
                                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline mx-auto"
                            >
                                <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
