import Link from 'next/link';
import { RefreshCw, ServerCrash } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export const metadata = {
  title: 'Service unavailable · AI Trading System',
};

/**
 * Shown when the API cannot be reached. It deliberately does not touch the session cookie:
 * an outage or a backend restart is not an expired session.
 */
export default function ServiceUnavailablePage() {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-4 py-10 sm:px-6">
      <div aria-hidden className="login-aurora pointer-events-none absolute inset-0" />

      <div className="relative w-full max-w-md">
        <div className="border-border/70 bg-card/80 rounded-xl border p-8 text-center shadow-2xl backdrop-blur">
          <span className="border-primary/30 bg-primary/10 text-primary-strong mx-auto grid size-11 place-items-center rounded-xl border">
            <ServerCrash className="size-5" />
          </span>

          <h1 className="mt-5 text-lg font-semibold tracking-tight">Service unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            The API could not be reached. It may be restarting or temporarily down.
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Your session has been kept. Retry once the backend is available.
          </p>

          <Link href="/" className={buttonVariants({ size: 'sm' }) + ' mt-6'}>
            <RefreshCw className="size-4" />
            Retry
          </Link>
        </div>
      </div>
    </main>
  );
}
