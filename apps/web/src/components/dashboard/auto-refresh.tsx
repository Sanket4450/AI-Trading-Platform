'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Polls only while work is visibly active. Terminal rows never trigger a
 * refresh loop, so an idle catalog stays quiet.
 */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
