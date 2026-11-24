import Link from 'next/link';
import { apiFetch, getSession } from '@/lib/api';
import type { EvaluationRun, Instrument, Paginated, StrategyDetail } from '@/lib/types';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { readLimit, readOffset } from '@/lib/pagination';
import { backLinkFor, detailHref, originHref } from '@/lib/navigation';
import { PageMeta } from '@/components/shell/page-meta';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { TableActions, TableActionLink, TableRefreshButton } from '@/components/dashboard/table-actions';
import { TableFilters, FilterSelect, DateRangeFilter } from '@/components/dashboard/table-filters';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageSizeSelect } from '@/components/dashboard/page-size-select';
import { Pagination } from '@/components/dashboard/pagination';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RunEvaluationDialog } from '../run-evaluation-dialog';

export default async function StrategyEvaluationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    from?: string | string[];
    status?: string;
    runFrom?: string;
    runTo?: string;
    limit?: string | string[];
    offset?: string | string[];
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const back = backLinkFor(query.from, '/strategies');
  const limit = readLimit(query.limit);
  const offset = readOffset(query.offset);
  const search = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (query.status) search.set('status', query.status);
  if (query.runFrom) search.set('from', query.runFrom);
  if (query.runTo) search.set('to', query.runTo);

  const [strategy, runs, session, instrumentPage] = await Promise.all([
    apiFetch<StrategyDetail>(`/strategies/${id}`),
    apiFetch<Paginated<EvaluationRun>>(`/strategies/${id}/evaluation-runs?${search.toString()}`),
    getSession(),
    apiFetch<Paginated<Instrument>>('/instruments?segment=NSE_EQ&limit=200'),
  ]);
  const isAdmin = session.user.role === 'admin';
  const runnable = strategy.versions
    .filter(
      (version) =>
        (version.status === 'active' || version.status === 'validated') &&
        version.runtimeStatus === 'registered',
    )
    .map((version) => ({
      id: version.id,
      version: version.version,
      codeRef: version.codeRef,
      runtimeStatus: version.runtimeStatus ?? 'unregistered',
      parameterHash:
        version.bindings.find((binding) => binding.role === 'parameters')?.payloadHash ?? null,
    }));
  const instruments = instrumentPage.items
    .filter((instrument) => instrument.isSyncTarget && instrument.instrumentType === 'EQ')
    .map((instrument) => ({
      id: instrument.id,
      symbol: instrument.tradingSymbol,
      name: instrument.name,
    }));
  const from = originHref(`/strategies/${id}/evaluations`, query);
  const hasFilters = Boolean(query.status || query.runFrom || query.runTo);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageMeta
        title={`${strategy.code} · Evaluations`}
        description="Research evaluation runs, their status and signal counts."
      />
      <DetailHeader
        back={back}
        badges={
          <>
            <Badge variant="outline">{strategy.code}</Badge>
            <StatusBadge status={strategy.runtime.status} />
          </>
        }
        meta={`${runs.page.total} runs`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={detailHref(`/strategies/${id}`, back.href)}>Strategy detail</Link>
            </Button>
            {isAdmin ? (
              <RunEvaluationDialog strategyId={id} versions={runnable} instruments={instruments} />
            ) : null}
          </>
        }
      />

      <TableCard
        className="min-h-0 flex-1"
        summary={
          <TableSummary
            items={[
              { label: 'Runs', value: formatNumber(runs.page.total), hint: 'All statuses' },
              {
                label: 'Showing',
                value: formatNumber(runs.items.length),
                hint: 'This page',
                tone: 'info',
              },
              {
                label: 'Latest',
                value: runs.items[0] ? label(runs.items[0].status) : 'Never',
                hint: runs.items[0] ? formatDateTime(runs.items[0].createdAt) : 'No run yet',
                tone: runs.items[0]?.status === 'failed' ? 'danger' : 'default',
              },
            ]}
          />
        }
        filters={
          <TableFilters>
            <FilterSelect
              id="status"
              name="status"
              defaultValue={query.status ?? ''}
              options={[
                { value: '', label: 'Any status' },
                { value: 'queued', label: 'Queued' },
                { value: 'running', label: 'Running' },
                { value: 'completed', label: 'Completed' },
                { value: 'failed', label: 'Failed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
            <DateRangeFilter
              fromName="runFrom"
              toName="runTo"
              defaultFrom={query.runFrom}
              defaultTo={query.runTo}
            />
          </TableFilters>
        }
        actions={<TableRefreshButton />}
        footer={
          <Pagination
            pageSizeControl={<PageSizeSelect value={limit} />}
            page={runs.page}
            itemsCount={runs.items.length}
            pathname={`/strategies/${id}/evaluations`}
            searchParams={query}
            itemLabel="runs"
          />
        }
      >
        {runs.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={hasFilters ? 'No runs for these filters' : 'No evaluations yet'}
              description={
                hasFilters
                  ? 'Clear the filters or start a new evaluation.'
                  : 'Run an evaluation on stored candles to see signals and instrument-day results.'
              }
            />
          </div>
        ) : (
          <Table containerClassName="h-full overflow-auto">
            <TableHeader className="bg-card sticky top-0 z-10">
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Range</TableHead>
                <TableHead>Capital</TableHead>
                <TableHead>Entries / exits</TableHead>
                <TableHead>Instrument-days</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.items.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDateTime(run.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">v{run.version}</Badge>
                      <span className="text-muted-foreground max-w-40 truncate text-xs">
                        {run.codeRef}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {run.fromDate} → {run.toDate}
                  </TableCell>
                  <TableCell>{formatMoney(run.initialCapital)}</TableCell>
                  <TableCell>
                    {formatNumber(run.entries)} / {formatNumber(run.exits)}
                  </TableCell>
                  <TableCell>{formatNumber(run.instrumentDays)}</TableCell>
                  <TableActions>
                    <TableActionLink
                      href={detailHref(`/strategies/${id}/evaluations/${run.id}`, from)}
                      label="View run"
                    />
                    {run.jobRunId ? (
                      <TableActionLink
                        href={detailHref(`/jobs/${run.jobRunId}`, from)}
                        label="View job ledger"
                        icon="refresh"
                        tone="neutral"
                      />
                    ) : null}
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
