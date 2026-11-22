import { apiFetch } from '@/lib/api';
import { EXTERNAL_API_OUTCOMES, EXTERNAL_API_SERVICES } from '@ai-trading/domain';
import type { ExternalApiCallPage } from '@/lib/types';
import { formatDuration, formatNumber } from '@/lib/format';
import { originHref } from '@/lib/navigation';
import { readCursorValue, readLimit } from '@/lib/pagination';
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
import { ApiCallTable } from '@/features/jobs/components/api-call-table';
import { apiOutcomeMeta, apiServiceLabel } from '@/features/jobs/api-call-labels';

const SERVICE_OPTIONS = EXTERNAL_API_SERVICES.map((value) => ({
  value,
  label: apiServiceLabel(value),
}));

const OUTCOME_OPTIONS = EXTERNAL_API_OUTCOMES.map((value) => ({
  value,
  label: apiOutcomeMeta(value).label,
}));

export default async function ApiCallsPage({
  searchParams,
}: {
  searchParams: Promise<{
    service?: string | string[];
    outcome?: string | string[];
    search?: string;
    limit?: string | string[];
    after?: string | string[];
    before?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const from = originHref('/api-calls', params);
  const services = params.service
    ? Array.isArray(params.service)
      ? params.service
      : [params.service]
    : [];
  const outcomes = params.outcome
    ? Array.isArray(params.outcome)
      ? params.outcome
      : [params.outcome]
    : [];
  const limit = readLimit(params.limit);
  const after = readCursorValue(params.after);
  const before = readCursorValue(params.before);

  const query = new URLSearchParams();
  for (const service of services) query.append('service', service);
  for (const outcome of outcomes) query.append('outcome', outcome);
  if (params.search) query.set('search', params.search);
  query.set('limit', String(limit));
  if (after) query.set('after', after);
  if (before) query.set('before', before);

  const data = await apiFetch<ExternalApiCallPage>(`/api-calls?${query.toString()}`);
  const hasFilters = Boolean(params.search || services.length > 0 || outcomes.length > 0);
  const failed = data.summary.outcomes
    .filter((row) => row.outcome !== 'success')
    .reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TableCard
        summary={
          <TableSummary
            items={[
              {
                label: 'Calls',
                value: formatNumber(data.summary.total),
                hint: 'Rows matching these filters',
                tone: 'info',
              },
              {
                label: 'Failed',
                value: formatNumber(failed),
                hint: 'Every non-success outcome',
                tone: failed > 0 ? 'danger' : 'success',
              },
              {
                label: 'p95',
                value: formatDuration(data.summary.p95LatencyMs),
                hint: 'Network time for the 95th percentile',
                tone: 'highlight',
              },
              {
                label: 'Slowest',
                value: formatDuration(data.summary.maxLatencyMs),
                hint: 'Longest single call in the filter',
                tone: 'warning',
              },
            ]}
          />
        }
        filters={
          <TableFilters>
            <SearchFilter
              defaultValue={params.search ?? ''}
              placeholder="Search operation, instrument or job…"
            />
            <MultiSelectFilter
              id="service"
              name="service"
              defaultValue={services}
              options={SERVICE_OPTIONS}
              placeholder="All services"
            />
            <MultiSelectFilter
              id="outcome"
              name="outcome"
              defaultValue={outcomes}
              options={OUTCOME_OPTIONS}
              placeholder="All outcomes"
            />
          </TableFilters>
        }
        actions={<TableRefreshButton />}
        footer={
          <Pagination
            pageSizeControl={<PageSizeSelect value={limit} />}
            page={data.page}
            itemsCount={data.items.length}
            pathname="/api-calls"
            searchParams={params}
            itemLabel="calls"
          />
        }
      >
        {data.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No calls match"
              description={
                hasFilters
                  ? 'Clear the filters to see every provider call.'
                  : 'Outbound provider calls appear here as soon as a job makes one. The ledger keeps 90 days.'
              }
            />
          </div>
        ) : (
          <ApiCallTable calls={data.items} showJob from={from} />
        )}
      </TableCard>
    </div>
  );
}
