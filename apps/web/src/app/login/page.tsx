import { Activity, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const error =
    params.error === 'api' ? 'The API is not reachable. Start the stack and try again.' : undefined;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(53,224,161,0.12),transparent_45%),radial-gradient(circle_at_85%_20%,rgba(56,217,245,0.08),transparent_40%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="border-primary/30 bg-primary/10 text-primary grid size-11 place-items-center rounded-xl border">
            <Activity className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">AI Trading System</h1>
            <p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
              R1 operator cockpit
            </p>
          </div>
        </div>

        <Card className="border-border/70 bg-card/80 shadow-2xl backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sign in</CardTitle>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                OFFLINE
              </Badge>
            </div>
            <CardDescription>
              One operator account is seeded for R1. Sessions are opaque, HttpOnly and revocable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm next={params.next} initialError={error} />
            <div className="border-border/70 bg-muted/30 text-muted-foreground mt-5 flex items-start gap-2 rounded-lg border p-3 text-xs">
              <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
              <span>
                No live trading is possible in this release. The API refuses to start outside
                <code className="bg-background mx-1 rounded px-1 py-0.5">offline</code> mode.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
