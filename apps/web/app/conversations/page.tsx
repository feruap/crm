'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Conversations redirects to inbox — unified UI
export default function ConversationsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/inbox');
    }, [router]);
    return (
        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Redirigiendo...
        </div>
    );
}
