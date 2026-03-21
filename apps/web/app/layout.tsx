import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../components/AuthProvider';
import AppShell from '../components/AppShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'CRM Boton Medico',
    description: 'CRM omnicanal con IA para diagnostico rapido',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <body className={`${inter.className} flex h-screen bg-slate-50 overflow-hidden`}>
                <AuthProvider>
                    <AppShell>{children}</AppShell>
                </AuthProvider>
            </body>
        </html>
    );
}
