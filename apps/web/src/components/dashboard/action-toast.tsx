'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

const successFlags: Record<string, string> = {
  created: 'Configuration version created.',
  bound: 'Binding saved.',
  saved: 'Setting saved and audited.',
  queued:
    'Request queued. It moves through Queued, Fetching and Verifying before its status settles.',
  cancelled: 'Cancellation recorded. The in-flight chunk finishes cleanly.',
  recomputed: 'Status recompute queued.',
  ack: 'Quality issue updated and audited.',
  imported: 'Corporate actions imported.',
  previewed: 'Corporate-action dry run completed.',
  retried: 'Failed instruments requeued.',
  versionCreated: 'Strategy draft version created.',
  credentialSaved: 'Credential encrypted and stored.',
};

const toastFlags = ['error', 'job', ...Object.keys(successFlags)] as const;

export function ActionToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const error = searchParams.get('error');
    const job = searchParams.get('job');
    const successes = Object.entries(successFlags)
      .filter(([flag]) => searchParams.has(flag))
      .map(([, message]) => message);

    if (error) toast.error(error, { id: `error:${error}` });
    if (successes.length > 0) {
      const message = successes.join(' ');
      toast.success(message, { id: `success:${message}` });
    }
    if (job) toast.success(`Job queued: ${job}`, { id: `job:${job}` });

    if (!error && !job && successes.length === 0) return;

    const next = new URLSearchParams(searchParams.toString());
    for (const flag of toastFlags) next.delete(flag);
    const query = next.toString();
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
  }, [searchParams, pathname]);

  return null;
}

export function MountToast({
  type = 'error',
  message,
}: {
  type?: 'success' | 'error' | 'info';
  message: string;
}) {
  useEffect(() => {
    toast[type](message, { id: `mount:${type}:${message}` });
  }, [type, message]);

  return null;
}
