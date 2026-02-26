import './globals.css';
import { Inter } from 'next/font/google';
import Sidebar from '../components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'MyAlice Clone',
    description: 'CRM omnicanal con IA multi-modelo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <body className={`${inter.className} flex h-screen bg-slate-50 overflow-hidden`}>
                <Sidebar />
                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </body>
        </html>
    );
}
