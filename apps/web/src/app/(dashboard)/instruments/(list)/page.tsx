import { apiFetch } from '@/lib/api';
import type { InstrumentCoverageRow } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { displayStatus, statusTone } from '@/lib/status';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import {
  TableActionButton,
  TableActionLink,
  TableActions,
  TableRefreshButton,
} from '@/components/dashboard/table-actions';
import { ConfirmDialog } from '@/components/dashboard/confirm-dialog';
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
import { cancelInstrumentAction, fetchInstrumentsAction } from '../actions';
import { coverageCancelCopy, coverageFetchCopy } from '@/lib/coverage-actions';

type SearchParams = Promise<{
  dataStatus?: string;
  search?: string;
}>;

const dataStatuses = [
  'complete',
  'partial_reconciled',
  'partial_mismatch',
  'missing',
  'pending',
  'not_applicable',
  'needs_review',
];

export default async function InstrumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = originHref('/instruments', params);
  const query = new URLSearchParams({ limit: '200' });
  if (params.dataStatus) query.set('dataStatus', params.dataStatus);
  if (params.search) query.set('search', params.search);

  const [rows, summary] = await Promise.all([
    apiFetch<InstrumentCoverageRow[]>(`/instruments/status?${query.toString()}`),
    apiFetch<Record<string, number>>('/instruments/status/summary'),
  ]);

  const active = rows.some(
    (row) =>
      row.fetchStatus === 'queued' ||
      row.fetchStatus === 'fetching' ||
      row.dataStatus === 'pending',
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
                value: formatNumber(summary?.total ?? rows.length),
                hint: 'Sync targets',
                tone: 'info',
              },
              {
                label: 'Complete',
                value: formatNumber(summary?.complete ?? 0),
                hint: 'Coverage + oracle',
                tone: 'success',
              },
              {
                label: 'Gaps',
                value: formatNumber(
                  (summary?.partialReconciled ?? 0) + (summary?.partialMismatch ?? 0),
                ),
                hint: 'Reconciled or mismatch',
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
                const fetchCopy = coverageFetchCopy(row);
                const cancelCopy = coverageCancelCopy(row.symbol);
                const fetching = row.fetchStatus === 'queued' || row.fetchStatus === 'fetching';
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
                      {row.openCriticalIssues ? (
                        <StatusBadge status="critical" />
                      ) : (
                        <span className="text-muted-foreground text-xs">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.lastSuccessAt ? formatDateTime(row.lastSuccessAt) : 'Never'}
                    </TableCell>
                    <TableActions>
                      <TableActionLink
                        href={detailHref(`/instruments/${row.instrumentId}`, from)}
                        label="View instrument"
                      />
                      {fetching ? (
                        <ConfirmDialog
                          trigger={
                            <TableActionButton
                              icon="cancel"
                              tone="destructive"
                              label={cancelCopy.label}
                              tooltip={cancelCopy.tooltip}
                            />
                          }
                          title={cancelCopy.title}
                          description={cancelCopy.description}
                          confirmLabel={cancelCopy.label}
                          tone="destructive"
                          action={cancelInstrumentAction}
                          hiddenFields={{
                            instrumentId: row.instrumentId,
                            returnTo: '/instruments',
                          }}
                        />
                      ) : null}
                      {fetchCopy && !fetching ? (
                        <ConfirmDialog
                          trigger={
                            <TableActionButton
                              icon="refresh"
                              tone="refresh"
                              label={fetchCopy.label}
                              tooltip={fetchCopy.tooltip}
                            />
                          }
                          title={fetchCopy.title}
                          description={fetchCopy.description}
                          confirmLabel={fetchCopy.label}
                          action={fetchInstrumentsAction}
                          hiddenFields={{
                            instrumentIds: row.instrumentId,
                            mode: 'missing_only',
                            returnTo: '/instruments',
                          }}
                        />
                      ) : null}
                    </TableActions>
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
