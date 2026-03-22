'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

export default function LoginPage() {
    const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Check for reset token in URL
    useEffect(() => {
        const resetToken = searchParams.get('reset');
        if (resetToken) {
            setMode('reset');
        }
    }, [searchParams]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (mode === 'login') {
                const result = await login(email, password);
                if (result.ok) {
                    router.push('/conversations');
                } else {
                    setError(result.error || 'Error de autenticacion');
                }
            } else if (mode === 'register') {
                const result = await register(name, email, password);
                if (result.ok) {
                    router.push('/conversations');
                } else {
                    setError(result.error || 'Error al registrar');
                }
            } else if (mode === 'forgot') {
                const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                });
                const data = await res.json();
                if (data.ok) {
                    setSuccess(data.message || 'Revisa tu email para instrucciones de recuperacion.');
                    setEmail('');
                } else {
                    setError(data.error || 'Error al procesar solicitud');
                }
            } else if (mode === 'reset') {
                if (password !== confirmPassword) {
                    setError('Las contrasenas no coinciden');
                    return;
                }
                const resetToken = searchParams.get('reset');
                const res = await fetch(`${API_URL}/api/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: resetToken, password }),
                });
                const data = await res.json();
                if (data.ok) {
                    setSuccess('Contrasena restablecida correctamente. Ahora puedes iniciar sesion.');
                    setPassword('');
                    setConfirmPassword('');
                    setTimeout(() => {
                        setMode('login');
                        setSuccess('');
                        // Clean URL
                        router.replace('/login');
                    }, 2000);
                } else {
                    setError(data.error || 'Error al restablecer contrasena');
                }
            }
        } finally {
            setLoading(false);
        }
    }

    const titles: Record<string, string> = {
        login: 'Iniciar Sesion',
        register: 'Crear Cuenta',
        forgot: 'Recuperar Contrasena',
        reset: 'Nueva Contrasena',
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800">Boton Medico</h1>
                    <p className="text-slate-500 mt-2">CRM Omnicanal con IA</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
                    <h2 className="text-xl font-semibold text-slate-800 mb-6">
                        {titles[mode]}
                    </h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Tu nombre completo"
                                    required
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="tu@botonmedico.com"
                                    required
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        {(mode === 'login' || mode === 'register' || mode === 'reset') && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {mode === 'reset' ? 'Nueva Contrasena' : 'Contrasena'}
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Minimo 6 caracteres"
                                    required
                                    minLength={6}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        {mode === 'reset' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Contrasena</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="Repite tu contrasena"
                                    required
                                    minLength={6}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                        >
                            {loading ? 'Cargando...'
                                : mode === 'login' ? 'Entrar'
                                : mode === 'register' ? 'Crear Cuenta'
                                : mode === 'forgot' ? 'Enviar Instrucciones'
                                : 'Restablecer Contrasena'}
                        </button>
                    </form>

                    <div className="mt-4 text-center space-y-2">
                        {mode === 'login' && (
                            <>
                                <button
                                    onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                                    className="block w-full text-sm text-slate-500 hover:text-blue-600"
                                >
                                    Olvidaste tu contrasena?
                                </button>
                                <button
                                    onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                                    className="block w-full text-sm text-blue-600 hover:text-blue-700"
                                >
                                    Primera vez? Crear cuenta
                                </button>
                            </>
                        )}

                        {mode === 'register' && (
                            <button
                                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                                className="text-sm text-blue-600 hover:text-blue-700"
                            >
                                Ya tienes cuenta? Iniciar sesion
                            </button>
                        )}

                        {(mode === 'forgot' || mode === 'reset') && (
                            <button
                                onClick={() => { setMode('login'); setError(''); setSuccess(''); router.replace('/login'); }}
                                className="text-sm text-blue-600 hover:text-blue-700"
                            >
                                Volver a Iniciar Sesion
                            </button>
                        )}
                    </div>

                    {mode === 'register' && (
                        <p className="text-xs text-slate-400 text-center mt-4">
                            El primer usuario registrado se convierte en Director automaticamente.
                        </p>
                    )}

                    {mode === 'forgot' && (
                        <p className="text-xs text-slate-400 text-center mt-4">
                            Ingresa tu email y te enviaremos instrucciones para restablecer tu contrasena.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
