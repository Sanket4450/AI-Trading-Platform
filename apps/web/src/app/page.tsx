import Link from 'next/link';
import { tradingModes } from '@ai-trading/configuration';
import {
  Activity,
  ArrowRight,
  BarChart3,
  FlaskConical,
  Settings2,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    href: '/strategies',
    title: 'Strategies',
    description: 'Versioned strategy configurations and the opening-range-breakout entry point.',
    icon: FlaskConical,
  },
  {
    href: '/backtesting',
    title: 'Backtesting',
    description: 'Historical replay, simulated execution, costs, slippage and performance metrics.',
    icon: BarChart3,
  },
  {
    href: '/trading',
    title: 'Trading',
    description:
      'Signals, orders, fills and live position state once the execution milestone lands.',
    icon: Activity,
  },
  {
    href: '/risk-management',
    title: 'Risk',
    description: 'Position sizing, daily loss limits, exposure controls and the kill switch.',
    icon: ShieldCheck,
  },
  {
    href: '/performance',
    title: 'Performance',
    description: 'Equity, drawdown, expectancy, win/loss distribution and trading-cost analysis.',
    icon: Wallet,
  },
  {
    href: '/system-settings',
    title: 'Settings',
    description: 'Operating mode, data sources, broker configuration and system health.',
    icon: Settings2,
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-14">
      <section className="flex flex-col gap-4">
        <Badge
          variant="outline"
          className="w-fit border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
        >
          R1 foundation · offline mode
        </Badge>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Research, validate and operate one strategy at a time.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-7">
          The dashboard sits in front of a modular monolith: shared strategy contracts, an
          independent risk engine and a broker-independent execution layer. Trading stays offline
          until the R8 gates are met.
        </p>
        <p className="text-muted-foreground text-xs">
          Supported modes: <span className="text-emerald-300/90">{tradingModes.join(' · ')}</span>
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/strategies" className={buttonVariants()}>
            Open strategies
            <ArrowRight className="size-4" />
          </Link>
          <Link href="/system-settings" className={buttonVariants({ variant: 'outline' })}>
            System settings
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.href} href={feature.href} className="group">
              <Card className="h-full transition-colors group-hover:border-emerald-400/30">
                <CardHeader>
                  <div className="mb-3 flex size-9 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
                    <Icon className="size-4 text-emerald-300" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                    Placeholder route
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Operating guardrails</CardTitle>
          <CardDescription>
            These are enforced by configuration and architecture, not by dashboard copy.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground grid gap-3 text-sm md:grid-cols-2">
          <p>
            <strong className="text-foreground">Offline by default.</strong> No live order path is
            enabled in this milestone.
          </p>
          <p>
            <strong className="text-foreground">One entry point.</strong> The dashboard calls the
            API; it never reaches the broker or database directly.
          </p>
          <p>
            <strong className="text-foreground">Independent risk.</strong> Strategies cannot bypass
            sizing, exposure or the kill switch.
          </p>
          <p>
            <strong className="text-foreground">Versioned sessions.</strong> Every trade and
            backtest records its strategy and configuration snapshot.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
