'use client';

import { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Database,
  FlaskConical,
  LayoutDashboard,
  Layers,
  LineChart,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { badgeVariants } from '@/components/ui/badge';
import { ActionToast } from '@/components/dashboard/action-toast';
import { PageMetaProvider } from '@/components/shell/page-meta';
import { SignOutButton } from '@/components/shell/sign-out-button';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { label } from '@/lib/labels';
import { routeMetaFor } from '@/lib/page-meta';
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

const modeExplanations: Record<string, string> = {
  offline: 'Offline mode. No provider network calls, broker writes or order routes.',
  research: 'Research mode. Read-only ingestion and validation; no order routes exist.',
  backtesting: 'Backtesting mode. Historical replay only; no live orders.',
  paper: 'Paper mode. Simulated execution only; no broker orders are sent.',
  live: 'Live mode. Controlled broker execution is enabled.',
};

interface HeaderOverride {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
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
  const [headerOverride, setHeaderOverride] = useState<HeaderOverride | null>(null);

  const setPageMeta = useCallback((value: HeaderOverride | null) => {
    setHeaderOverride(value);
  }, []);

  const routeMeta = routeMetaFor(pathname);
  const title = headerOverride?.title ?? routeMeta.title;
  const description = headerOverride?.description ?? routeMeta.description;
  const actions = headerOverride?.actions;
  const modeExplanation =
    modeExplanations[mode] ?? `${mode} mode. Trading mode controls what the system may do.`;

  return (
    <PageMetaProvider onMeta={setPageMeta}>
      <div className="bg-background h-dvh overflow-hidden">
        <Suspense fallback={null}>
          <ActionToast />
        </Suspense>
        <div className="mx-auto flex h-full w-full max-w-[1680px]">
          <aside className="border-border/70 bg-sidebar/60 hidden w-64 shrink-0 overflow-y-auto border-r px-4 py-5 lg:flex lg:h-full lg:flex-col">
            <Link href="/" className="flex items-center gap-3 px-2">
              <span className="border-primary/30 bg-primary/10 text-primary-strong grid size-10 place-items-center rounded-xl border">
                <Activity className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-tight">
                  AI Trading System
                </span>
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
                        ? 'border-primary/25 bg-primary/10 text-primary-strong border'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent',
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-border/70 bg-card/60 mt-auto rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.displayName}</p>
                  <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                  <p className="text-muted-foreground mt-1 text-[10px] uppercase tracking-wide">
                    {label(user.role)}
                  </p>
                </div>
                <SignOutButton />
              </div>
            </div>
          </aside>

          <div className="flex h-full min-w-0 flex-1 flex-col">
            <header className="border-border/70 bg-background/85 z-20 shrink-0 border-b backdrop-blur">
              <div className="flex items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="border-primary/30 bg-primary/10 text-primary-strong grid size-8 shrink-0 place-items-center rounded-lg border lg:hidden">
                    <Activity className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                      {title}
                    </h1>
                    {description ? (
                      <p className="text-muted-foreground mt-1 truncate text-xs sm:text-sm">
                        {description}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {actions ? (
                    <div className="hidden items-center gap-2 lg:flex">{actions}</div>
                  ) : null}
                  <InfoTooltip content={modeExplanation}>
                    <button
                      type="button"
                      aria-label={`Trading mode: ${mode}`}
                      className={cn(
                        badgeVariants({ variant: 'outline' }),
                        'border-primary/30 bg-primary/10 text-primary-strong cursor-help uppercase',
                      )}
                    >
                      {mode}
                    </button>
                  </InfoTooltip>
                  <ThemeToggle />
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
                          ? 'bg-primary/10 text-primary-strong'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="px-3 pb-2 lg:hidden">
                <div className="border-border/70 bg-card/60 mt-1 flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{user.displayName}</p>
                    <p className="text-muted-foreground truncate text-[11px]">{user.email}</p>
                    <p className="text-muted-foreground mt-0.5 text-[10px] uppercase tracking-wide">
                      {label(user.role)}
                    </p>
                  </div>
                  <SignOutButton />
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </div>
    </PageMetaProvider>
  );
}
