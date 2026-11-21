import { apiFetch } from '@/lib/api';
import type { JobListResponse, JobStats } from '@/lib/types';
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
import { PageSizeSelect } from '@/components/dashboard/page-size-select';
import { Pagination } from '@/components/dashboard/pagination';
import { originHref } from '@/lib/navigation';
import { readCursorValue, readLimit } from '@/lib/pagination';
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
  searchParams: Promise<{
    status?: string | string[];
    search?: string;
    limit?: string | string[];
    after?: string | string[];
    before?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const from = originHref('/jobs', params);
  const statuses = params.status
    ? Array.isArray(params.status)
      ? params.status
      : [params.status]
    : [];
  const limit = readLimit(params.limit);
  const after = readCursorValue(params.after);
  const before = readCursorValue(params.before);
  const query = new URLSearchParams();
  for (const status of statuses) query.append('status', status);
  if (params.search) query.set('search', params.search);
  query.set('limit', String(limit));
  if (after) query.set('after', after);
  if (before) query.set('before', before);

  const [data, summary] = await Promise.all([
    apiFetch<JobListResponse>(`/jobs?${query.toString()}`),
    apiFetch<JobStats>('/jobs/summary'),
  ]);
  const hasFilters = Boolean(params.search || statuses.length > 0);
  const newestHref = originHref('/jobs', {
    status: params.status,
    search: params.search,
    limit: params.limit,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TableCard
        summary={
          <TableSummary
            items={[
              {
                label: 'Running',
                value: formatNumber(summary.running),
                hint: 'In flight right now',
                tone: 'info',
              },
              {
                label: 'Failed 24h',
                value: formatNumber(summary.failed24h),
                hint: 'Terminal failures',
                tone: 'danger',
              },
              {
                label: 'Succeeded 24h',
                value: formatNumber(summary.succeeded24h),
                hint: 'Completed normally',
                tone: 'success',
              },
              {
                label: 'p95 duration',
                value: formatDuration(summary.p95DurationMs),
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
        footer={
          <Pagination
            pageSizeControl={<PageSizeSelect value={limit} />}
            page={data.page}
            itemsCount={data.items.length}
            pathname="/jobs"
            searchParams={params}
            itemLabel="jobs"
          />
        }
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
          <JobsLive items={data.items} back={from} newestHref={newestHref} />
        )}
      </TableCard>
    </div>
  );
}
