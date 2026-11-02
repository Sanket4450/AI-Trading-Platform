import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { BackfillPreview, InstrumentStatusRow } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { displayStatus, statusTone } from '@/lib/status';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  fetchStatus?: string;
  dataStatus?: string;
  search?: string;
  preview?: string;
  mode?: string;
  from?: string;
  to?: string;
  instrumentIds?: string | string[];
  error?: string;
  queued?: string;
  cancelled?: string;
  recomputed?: string;
}>;

function selectedIds(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function InstrumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const universeCode = params.universeCode ?? 'nifty-50';
  const query = new URLSearchParams({ universeCode, limit: '200' });
  if (params.fetchStatus) query.set('fetchStatus', params.fetchStatus);
  if (params.dataStatus) query.set('dataStatus', params.dataStatus);
  if (params.search) query.set('search', params.search);

  const [rows, summary] = await Promise.all([
    apiFetch<InstrumentStatusRow[]>(`/data/instrument-status?${query.toString()}`),
    apiFetch<Record<string, number>>(
      `/data/instrument-status/summary?universeCode=${encodeURIComponent(universeCode)}`,
    ),
  ]);

  const ids = selectedIds(params.instrumentIds);
  let preview: BackfillPreview | null = null;
  if (params.preview === '1') {
    try {
      const response = await apiFetch<{ dryRun: true; preview: BackfillPreview }>(
        '/data/instruments/fetch',
        {
          method: 'POST',
          body: JSON.stringify({
            instrumentIds: ids.length > 0 ? ids : undefined,
            universeCode: ids.length > 0 ? undefined : universeCode,
            mode: params.mode ?? 'missing_only',
            from: params.from || undefined,
            to: params.to || undefined,
            dryRun: true,
          }),
        },
      );
      preview = response.preview;
    } catch (error) {
      preview = null;
      params.error = error instanceof Error ? error.message : 'Preview failed';
    }
  }

  const active = rows.some(
    (row) =>
      row.fetchStatus === 'queued' ||
      row.fetchStatus === 'fetching' ||
      row.dataStatus === 'pending',
  );
  const selectedRows = rows.filter((row) => ids.includes(row.instrumentId));
  const selectionCounts = selectedRows.reduce<Record<string, number>>((counts, row) => {
    const status = displayStatus(row);
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div>
      <AutoRefresh active={active} />
      <PageHeader
        title="Instrument catalog"
        description="NIFTY 50 members in reviewed rank order. A row is complete only when coverage and the daily oracle prove it; a successful HTTP call is not completion."
      />

      {params.error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm">
          {params.error}
        </div>
      ) : null}
      {params.queued ? (
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 rounded-lg border px-4 py-3 text-sm">
          Fetch queued. Rows move through Queued, Fetching and Verifying before their data status
          settles.
        </div>
      ) : null}
      {params.cancelled ? (
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 rounded-lg border px-4 py-3 text-sm">
          Cancellation recorded. The in-flight chunk finishes cleanly.
        </div>
      ) : null}
      {params.recomputed ? (
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 rounded-lg border px-4 py-3 text-sm">
          Status recompute queued.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Catalog rows"
          value={formatNumber(summary?.total ?? rows.length)}
          hint="nifty-50 active version"
          tone="cyan"
        />
        <StatCard
          label="Complete"
          value={formatNumber(summary?.complete ?? 0)}
          hint="Coverage + oracle"
          tone="green"
        />
        <StatCard
          label="Gaps"
          value={formatNumber((summary?.partialReconciled ?? 0) + (summary?.partialMismatch ?? 0))}
          hint="Reconciled or mismatch"
          tone="amber"
        />
        <StatCard
          label="Needs review"
          value={formatNumber((summary?.needsReview ?? 0) + (summary?.missing ?? 0))}
          hint="Blocking or missing"
          tone="red"
        />
      </div>

      <Card className="border-border/70 bg-card/60 mt-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Default order is reviewed index rank. Rank 1 is the NIFTY 50 index; no weights are
            stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto]"
          >
            <div className="space-y-1.5">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                name="search"
                defaultValue={params.search ?? ''}
                placeholder="RELIANCE, bank…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fetchStatus">Fetch status</Label>
              <select
                id="fetchStatus"
                name="fetchStatus"
                defaultValue={params.fetchStatus ?? ''}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">Any</option>
                {[
                  'not_requested',
                  'queued',
                  'fetching',
                  'fetched',
                  'partial',
                  'failed',
                  'cancelled',
                  'stale',
                ].map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dataStatus">Data status</Label>
              <select
                id="dataStatus"
                name="dataStatus"
                defaultValue={params.dataStatus ?? ''}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">Any</option>
                {[
                  'complete',
                  'partial_reconciled',
                  'partial_mismatch',
                  'missing',
                  'pending',
                  'not_applicable',
                  'needs_review',
                ].map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="universeCode">Universe</Label>
              <Input id="universeCode" name="universeCode" defaultValue={universeCode} />
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="outline">
                Apply
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <form id="catalog-form" method="get" action="/instruments" className="mt-4">
        <input type="hidden" name="universeCode" value={universeCode} />
        <input type="hidden" name="preview" value="1" />
        <input type="hidden" name="from" value={params.from ?? ''} />
        <input type="hidden" name="to" value={params.to ?? ''} />
        <div className="border-border/70 bg-card/60 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
          <div className="text-muted-foreground text-sm">
            {ids.length > 0 ? (
              <span>
                {ids.length} selected ·{' '}
                {Object.entries(selectionCounts)
                  .map(([status, count]) => `${count} ${status}`)
                  .join(' · ')}
              </span>
            ) : (
              <span>No rows selected. Preview resolves the whole universe.</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              name="mode"
              defaultValue={params.mode ?? 'missing_only'}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="missing_only">missing only</option>
              <option value="force">force refresh</option>
            </select>
            <Button type="submit" variant="outline">
              Preview
            </Button>
          </div>
        </div>
      </form>

      {preview ? (
        <Card className="border-primary/25 bg-primary/5 mt-4">
          <CardHeader>
            <CardTitle>Preview · nothing queued yet</CardTitle>
            <CardDescription>
              {preview.resolved} resolved of {preview.instrumentCount} · {preview.sessionCount}{' '}
              sessions · {preview.requestCount} requests · {preview.skippedMonths} months skipped as
              complete
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p>
                <span className="text-muted-foreground">Window:</span> {preview.from} → {preview.to}
              </p>
              <p>
                <span className="text-muted-foreground">Months:</span> {preview.monthCount}
              </p>
              <p>
                <span className="text-muted-foreground">Estimated bars:</span>{' '}
                {formatNumber(preview.estimatedBars)}
              </p>
            </div>
            {preview.blocked.length > 0 ? (
              <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm">
                Blocked by missing mapping: {preview.blocked.map((row) => row.symbol).join(', ')}
              </div>
            ) : null}
            <form action={fetchInstrumentsAction} className="flex flex-wrap items-center gap-2">
              {ids.map((id) => (
                <input key={id} type="hidden" name="instrumentIds" value={id} />
              ))}
              {ids.length === 0 ? (
                <input type="hidden" name="universeCode" value={universeCode} />
              ) : null}
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
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>Ranked members</CardTitle>
          <CardDescription>
            {rows.length} rows · target window and both status axes are persisted by the worker.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    <TableHead />
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
                        <TableCell>
                          <input
                            type="checkbox"
                            name="instrumentIds"
                            value={row.instrumentId}
                            form="catalog-form"
                            defaultChecked={ids.includes(row.instrumentId)}
                            aria-label={`Select ${row.symbol}`}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {row.rank}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{row.symbol}</p>
                          <p className="text-muted-foreground max-w-52 truncate text-xs">
                            {row.name}
                          </p>
                          <p className="text-muted-foreground font-mono text-[10px]">
                            {row.segment} · tick {row.tickSize}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusTone(status)}>
                            {status}
                          </Badge>
                          <p className="text-muted-foreground mt-1 text-[10px]">
                            {row.fetchStatus ?? 'not_requested'} / {row.dataStatus ?? 'pending'}
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
                            <span className="text-muted-foreground text-xs">none</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.lastSuccessAt ? formatDateTime(row.lastSuccessAt) : 'never'}
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
                                <input
                                  type="hidden"
                                  name="instrumentIds"
                                  value={row.instrumentId}
                                />
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
        </CardContent>
      </Card>
    </div>
  );
}
