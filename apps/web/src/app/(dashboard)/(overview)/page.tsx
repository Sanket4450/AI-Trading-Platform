import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { HealthResponse, Overview } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import {
  TableActionLink,
  TableActions,
  TableRefreshButton,
} from '@/components/dashboard/table-actions';
import { buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function OverviewPage() {
  const [health, overview] = await Promise.all([
    apiFetch<HealthResponse>('/health'),
    apiFetch<Overview>('/system/overview'),
  ]);

  const counts = overview.counts;
  const coverageTotal = Number(counts.coverageRows ?? 0);
  const coverageComplete = Number(counts.completeCoverage ?? 0);
  const coveragePct = coverageTotal > 0 ? (coverageComplete / coverageTotal) * 100 : 0;

  return (
    <div>
      <PageMeta
        actions={
          <>
            <Link
              href="/instruments"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Open catalog
              <ArrowUpRight className="size-4" />
            </Link>
            <Link href="/data" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Open data health
              <ArrowUpRight className="size-4" />
            </Link>
          </>
        }
      />

      <StatGrid>
        <StatCard
          label="Component health"
          value={label(health.status)}
          hint={`DB ${health.checks.database.latencyMs ?? '—'} ms · Redis ${health.checks.redis.latencyMs ?? '—'} ms`}
          tone={
            health.status === 'ok' ? 'success' : health.status === 'degraded' ? 'warning' : 'danger'
          }
        />
        <StatCard
          label="Active accounts"
          value={formatNumber(counts.accounts)}
          hint="One seeded Upstox account"
          tone="info"
        />
        <StatCard
          label="Active instruments"
          value={formatNumber(counts.instruments)}
          hint="Cash equities and indices"
          tone="highlight"
        />
        <StatCard
          label="Open data issues"
          value={formatNumber(counts.openIssues)}
          hint={`${formatNumber(counts.criticalIssues)} critical`}
          tone={Number(counts.criticalIssues ?? 0) > 0 ? 'danger' : 'warning'}
        />
        <StatCard
          label="Universes"
          value={formatNumber(counts.universes)}
          hint="Weekly snapshots"
          tone="success"
        />
        <StatCard
          label="Strategies"
          value={formatNumber(counts.strategies)}
          hint="Research and active registry"
          tone="info"
        />
        <StatCard
          label="Stored 1-minute bars"
          value={formatNumber(counts.candles)}
          hint="Source of truth for every timeframe"
          tone="highlight"
        />
        <StatCard
          label="Coverage"
          value={`${coveragePct.toFixed(1)}%`}
          hint={`${formatNumber(coverageComplete)} of ${formatNumber(coverageTotal)} instrument-days complete`}
          tone={coveragePct >= 99 ? 'success' : 'warning'}
        />
      </StatGrid>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          title="Recent jobs"
          description="Worker runs, retries and skipped provider calls are all recorded."
          toolbar={
            <Link href="/jobs" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              View all jobs
              <ArrowUpRight className="size-4" />
            </Link>
          }
          actions={<TableRefreshButton />}
        >
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
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.recentJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <p className="font-medium">{job.jobName}</p>
                      <p className="text-muted-foreground text-xs">{label(job.jobType)}</p>
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
                    <TableActions>
                      <TableActionLink href={`/jobs/${job.id}`} label="View job" />
                    </TableActions>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard
          title="Open quality issues"
          description="Gaps, invalid bars and mapping problems that need review."
        >
          {overview.openIssues.length === 0 ? (
            <EmptyState
              title="No open issues"
              description="The validation layer has not raised anything."
            />
          ) : (
            <div className="space-y-3">
              {overview.openIssues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/data/issues/${issue.id}`}
                  className="border-border/70 bg-background/40 block rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{label(issue.issueType)}</p>
                    <StatusBadge status={issue.severity} />
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {issue.symbol ?? 'Provider-wide'} · {issue.tradingDate ?? 'No trading date'} ·
                    detected {formatDateTime(issue.detectedAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
