"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Lucide from 'lucide-react';
import { NAV_SECTIONS } from './AuthProvider';
import { useAuth } from './AuthProvider';

const {
    MessageSquare,
    LayoutDashboard,
    Calendar,
    Users,
    BarChart3,
    Megaphone,
    Beaker,
    Globe,
    Zap,
    Bot,
    Sparkles,
    Activity,
    Trophy,
    Settings,
} = Lucide as any;

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    MessageSquare,
    LayoutDashboard,
    Calendar,
    Users,
    BarChart3,
    Megaphone,
    Beaker,
    Globe,
    Zap,
    Bot,
    Sparkles,
    Activity,
    Trophy,
    Settings,
};

export default function Sidebar() {
    const pathname = usePathname();
    const { hasRole, agent } = useAuth();

    return (
        <aside className="w-16 md:w-60 bg-[#0f172a] flex flex-col py-8 px-3 shrink-0 border-r border-slate-800 shadow-2xl">
            {/* Logo */}
            <div className="mb-10 px-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/30">A</div>
                <span className="text-white font-bold text-xl tracking-tight hidden md:block">Amunet</span>
            </div>

            <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
                {NAV_SECTIONS.map((section) => {
                    const visibleItems = section.items.filter(
                        (item) => !item.minRole || hasRole(item.minRole)
                    );
                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={section.title} className="mb-3">
                            <p className="hidden md:block text-[9px] font-bold text-slate-600 tracking-widest px-3 mb-1.5 uppercase">
                                {section.title}
                            </p>
                            <div className="flex flex-col gap-0.5">
                                {visibleItems.map(({ href, icon: iconName, label }) => {
                                    const Icon = ICON_MAP[iconName];
                                    const active = pathname === href || pathname.startsWith(href + '/');
                                    return (
                                        <Link
                                            key={href}
                                            href={href}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group
                                                ${active
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                                                }`}
                                        >
                                            {Icon && (
                                                <Icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${active ? 'text-white' : 'text-slate-500'}`} />
                                            )}
                                            <span className="hidden md:inline text-[13px] font-semibold tracking-wide">{label}</span>
                                            {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-50 hidden md:block"></div>}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Bottom section */}
            <div className="mt-auto px-3 border-t border-slate-800 pt-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-bold">
                        {agent?.name?.slice(0, 2).toUpperCase() ?? 'AD'}
                    </div>
                    <div className="hidden md:block">
                        <p className="text-xs font-bold text-white leading-none">{agent?.name ?? 'Admin'}</p>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">{agent?.role ?? 'Pro Plan'}</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
