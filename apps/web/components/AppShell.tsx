'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { token, loading } = useAuth();

    // Don't show sidebar on login page
    const isLoginPage = pathname === '/login';

    if (loading) {
        return (
            <div className="flex items-center justify-center w-full h-full">
                <div className="text-slate-400">Cargando...</div>
            </div>
        );
    }

    if (isLoginPage || !token) {
        return <main className="flex-1 overflow-auto">{children}</main>;
    }

    return (
        <>
            <Sidebar />
            <main className="flex-1 overflow-auto">{children}</main>
        </>
    );
}
