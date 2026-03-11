"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface Agent {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'supervisor' | 'agent';
}

const API = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('myalice_token');
}

export function authHeaders(): Record<string, string> {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export function useAuth() {
    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const token = getToken();
        if (!token) { setLoading(false); router.replace('/login'); return; }

        fetch(`${API}/api/auth/me`, { headers: authHeaders() })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) { localStorage.removeItem('myalice_token'); router.replace('/login'); }
                else setAgent(data);
            })
            .finally(() => setLoading(false));
    }, [router]);

    const logout = () => {
        localStorage.removeItem('myalice_token');
        router.replace('/login');
    };

    return { agent, loading, logout };
}

export async function apiFetch(path: string, options?: RequestInit) {
    const res = await fetch(`${API}${path}`, {
        ...options,
        headers: { ...authHeaders(), ...(options?.headers ?? {}) },
    });

    if (res.status === 401) {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('myalice_token');
            window.location.href = '/login';
        }
        throw new Error('Unauthorized');
    }

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Request failed');
    }

    return res;
}
