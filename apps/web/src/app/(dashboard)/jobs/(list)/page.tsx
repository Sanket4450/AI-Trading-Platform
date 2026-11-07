import { apiFetch } from '@/lib/api';
import type { JobListResponse, JobRun } from '@/lib/types';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import {
  MultiSelectFilter,
  SearchFilter,
  TableFilters,
} from '@/components/dashboard/table-filters';
import {
  TableActionLink,
  TableActions,
  TableRefreshButton,
} from '@/components/dashboard/table-actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const ACTIVE_STATUSES = new Set(['queued', 'running', 'retrying']);

const STATUS_OPTIONS = [
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'retrying', label: 'Retrying' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
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
  searchParams: Promise<{ status?: string | string[]; search?: string }>;
}) {
  const params = await searchParams;
  const statuses = params.status
    ? Array.isArray(params.status)
      ? params.status
      : [params.status]
    : [];
  const query = new URLSearchParams();
  for (const status of statuses) query.append('status', status);
  if (params.search) query.set('search', params.search);
  query.set('limit', '60');

  const data = await apiFetch<JobListResponse>(`/jobs?${query.toString()}`);
  const active = data.items.some((run) => ACTIVE_STATUSES.has(run.status));
  const hasFilters = Boolean(params.search || statuses.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AutoRefresh active={active} />

      <TableCard
        summary={
          <TableSummary
            items={[
              {
                label: 'Running',
                value: formatNumber(data.summary.running),
                hint: 'In flight right now',
                tone: 'info',
              },
              {
                label: 'Failed 24h',
                value: formatNumber(data.summary.failed24h),
                hint: 'Terminal failures',
                tone: 'danger',
              },
              {
                label: 'Succeeded 24h',
                value: formatNumber(data.summary.succeeded24h),
                hint: 'Completed normally',
                tone: 'success',
              },
              {
                label: 'p95 duration',
                value: formatDuration(data.summary.p95DurationMs),
                hint: 'Last 24 hours',
                tone: 'highlight',
              },
            ]}
          />
        }
        filters={
          <TableFilters>
            <SearchFilter
              defaultValue={params.search ?? ''}
              placeholder="Search job, type or ID…"
            />
            <MultiSelectFilter
              id="status"
              name="status"
              defaultValue={statuses}
              options={STATUS_OPTIONS}
              placeholder="All statuses"
            />
          </TableFilters>
        }
        actions={<TableRefreshButton />}
      >
        {data.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No jobs match"
              description={
                hasFilters
                  ? 'Clear the filters to see every run.'
                  : 'Scheduled jobs and operator-triggered commands appear here as soon as they run.'
              }
            />
          </div>
        ) : (
          <Table containerClassName="h-full overflow-auto">
            <TableHeader className="bg-card sticky top-0 z-10">
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <p className="font-medium">{label(run.jobName)}</p>
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
                  <TableActions>
                    <TableActionLink href={`/jobs/${run.id}`} label="View job" />
                  </TableActions>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </div>
  );
}
