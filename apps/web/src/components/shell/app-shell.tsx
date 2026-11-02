'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Database,
  FlaskConical,
  LayoutDashboard,
  Layers,
  LineChart,
  Loader2,
  LogOut,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/types';

const navigation = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/instruments', label: 'Instruments', icon: LineChart },
  { href: '/universes', label: 'Universes', icon: Layers },
  { href: '/strategies', label: 'Strategies', icon: FlaskConical },
  { href: '/configuration', label: 'Configuration', icon: SlidersHorizontal },
  { href: '/data', label: 'Data health', icon: Database },
  { href: '/audit', label: 'Audit', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  user,
  mode,
  children,
}: {
  user: SessionUser;
  mode: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  function handleConfirmOpenChange(open: boolean) {
    if (signingOut) return;
    setConfirmOpen(open);
    if (open) setSignOutError(null);
  }

  async function logout() {
    setSigningOut(true);
    setSignOutError(null);

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error(`Sign out failed with status ${response.status}`);
    } catch {
      setSigningOut(false);
      setSignOutError('We could not sign you out. Please check your connection and try again.');
      return;
    }

    router.push('/login');
    router.refresh();
  }

  return (
    <div className="bg-background h-dvh overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-[1680px]">
        <aside className="border-border/70 bg-sidebar/60 hidden w-64 shrink-0 overflow-y-auto border-r px-4 py-5 lg:flex lg:h-full lg:flex-col">
          <Link href="/" className="flex items-center gap-3 px-2">
            <span className="border-primary/30 bg-primary/10 text-primary grid size-10 place-items-center rounded-xl border">
              <Activity className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight">AI Trading System</span>
              <span className="text-muted-foreground block text-[10px] uppercase tracking-[0.18em]">
                R2 research cockpit
              </span>
            </span>
          </Link>

          <nav className="mt-8 flex flex-col gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'border-primary/25 bg-primary/10 text-primary border'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent',
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-border/70 bg-card/60 text-muted-foreground mt-auto rounded-xl border p-3 text-xs">
            <div className="flex items-center justify-between">
              <span>Mode</span>
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 text-primary uppercase"
              >
                {mode}
              </Badge>
            </div>
            <p className="mt-2 leading-5">
              R2 ingests and validates history. No order route exists and no broker write call is
              compiled.
            </p>
          </div>
        </aside>

        <div className="flex h-full min-w-0 flex-1 flex-col">
          <header className="border-border/70 bg-background/85 z-20 shrink-0 border-b backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <span className="border-primary/30 bg-primary/10 text-primary grid size-8 place-items-center rounded-lg border lg:hidden">
                  <Activity className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.displayName}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {user.email} · {user.role}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/10 text-primary hidden uppercase sm:inline-flex"
                >
                  {mode}
                </Badge>
                <Dialog open={confirmOpen} onOpenChange={handleConfirmOpenChange}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" aria-label="Sign out">
                      <LogOut className="size-4" />
                      <span className="hidden sm:inline">Sign out</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent showCloseButton={!signingOut}>
                    <DialogHeader>
                      <DialogTitle>Sign out of your account?</DialogTitle>
                      <DialogDescription>
                        You will be returned to the sign-in screen and asked to authenticate again
                        before you can continue.
                      </DialogDescription>
                    </DialogHeader>
                    {signOutError ? (
                      <p role="alert" className="text-destructive text-sm">
                        {signOutError}
                      </p>
                    ) : null}
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => handleConfirmOpenChange(false)}
                        disabled={signingOut}
                      >
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={logout} disabled={signingOut}>
                        {signingOut ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <LogOut className="size-4" />
                        )}
                        {signingOut ? 'Signing out…' : 'Sign out'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <nav className="border-border/60 flex gap-1 overflow-x-auto border-t px-3 py-2 lg:hidden">
              {navigation.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
