'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type UserRole = 'superadmin' | 'director' | 'gerente' | 'operador';

interface Agent {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}

interface AuthContextType {
    agent: Agent | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
    register: (name: string, email: string, password: string, role?: string) => Promise<{ ok: boolean; error?: string }>;
    logout: () => void;
    hasRole: (minimumRole: UserRole) => boolean;
    authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─────────────────────────────────────────────
// Role Helpers
// ─────────────────────────────────────────────

const ROLE_LEVELS: Record<UserRole, number> = { operador: 0, gerente: 1, director: 2, superadmin: 3 };

function checkRole(agentRole: UserRole | undefined, minimumRole: UserRole): boolean {
    if (!agentRole) return false;
    return (ROLE_LEVELS[agentRole] ?? 0) >= (ROLE_LEVELS[minimumRole] ?? 0);
}

// ─────────────────────────────────────────────
// Nav items by role
// ─────────────────────────────────────────────

export interface NavItem {
    href: string;
    label: string;
    icon: string;
    minRole?: UserRole;
}

export const NAV_ITEMS: NavItem[] = [
    { href: '/inbox',              label: 'Inbox',            icon: 'MessageSquare' },
    { href: '/kanban',             label: 'Seguimiento',      icon: 'LayoutDashboard' },
    { href: '/campaigns',          label: 'Campanas',        icon: 'Megaphone',        minRole: 'gerente' },
    { href: '/campaign-mappings',  label: 'Auto-Respuestas',  icon: 'Zap',              minRole: 'gerente' },
    { href: '/orders',             label: 'Ordenes',          icon: 'ShoppingCart' },
    { href: '/medical-products',   label: 'Productos Med.',   icon: 'Beaker',           minRole: 'gerente' },
    { href: '/escalation-rules',   label: 'Escalacion',       icon: 'ArrowRightLeft',   minRole: 'gerente' },
    { href: '/analytics',          label: 'Atribucion',       icon: 'BarChart3',         minRole: 'director' },
    { href: '/commissions',        label: 'Comisiones',       icon: 'DollarSign' },
    { href: '/agents',             label: 'Agentes',          icon: 'Users',            minRole: 'gerente' },
    { href: '/bot',                label: 'Base de IA',       icon: 'Bot',              minRole: 'gerente' },
    { href: '/settings',           label: 'Settings',         icon: 'Settings',         minRole: 'director' },
];

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

const PUBLIC_PATHS = ['/login'];

export function AuthProvider({ children }: { children: ReactNode }) {
    const [agent, setAgent] = useState<Agent | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null;
        const storedAgent = typeof window !== 'undefined' ? localStorage.getItem('crm_agent') : null;

        if (stored && storedAgent) {
            setToken(stored);
            try {
                setAgent(JSON.parse(storedAgent));
            } catch {
                localStorage.removeItem('crm_token');
                localStorage.removeItem('crm_agent');
            }
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!loading && !token && !PUBLIC_PATHS.includes(pathname)) {
            router.push('/login');
        }
    }, [loading, token, pathname, router]);

    const login = useCallback(async (email: string, password: string) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) return { ok: false, error: data.error || 'Error de autenticacion' };
            setToken(data.token);
            setAgent(data.agent);
            localStorage.setItem('crm_token', data.token);
            localStorage.setItem('crm_agent', JSON.stringify(data.agent));
            return { ok: true };
        } catch {
            return { ok: false, error: 'Error de conexion' };
        }
    }, []);

    const register = useCallback(async (name: string, email: string, password: string, role = 'operador') => {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ name, email, password, role }),
            });
            const data = await res.json();
            if (!res.ok) return { ok: false, error: data.error || 'Error al registrar' };
            if (data.first_user) {
                setToken(data.token);
                setAgent(data.agent);
                localStorage.setItem('crm_token', data.token);
                localStorage.setItem('crm_agent', JSON.stringify(data.agent));
            }
            return { ok: true };
        } catch {
            return { ok: false, error: 'Error de conexion' };
        }
    }, [token]);

    const logout = useCallback(() => {
        setToken(null);
        setAgent(null);
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_agent');
        router.push('/login');
    }, [router]);

    const hasRole = useCallback((minimumRole: UserRole) => {
        return checkRole(agent?.role, minimumRole);
    }, [agent]);

    const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        const headers = new Headers(options.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        return fetch(url, { ...options, headers });
    }, [token]);

    return (
        <AuthContext.Provider value={{ agent, token, loading, login, register, logout, hasRole, authFetch }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
