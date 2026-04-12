'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EscalationRulesRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/automations?tab=escalacion');
    }, [router]);
    return null;
}
