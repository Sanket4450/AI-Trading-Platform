'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { connectJobs } from '@/lib/realtime';

/** Coalesces a burst of run broadcasts into one server render. */
const REFRESH_COALESCE_MS = 500;

/**
 * Re-runs the current server render when a job run changes state. Passing `instrumentId` limits
 * the subscription to one instrument; without it the catalog refreshes for every run because a
 * queue transition can change any row.
 */
export function LiveJobRefresh({ instrumentId }: { instrumentId?: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      router.refresh();
    }, REFRESH_COALESCE_MS);
  }, [router]);

  useEffect(() => {
    const disconnect = connectJobs(
      (message) => {
        if (message.type !== 'run') return;
        // A run scoped to another instrument cannot change this view; global runs (null
        // instrumentId) such as quality-scan can.
        if (
          instrumentId &&
          message.run.instrumentId &&
          message.run.instrumentId !== instrumentId
        ) {
          return;
        }
        schedule();
      },
      // A reconnect can have missed the transition that ends the run.
      schedule,
    );

    return () => {
      if (timer.current) clearTimeout(timer.current);
      disconnect();
    };
  }, [instrumentId, schedule]);

  return null;
}
