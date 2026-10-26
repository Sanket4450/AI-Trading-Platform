import { Activity, KeyRound, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const error =
    params.error === 'api'
      ? 'The sign-in service is unavailable right now. Please try again in a moment.'
      : undefined;

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(53,224,161,0.14),transparent_45%),radial-gradient(circle_at_82%_15%,rgba(56,217,245,0.1),transparent_42%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
      />

      <div className="relative w-full max-w-md">
        <header className="mb-7 flex items-center gap-3">
          <span className="border-primary/30 bg-primary/10 text-primary grid size-11 place-items-center rounded-xl border">
            <Activity className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">AI Trading System</h1>
            <p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
              Operator cockpit
            </p>
          </div>
        </header>

        <Card className="border-border/70 bg-card/80 relative overflow-hidden shadow-2xl backdrop-blur">
          <div
            aria-hidden
            className="from-primary/70 via-primary/20 bg-linear-to-r absolute inset-x-0 top-0 h-px to-transparent"
          />
          <CardHeader className="gap-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>
                <h2>Sign in</h2>
              </CardTitle>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                OFFLINE
              </Badge>
            </div>
            <CardDescription>Use your operator credentials to open the cockpit.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm next={params.next} initialError={error} />
            <div className="border-border/70 bg-muted/30 text-muted-foreground mt-6 space-y-2.5 rounded-lg border p-3 text-xs">
              <p className="flex items-start gap-2">
                <ShieldCheck className="text-primary mt-px size-4 shrink-0" />
                <span>Offline mode only. No live orders can be placed from this release.</span>
              </p>
              <p className="flex items-start gap-2">
                <KeyRound className="text-primary mt-px size-4 shrink-0" />
                <span>Sessions are HttpOnly and revocable, and expire automatically.</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-muted-foreground mt-5 text-center text-xs">
          Need access? Contact your administrator.
        </p>
      </div>
    </main>
  );
}
