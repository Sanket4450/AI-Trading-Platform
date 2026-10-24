import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { getSession, UnauthorizedError } from '@/lib/api';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    const session = await getSession();
    return <AppShell user={session.user}>{children}</AppShell>;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect('/login');
    }
    redirect('/login?error=api');
  }
}
