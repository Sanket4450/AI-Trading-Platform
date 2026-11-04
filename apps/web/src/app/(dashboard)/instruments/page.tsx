import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '@/lib/api';
import type { BackfillPreview, InstrumentStatusRow } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { displayStatus, statusTone } from '@/lib/status';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import { MountToast } from '@/components/dashboard/action-toast';
import {
  FilterField,
  FilterReset,
  FilterSelect,
  TableFilters,
} from '@/components/dashboard/table-filters';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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
  preview?: string;
  mode?: string;
  from?: string;
  to?: string;
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

  let preview: BackfillPreview | null = null;
  let previewError: string | null = null;
  if (params.preview === '1') {
    try {
      const response = await apiFetch<{ dryRun: true; preview: BackfillPreview }>(
        '/data/instruments/fetch',
        {
          method: 'POST',
          body: JSON.stringify({
            universeCode,
            mode: params.mode ?? 'missing_only',
            from: params.from || undefined,
            to: params.to || undefined,
            dryRun: true,
          }),
        },
      );
      preview = response.preview;
    } catch (error) {
      previewError = apiErrorMessage(error, 'Preview failed');
    }
  }

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
      {previewError ? <MountToast type="error" message={previewError} /> : null}

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

      {preview ? (
        <SectionCard
          className="border-primary/25 bg-primary/5 mt-4"
          title="Preview · nothing queued yet"
          description={
            <>
              {preview.resolved} resolved of {preview.instrumentCount} · {preview.sessionCount}{' '}
              sessions · {preview.requestCount} requests · {preview.skippedMonths} months skipped as
              complete
            </>
          }
        >
          <KeyValueGrid
            columns={4}
            items={[
              { label: 'Window', value: `${preview.from} → ${preview.to}` },
              { label: 'Months', value: formatNumber(preview.monthCount) },
              { label: 'Estimated bars', value: formatNumber(preview.estimatedBars) },
              { label: 'Estimated bytes', value: formatNumber(preview.estimatedBytes) },
            ]}
          />
          {preview.blocked.length > 0 ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mt-3 rounded-lg border px-3 py-2 text-sm">
              Blocked by missing mapping: {preview.blocked.map((row) => row.symbol).join(', ')}
            </div>
          ) : null}
          <form action={fetchInstrumentsAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="universeCode" value={universeCode} />
            <input type="hidden" name="mode" value={params.mode ?? 'missing_only'} />
            <input type="hidden" name="from" value={params.from ?? ''} />
            <input type="hidden" name="to" value={params.to ?? ''} />
            <input type="hidden" name="returnTo" value="/instruments" />
            {(params.mode ?? 'missing_only') === 'force' ? (
              <Input
                name="reason"
                placeholder="Reason for force refresh"
                required
                className="max-w-sm"
              />
            ) : null}
            <Button type="submit">Confirm and launch</Button>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard
        className="mt-4"
        title="Ranked members"
        description={`${rows.length} rows · target window and both status axes are persisted by the worker.`}
        toolbar={
          <TableFilters>
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
        actions={
          <form method="get" action="/instruments" className="flex flex-nowrap items-center gap-2">
            <input type="hidden" name="universeCode" value={universeCode} />
            <input type="hidden" name="preview" value="1" />
            <input type="hidden" name="from" value={params.from ?? ''} />
            <input type="hidden" name="to" value={params.to ?? ''} />
            <input type="hidden" name="search" value={params.search ?? ''} />
            <input type="hidden" name="dataStatus" value={params.dataStatus ?? ''} />
            <FilterField label="Fetch mode" htmlFor="mode">
              <FilterSelect
                id="mode"
                name="mode"
                defaultValue={params.mode ?? 'missing_only'}
                className="w-36"
                options={[
                  { value: 'missing_only', label: 'Missing only' },
                  { value: 'force', label: 'Force refresh' },
                ]}
              />
            </FilterField>
            <Button type="submit" size="sm" variant="outline">
              <CalendarClock className="size-4" />
              Preview fetch
            </Button>
          </form>
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
                              <Button type="submit" size="sm" variant="outline">
                                Retry
                              </Button>
                            </form>
                          ) : null}
                          {row.fetchStatus === 'queued' || row.fetchStatus === 'fetching' ? (
                            <form action={cancelInstrumentAction}>
                              <input type="hidden" name="instrumentId" value={row.instrumentId} />
                              <input type="hidden" name="returnTo" value="/instruments" />
                              <Button type="submit" size="sm" variant="outline">
                                Cancel
                              </Button>
                            </form>
                          ) : null}
                          {row.fetchStatus !== 'queued' && row.fetchStatus !== 'fetching' ? (
                            <form action={fetchInstrumentsAction}>
                              <input type="hidden" name="instrumentIds" value={row.instrumentId} />
                              <input type="hidden" name="mode" value="missing_only" />
                              <input type="hidden" name="returnTo" value="/instruments" />
                              <Button type="submit" size="sm">
                                {row.fetchStatus === 'not_requested' || !row.fetchStatus
                                  ? 'Fetch'
                                  : 'Refresh'}
                              </Button>
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
