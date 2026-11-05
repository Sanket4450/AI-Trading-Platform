import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { InstrumentStatusRow } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { displayStatus, statusTone } from '@/lib/status';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import { SubmitButton } from '@/components/dashboard/submit-button';
import {
  FilterField,
  FilterReset,
  FilterSelect,
  TableFilters,
} from '@/components/dashboard/table-filters';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cancelInstrumentAction, fetchInstrumentsAction, retryInstrumentAction } from './actions';

type SearchParams = Promise<{
  universeCode?: string;
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
  const universeCode = params.universeCode ?? 'nifty-50';
  const query = new URLSearchParams({ universeCode, limit: '200' });
  if (params.dataStatus) query.set('dataStatus', params.dataStatus);
  if (params.search) query.set('search', params.search);

  const [rows, summary] = await Promise.all([
    apiFetch<InstrumentStatusRow[]>(`/data/instrument-status?${query.toString()}`),
    apiFetch<Record<string, number>>(
      `/data/instrument-status/summary?universeCode=${encodeURIComponent(universeCode)}`,
    ),
  ]);

  const active = rows.some(
    (row) =>
      row.fetchStatus === 'queued' ||
      row.fetchStatus === 'fetching' ||
      row.dataStatus === 'pending',
  );
  const hasFilters = Boolean(params.dataStatus || params.search);

  return (
    <div>
      <AutoRefresh active={active} />

      <StatGrid>
        <StatCard
          label="Catalog rows"
          value={formatNumber(summary?.total ?? rows.length)}
          hint="nifty-50 active version"
          tone="info"
        />
        <StatCard
          label="Complete"
          value={formatNumber(summary?.complete ?? 0)}
          hint="Coverage + oracle"
          tone="success"
        />
        <StatCard
          label="Gaps"
          value={formatNumber((summary?.partialReconciled ?? 0) + (summary?.partialMismatch ?? 0))}
          hint="Reconciled or mismatch"
          tone="warning"
        />
        <StatCard
          label="Needs review"
          value={formatNumber((summary?.needsReview ?? 0) + (summary?.missing ?? 0))}
          hint="Blocking or missing"
          tone="danger"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Ranked members"
        description={`${rows.length} rows · target window and both status axes are persisted by the worker.`}
        toolbar={
          <TableFilters className="items-end">
            <input type="hidden" name="universeCode" value={universeCode} />
            <FilterField label="Search" htmlFor="search">
              <Input
                id="search"
                name="search"
                defaultValue={params.search ?? ''}
                placeholder="RELIANCE, bank…"
                className="h-8 w-44 text-xs"
              />
            </FilterField>
            <FilterField label="Data status" htmlFor="dataStatus">
              <FilterSelect
                id="dataStatus"
                name="dataStatus"
                defaultValue={params.dataStatus ?? ''}
                className="w-40"
                submitOnChange
                options={[
                  { value: '', label: 'Any status' },
                  ...dataStatuses.map((value) => ({ value, label: label(value) })),
                ]}
              />
            </FilterField>
            {hasFilters ? (
              <FilterReset href={`/instruments?universeCode=${encodeURIComponent(universeCode)}`} />
            ) : null}
          </TableFilters>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No instruments match"
            description="Clear the filters or run the R2 seed."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
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
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {row.rank}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{row.symbol}</p>
                        <p className="text-muted-foreground max-w-52 truncate text-xs">
                          {row.name}
                        </p>
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
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Link
                            href={`/instruments/${row.instrumentId}`}
                            className={buttonVariants({ variant: 'outline', size: 'sm' })}
                          >
                            Inspect
                          </Link>
                          {row.fetchStatus === 'failed' || row.fetchStatus === 'partial' ? (
                            <form action={retryInstrumentAction}>
                              <input type="hidden" name="instrumentId" value={row.instrumentId} />
                              <input type="hidden" name="returnTo" value="/instruments" />
                              <SubmitButton
                                size="sm"
                                variant="outline"
                                pendingLabel="Retrying…"
                              >
                                Retry
                              </SubmitButton>
                            </form>
                          ) : null}
                          {row.fetchStatus === 'queued' || row.fetchStatus === 'fetching' ? (
                            <form action={cancelInstrumentAction}>
                              <input type="hidden" name="instrumentId" value={row.instrumentId} />
                              <input type="hidden" name="returnTo" value="/instruments" />
                              <SubmitButton
                                size="sm"
                                variant="outline"
                                pendingLabel="Cancelling…"
                              >
                                Cancel
                              </SubmitButton>
                            </form>
                          ) : null}
                          {row.fetchStatus !== 'queued' && row.fetchStatus !== 'fetching' ? (
                            <form action={fetchInstrumentsAction}>
                              <input type="hidden" name="instrumentIds" value={row.instrumentId} />
                              <input type="hidden" name="mode" value="missing_only" />
                              <input type="hidden" name="returnTo" value="/instruments" />
                              <SubmitButton
                                size="sm"
                                pendingLabel={
                                  row.fetchStatus === 'not_requested' || !row.fetchStatus
                                    ? 'Fetching…'
                                    : 'Refreshing…'
                                }
                              >
                                {row.fetchStatus === 'not_requested' || !row.fetchStatus
                                  ? 'Fetch'
                                  : 'Refresh'}
                              </SubmitButton>
                            </form>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
