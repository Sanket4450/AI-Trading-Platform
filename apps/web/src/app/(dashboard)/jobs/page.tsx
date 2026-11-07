import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { JobListResponse, JobRun } from '@/lib/types';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import { buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const ACTIVE_STATUSES = new Set(['queued', 'running', 'retrying']);

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'failed', label: 'Failed' },
  { value: 'succeeded', label: 'Succeeded' },
] as const;

function durationOf(run: JobRun): number | null {
  if (run.durationMs !== null) return run.durationMs;
  if (!run.startedAt) return null;
  return Date.now() - new Date(run.startedAt).getTime();
}

function stageProgress(run: JobRun): string {
  if (!run.currentStage) return '—';
  const index = run.stageKeys.indexOf(run.currentStage);
  if (index < 0) return label(run.currentStage);
  const total = run.stageTotal ?? run.stageKeys.length;
  return `${label(run.currentStage)} · ${index + 1}/${total}`;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  query.set('limit', '60');

  const data = await apiFetch<JobListResponse>(`/jobs?${query.toString()}`);
  const active = data.items.some((run) => ACTIVE_STATUSES.has(run.status));

  return (
    <div>
      <AutoRefresh active={active} />

      <StatGrid>
        <StatCard
          label="Running"
          value={formatNumber(data.summary.running)}
          hint="In flight right now"
          tone="info"
        />
        <StatCard
          label="Failed 24h"
          value={formatNumber(data.summary.failed24h)}
          hint="Terminal failures"
          tone="danger"
        />
        <StatCard
          label="Succeeded 24h"
          value={formatNumber(data.summary.succeeded24h)}
          hint="Completed normally"
          tone="success"
        />
        <StatCard
          label="p95 duration"
          value={formatDuration(data.summary.p95DurationMs)}
          hint="Last 24 hours"
          tone="highlight"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Jobs"
        description={`${data.items.length} recent runs · newest first. The detail view carries the stage rail and timestamped timeline.`}
        toolbar={
          <div className="flex flex-wrap items-center gap-1">
            {STATUS_FILTERS.map((filter) => (
              <Link
                key={filter.value || 'all'}
                href={filter.value ? `/jobs?status=${filter.value}` : '/jobs'}
                className={buttonVariants({
                  variant: params.status === filter.value ? 'secondary' : 'ghost',
                  size: 'sm',
                })}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        }
      >
        {data.items.length === 0 ? (
          <EmptyState
            title="No jobs yet"
            description="Scheduled jobs and operator-triggered commands appear here as soon as they run."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <Link href={`/jobs/${run.id}`} className="font-medium hover:underline">
                      {label(run.jobName)}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                      {run.id.slice(0, 8)}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {label(run.jobType)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {stageProgress(run)}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                    {run.startedAt ? formatDateTime(run.startedAt) : 'Queued'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatDuration(durationOf(run))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
