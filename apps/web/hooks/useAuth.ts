"use client";

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('crm_token');
}

export function authHeaders(): Record<string, string> {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export async function apiFetch(path: string, options?: RequestInit) {
    const res = await fetch(`${API}${path}`, {
        ...options,
        headers: { ...authHeaders(), ...(options?.headers ?? {}) },
    });

    if (res.status === 401) {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('crm_token');
            localStorage.removeItem('crm_agent');
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
