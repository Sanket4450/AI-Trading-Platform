import { apiFetch } from '@/lib/api';
import type { JobListResponse } from '@/lib/types';
import { formatNumber, formatDuration } from '@/lib/format';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { EmptyState } from '@/components/dashboard/empty-state';
import {
  MultiSelectFilter,
  SearchFilter,
  TableFilters,
} from '@/components/dashboard/table-filters';
import { TableRefreshButton } from '@/components/dashboard/table-actions';
import { originHref } from '@/lib/navigation';
import { JobsLive } from '@/features/jobs/components/jobs-live';

const STATUS_OPTIONS = [
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'partially_failed', label: 'Partially failed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; search?: string }>;
}) {
  const params = await searchParams;
  const from = originHref('/jobs', params);
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
  const hasFilters = Boolean(params.search || statuses.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
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
              placeholder="Search job, status or ID…"
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
          <JobsLive items={data.items} back={from} />
        )}
      </TableCard>
    </div>
  );
}
