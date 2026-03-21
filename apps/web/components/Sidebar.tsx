"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, NAV_ITEMS } from './AuthProvider';
import {
    MessageSquare,
    LayoutDashboard,
    Megaphone,
    Settings,
    Bot,
    ShoppingCart,
    Zap,
    Beaker,
    ArrowRightLeft,
    BarChart3,
    DollarSign,
    Users,
    LogOut,
} from 'lucide-react';

const ICON_MAP: Record<string, typeof MessageSquare> = {
    MessageSquare, LayoutDashboard, Megaphone, Settings, Bot,
    ShoppingCart, Zap, Beaker, ArrowRightLeft, BarChart3,
    DollarSign, Users, LogOut,
};

export default function Sidebar() {
    const pathname = usePathname();
    const { agent, hasRole, logout } = useAuth();

    // Filter nav items by role
    const visibleNav = NAV_ITEMS.filter(item => {
        if (!item.minRole) return true;
        return hasRole(item.minRole);
    });

    return (
        <aside className="w-16 md:w-56 bg-slate-900 flex flex-col py-6 px-2 md:px-4 shrink-0">
            {/* Logo */}
            <div className="mb-6 px-2 hidden md:block">
                <span className="text-white font-bold text-lg tracking-tight">Boton Medico</span>
                <div className="text-xs text-slate-400 mt-0.5">CRM</div>
            </div>

            {/* Agent info */}
            {agent && (
                <div className="mb-4 px-2 hidden md:block">
                    <div className="text-sm text-white font-medium truncate">{agent.name}</div>
                    <div className="text-xs text-slate-400 capitalize">{agent.role}</div>
                </div>
            )}

            <nav className="flex flex-col gap-1 flex-1">
                {visibleNav.map(({ href, icon, label }) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
                    const Icon = ICON_MAP[icon] || MessageSquare;
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors
                                ${active
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <Icon className="w-5 h-5 shrink-0" />
                            <span className="hidden md:inline text-sm font-medium">{label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Logout — always visible, pinned to bottom */}
            <div className="border-t border-slate-700 pt-3 mt-3">
                {agent && (
                    <div className="mb-2 px-2 md:hidden flex items-center justify-center">
                        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                            {agent.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                    </div>
                )}
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
                    title="Cerrar sesión"
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    <span className="hidden md:inline text-sm font-medium">Cerrar sesión</span>
                </button>
            </div>
        </aside>
    );
}
