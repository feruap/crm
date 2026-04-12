'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CampaignMappingsRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/automations?tab=campanas');
    }, [router]);
    return null;
}
