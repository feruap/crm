"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    MessageSquare,
    LayoutDashboard,
    Megaphone,
    Settings,
    Bot,
} from 'lucide-react';

const nav = [
    { href: '/inbox',     icon: MessageSquare,    label: 'Inbox'      },
    { href: '/kanban',    icon: LayoutDashboard,  label: 'Seguimiento'},
    { href: '/campaigns', icon: Megaphone,        label: 'Campañas'   },
    { href: '/bot',       icon: Bot,              label: 'Base de IA' },
    { href: '/settings',  icon: Settings,         label: 'Settings'   },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-16 md:w-56 bg-slate-900 flex flex-col py-6 px-2 md:px-4 shrink-0">
            {/* Logo */}
            <div className="mb-8 px-2 hidden md:block">
                <span className="text-white font-bold text-lg tracking-tight">MyAlice</span>
            </div>

            <nav className="flex flex-col gap-1">
                {nav.map(({ href, icon: Icon, label }) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
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
        </aside>
    );
}
