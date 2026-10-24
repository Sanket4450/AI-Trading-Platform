import Link from 'next/link';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { HealthResponse, Overview, SystemStatus } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function OverviewPage() {
  const [health, status, overview] = await Promise.all([
    apiFetch<HealthResponse>('/health'),
    apiFetch<SystemStatus>('/system/status'),
    apiFetch<Overview>('/system/overview'),
  ]);

  const counts = overview.counts;
  const coverageTotal = Number(counts.coverageRows ?? 0);
  const coverageComplete = Number(counts.completeCoverage ?? 0);
  const coveragePct = coverageTotal > 0 ? (coverageComplete / coverageTotal) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="System overview"
        description="One screen for operating mode, component health, reference data, data coverage and recent jobs. R1 is read-only for trading."
        actions={
          <>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {status.mode.toUpperCase()}
            </Badge>
            <Link href="/data" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Open data health
              <ArrowUpRight className="size-4" />
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Component health"
          value={health.status.toUpperCase()}
          hint={`DB ${health.checks.database.latencyMs ?? '—'} ms · Redis ${health.checks.redis.latencyMs ?? '—'} ms`}
          tone={health.status === 'ok' ? 'green' : health.status === 'degraded' ? 'amber' : 'red'}
        />
        <StatCard
          label="Active accounts"
          value={formatNumber(counts.accounts)}
          hint="One seeded Upstox account"
          tone="cyan"
        />
        <StatCard
          label="Active instruments"
          value={formatNumber(counts.instruments)}
          hint="Cash equities and indices"
          tone="violet"
        />
        <StatCard
          label="Open data issues"
          value={formatNumber(counts.openIssues)}
          hint={`${formatNumber(counts.criticalIssues)} critical`}
          tone={Number(counts.criticalIssues ?? 0) > 0 ? 'red' : 'amber'}
        />
        <StatCard
          label="Universes"
          value={formatNumber(counts.universes)}
          hint="Weekly snapshots"
          tone="green"
        />
        <StatCard
          label="Strategies"
          value={formatNumber(counts.strategies)}
          hint="Research and active registry"
          tone="cyan"
        />
        <StatCard
          label="Stored 1-minute bars"
          value={formatNumber(counts.candles)}
          hint="Source of truth for every timeframe"
          tone="violet"
        />
        <StatCard
          label="Coverage"
          value={`${coveragePct.toFixed(1)}%`}
          hint={`${formatNumber(coverageComplete)} of ${formatNumber(coverageTotal)} instrument-days complete`}
          tone={coveragePct >= 99 ? 'green' : 'amber'}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Recent jobs</CardTitle>
            <CardDescription>
              Worker runs, retries and skipped provider calls are all recorded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.recentJobs.length === 0 ? (
              <EmptyState
                title="No jobs yet"
                description="Trigger a backfill or wait for a scheduled sync."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Finished</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.recentJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <p className="font-medium">{job.jobName}</p>
                        <p className="text-muted-foreground text-xs">{job.jobType}</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(job.startedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(job.finishedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Open quality issues</CardTitle>
            <CardDescription>
              Gaps, invalid bars and mapping problems that need review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.openIssues.length === 0 ? (
              <EmptyState
                title="No open issues"
                description="The validation layer has not raised anything."
              />
            ) : (
              <div className="space-y-3">
                {overview.openIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="border-border/70 bg-background/40 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{issue.issueType.replaceAll('_', ' ')}</p>
                      <StatusBadge status={issue.severity} />
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {issue.tradingDate ?? 'No trading date'} · detected{' '}
                      {formatDateTime(issue.detectedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-primary/5 mt-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="text-primary mt-0.5 size-5" />
            <div>
              <p className="text-sm font-medium">Offline is enforced, not implied.</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                The API and worker refuse to start unless TRADING_MODE=offline. No route writes to
                orders, fills or positions, and the Upstox adapter has no order method.
              </p>
            </div>
          </div>
          <Link href="/audit" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Review audit trail
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
