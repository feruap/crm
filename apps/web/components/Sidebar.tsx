"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Lucide from 'lucide-react';
const {
    MessageSquare,
    LayoutDashboard,
    Megaphone,
    Settings,
    Bot,
    ShieldCheck,
    Trophy,
    Users,
    CalendarDays,
    Target,
    Code2,
    Layout,
    FlaskConical, // Simulator
    Beaker, // Medical Products
} = Lucide as any;

const nav = [
    { href: '/inbox', icon: MessageSquare, label: 'Inbox' },
    { href: '/contacts', icon: Users, label: 'Contactos' },
    { href: '/campaigns', icon: Target, label: 'Campañas' },
    { href: '/widget', icon: Code2, label: 'Widget' },
    { href: '/kanban', icon: Layout, label: 'Seguimiento' },
    { href: '/agenda', icon: CalendarDays, label: 'Agenda' },
    { href: '/automations', icon: Bot, label: 'Automatización' },
    { href: '/supervisor', icon: ShieldCheck, label: 'Supervisor' },
    { href: '/gamification', icon: Trophy, label: 'Gamificación' },
    { href: '/medical-products', icon: Beaker, label: 'Productos Med.' },
    { href: '/simulator', icon: FlaskConical, label: 'Simulador' },
    { href: '/settings', icon: Settings, label: 'Configuración' },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-16 md:w-60 bg-[#0f172a] flex flex-col py-8 px-3 shrink-0 border-r border-slate-800 shadow-2xl">
            {/* Logo */}
            <div className="mb-10 px-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/30">A</div>
                <span className="text-white font-bold text-xl tracking-tight hidden md:block">Amunet</span>
            </div>

            <nav className="flex flex-col gap-1.5 flex-1">
                {nav.map(({ href, icon: Icon, label }) => {
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
                            <Icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${active ? 'text-white' : 'text-slate-500'}`} />
                            <span className="hidden md:inline text-[13px] font-semibold tracking-wide">{label}</span>
                            {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-50 hidden md:block"></div>}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom section */}
            <div className="mt-auto px-3 border-t border-slate-800 pt-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-bold">AD</div>
                    <div className="hidden md:block">
                        <p className="text-xs font-bold text-white leading-none">Admin</p>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Pro Plan</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
