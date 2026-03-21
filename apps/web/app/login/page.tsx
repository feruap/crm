'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

export default function LoginPage() {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (mode === 'login') {
                const result = await login(email, password);
                if (result.ok) {
                    router.push('/conversations');
                } else {
                    setError(result.error || 'Error de autenticacion');
                }
            } else {
                const result = await register(name, email, password);
                if (result.ok) {
                    router.push('/conversations');
                } else {
                    setError(result.error || 'Error al registrar');
                }
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800">Boton Medico</h1>
                    <p className="text-slate-500 mt-2">CRM Omnicanal con IA</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
                    <h2 className="text-xl font-semibold text-slate-800 mb-6">
                        {mode === 'login' ? 'Iniciar Sesion' : 'Crear Cuenta'}
                    </h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {error}
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

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Contrasena</label>
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

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                        >
                            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear Cuenta'}
                        </button>
                    </form>

                    <div className="mt-4 text-center">
                        <button
                            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                            className="text-sm text-blue-600 hover:text-blue-700"
                        >
                            {mode === 'login'
                                ? 'Primera vez? Crear cuenta'
                                : 'Ya tienes cuenta? Iniciar sesion'}
                        </button>
                    </div>

                    <p className="text-xs text-slate-400 text-center mt-4">
                        El primer usuario registrado se convierte en Director automaticamente.
                    </p>
                </div>
            </div>
        </div>
    );
}
