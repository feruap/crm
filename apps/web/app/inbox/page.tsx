'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Inbox redirects to conversations — they share the same UI
export default function InboxPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/conversations');
    }, [router]);
    return (
        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Redirigiendo...
        </div>
    );
}
