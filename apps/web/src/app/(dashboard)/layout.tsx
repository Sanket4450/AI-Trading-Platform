import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { apiFetch, getSession, UnauthorizedError } from '@/lib/api';
import type { SystemStatus } from '@/lib/types';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    const [session, status] = await Promise.all([
      getSession(),
      apiFetch<SystemStatus>('/system/status'),
    ]);
    return (
      <AppShell user={session.user} mode={status.mode}>
        {children}
      </AppShell>
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect('/api/auth/session-expired');
    }
    redirect('/api/auth/session-expired?reason=api');
  }
}
