import { apiFetch } from '@/lib/api';
import type { InstrumentCoverageRow, Paginated } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { displayStatus, statusTone } from '@/lib/status';
import { readLimit, readOffset } from '@/lib/pagination';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import { TableRefreshButton } from '@/components/dashboard/table-actions';
import { PageSizeSelect } from '@/components/dashboard/page-size-select';
import { Pagination } from '@/components/dashboard/pagination';
import { InstrumentRowActions } from '../instrument-actions';
import { FilterSelect, SearchFilter, TableFilters } from '@/components/dashboard/table-filters';
import { detailHref, originHref } from '@/lib/navigation';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SearchParams = Promise<{
  dataStatus?: string;
  search?: string;
  limit?: string | string[];
  offset?: string | string[];
}>;

const dataStatuses = [
  'complete',
  'partial_mismatch',
  'missing',
  'pending',
  'not_applicable',
  'needs_review',
];

export default async function InstrumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = originHref('/instruments', params);
  const limit = readLimit(params.limit);
  const offset = readOffset(params.offset);
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const summaryQuery = new URLSearchParams();
  if (params.dataStatus) {
    query.set('dataStatus', params.dataStatus);
    summaryQuery.set('dataStatus', params.dataStatus);
  }
  if (params.search) {
    query.set('search', params.search);
    summaryQuery.set('search', params.search);
  }

  const [data, summary] = await Promise.all([
    apiFetch<Paginated<InstrumentCoverageRow>>(`/instruments/status?${query.toString()}`),
    apiFetch<Record<string, number>>(
      `/instruments/status/summary?${summaryQuery.toString()}`,
    ),
  ]);
  const rows = data.items;

  const active = rows.some(
    (row) => Boolean(row.activeJobId) || row.dataStatus === 'pending',
  );
  const hasFilters = Boolean(params.dataStatus || params.search);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AutoRefresh active={active} />

      <TableCard
        summary={
          <TableSummary
            items={[
              {
                label: 'Catalog rows',
                value: formatNumber(summary?.total ?? data.page.total),
                hint: 'Sync targets',
                tone: 'info',
              },
              {
                label: 'Complete',
                value: formatNumber(summary?.complete ?? 0),
                hint: 'Coverage complete',
                tone: 'success',
              },
              {
                label: 'Gaps',
                value: formatNumber(summary?.partialMismatch ?? 0),
                hint: 'Partial coverage',
                tone: 'warning',
              },
              {
                label: 'Needs review',
                value: formatNumber((summary?.needsReview ?? 0) + (summary?.missing ?? 0)),
                hint: 'Blocking or missing',
                tone: 'danger',
              },
            ]}
          />
        }
        filters={
          <TableFilters>
            <SearchFilter defaultValue={params.search ?? ''} placeholder="Search symbol or name…" />
            <FilterSelect
              id="dataStatus"
              name="dataStatus"
              defaultValue={params.dataStatus ?? ''}
              submitOnChange
              options={[
                { value: '', label: 'Any status' },
                ...dataStatuses.map((value) => ({ value, label: label(value) })),
              ]}
            />
          </TableFilters>
        }
        actions={<TableRefreshButton />}
        footer={
          <Pagination
            pageSizeControl={<PageSizeSelect value={limit} />}
            page={data.page}
            itemsCount={rows.length}
            pathname="/instruments"
            searchParams={params}
            itemLabel="instruments"
          />
        }
      >
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No instruments match"
              description={
                hasFilters ? 'Clear the filters or run the R2 seed.' : 'Run the R2 seed.'
              }
            />
          </div>
        ) : (
          <Table containerClassName="h-full overflow-auto">
            <TableHeader className="bg-card sticky top-0 z-10">
              <TableRow>
                <TableHead>Instrument</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Target window</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Last success</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const status = displayStatus(row);
                return (
                  <TableRow key={row.instrumentId}>
                    <TableCell>
                      <p className="font-medium">{row.symbol}</p>
                      <p className="text-muted-foreground max-w-52 truncate text-xs">{row.name}</p>
                      <p className="text-muted-foreground text-[10px]">
                        {label(row.segment)} · tick {formatNumber(row.tickSize)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusTone(status)}>
                        {status}
                      </Badge>
                      <p className="text-muted-foreground mt-1 text-[10px]">
                        {label(row.fetchStatus, 'Not requested')} ·{' '}
                        {label(row.dataStatus, 'Pending')}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.targetFrom ?? '—'} → {row.targetTo ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.completeDays ?? 0}/{row.expectedDays ?? 0}
                      <span className="text-muted-foreground block text-[10px]">
                        {row.partialDays ?? 0} partial · {row.missingDays ?? 0} missing
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.openCriticalIssues || row.openWarningIssues ? (
                        <div className="flex flex-wrap gap-1">
                          {row.openCriticalIssues ? <StatusBadge status="critical" /> : null}
                          {row.openWarningIssues ? <StatusBadge status="warning" /> : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.lastSuccessAt ? formatDateTime(row.lastSuccessAt) : 'Never'}
                    </TableCell>
                    <InstrumentRowActions
                      row={row}
                      returnTo="/instruments"
                      viewHref={detailHref(`/instruments/${row.instrumentId}`, from)}
                    />
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </div>
  );
}
