import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type {
  BackfillPlan,
  CoverageHeatmapCell,
  CoverageSummary,
  IngestionRun,
  ProviderStatus,
  QualityIssue,
} from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import { Button } from '@/components/ui/button';
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
import {
  acknowledgeIssueAction,
  backfillAction,
  importCorporateActionsAction,
  refreshMaterializedViewAction,
  syncCalendarAction,
  syncInstrumentsAction,
} from './actions';

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function heatmapTone(cell: CoverageHeatmapCell): string {
  if (cell.status === 'not_applicable') return 'bg-muted/20';
  if (cell.status === 'missing') return 'bg-destructive/80';
  if (cell.status === 'complete') return 'bg-primary/80';
  if (cell.validationStatus === 'volume_reconciled') return 'bg-warning/80';
  return 'bg-destructive/60';
}

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    status?: string;
    instrumentId?: string;
    error?: string;
    job?: string;
    ack?: string;
    queued?: string;
    imported?: string;
    previewed?: string;
  }>;
}) {
  const params = await searchParams;
  const coverageQuery = new URLSearchParams();
  if (params.date) coverageQuery.set('date', params.date);
  if (params.status) coverageQuery.set('status', params.status);
  if (params.instrumentId) coverageQuery.set('instrumentId', params.instrumentId);
  coverageQuery.set('limit', '500');

  const summaryQuery = params.date ? `?date=${params.date}` : '';
  const heatmapFrom = isoDaysAgo(120);
  const heatmapTo = new Date().toISOString().slice(0, 10);

  const [summary, heatmap, plans, ingestionRuns, qualityIssues, provider] = await Promise.all([
    apiFetch<CoverageSummary>(`/data/coverage/summary${summaryQuery}`),
    apiFetch<CoverageHeatmapCell[]>(
      `/data/coverage/heatmap?from=${heatmapFrom}&to=${heatmapTo}&limit=5000`,
    ),
    apiFetch<BackfillPlan[]>('/data/backfill-plans?limit=8'),
    apiFetch<IngestionRun[]>('/data/ingestion-runs?limit=25'),
    apiFetch<QualityIssue[]>('/data/quality-issues?limit=50'),
    apiFetch<ProviderStatus>('/data/provider-status'),
  ]);

  const dates = [...new Set(heatmap.map((cell) => cell.tradingDate))].sort().slice(-60);
  const dateSet = new Set(dates);
  const byInstrument = new Map<
    string,
    { symbol: string; rank: number; cells: Map<string, CoverageHeatmapCell> }
  >();
  for (const cell of heatmap) {
    if (!dateSet.has(cell.tradingDate)) continue;
    const entry = byInstrument.get(cell.instrumentId) ?? {
      symbol: cell.symbol,
      rank: cell.rank,
      cells: new Map<string, CoverageHeatmapCell>(),
    };
    entry.cells.set(cell.tradingDate, cell);
    byInstrument.set(cell.instrumentId, entry);
  }
  const heatmapRows = [...byInstrument.entries()].sort((a, b) => a[1].rank - b[1].rank);
  const activePlans = plans.some((plan) => plan.status === 'queued' || plan.status === 'running');

  return (
    <div>
      <AutoRefresh active={activePlans} />
      <PageHeader
        title="Data health"
        description="Coverage is the preflight gate for every backtest. Strict completeness and the daily oracle are stored as separate verdicts."
      />

      {params.error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm">
          {params.error}
        </div>
      ) : null}
      {params.job ? (
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 rounded-lg border px-4 py-3 text-sm">
          Job queued: <span className="font-mono text-xs">{params.job}</span>
        </div>
      ) : null}
      {params.ack || params.queued || params.imported || params.previewed ? (
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 rounded-lg border px-4 py-3 text-sm">
          {params.ack ? 'Quality issue updated. ' : ''}
          {params.queued ? 'Reference job queued. ' : ''}
          {params.imported ? 'Corporate actions imported. ' : ''}
          {params.previewed ? 'Corporate-action dry run completed. ' : ''}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Complete"
          value={formatNumber(summary.complete)}
          hint="Strict zero-gap"
          tone="success"
        />
        <StatCard
          label="Partial"
          value={formatNumber(summary.partial)}
          hint="Some minutes missing"
          tone="warning"
        />
        <StatCard
          label="Missing"
          value={formatNumber(summary.missing)}
          hint="Zero bars on a trading day"
          tone="danger"
        />
        <StatCard
          label="Not applicable"
          value={formatNumber(summary.notApplicable)}
          hint="Holiday, suspension, pre-listing"
          tone="info"
        />
        <StatCard
          label="Reconciled"
          value={formatNumber(summary.validation.volume_reconciled ?? 0)}
          hint="Daily volume proves no lost trades"
          tone="highlight"
        />
      </div>

      <Card className="border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>Provider and budget</CardTitle>
          <CardDescription>
            The token is never returned. Reference sync and corporate-action import require the
            admin role.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs">Network</p>
            <p>{provider.networkEnabled ? 'enabled' : 'disabled'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Credentials</p>
            <p>
              API key {provider.apiKeyConfigured ? 'set' : 'missing'} · token{' '}
              {provider.tokenConfigured ? 'set' : 'missing'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Budget</p>
            <p>
              {provider.budget
                ? `${provider.budget.availableSecond}/s · ${provider.budget.availableMinute}/m · ${provider.budget.available30Minutes}/30m`
                : 'unavailable'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Last successful sync</p>
            <p>
              {provider.lastSuccessfulSyncAt
                ? formatDateTime(provider.lastSuccessfulSyncAt)
                : 'never'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Raw payloads</p>
            <p>
              {formatNumber(Number(provider.payloadCount))} ·{' '}
              {formatNumber(Number(provider.payloadBytes))} bytes
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Chunks</p>
            <p>
              {provider.runningChunks} running · {provider.queuedChunks} queued ·{' '}
              {provider.failedRuns24h} failed 24h
            </p>
          </div>
          <div className="sm:col-span-2 xl:col-span-2">
            <div className="flex flex-wrap gap-2">
              <form action={syncInstrumentsAction}>
                <Button type="submit" size="sm" variant="outline">
                  Sync instruments
                </Button>
              </form>
              <form action={syncCalendarAction}>
                <Button type="submit" size="sm" variant="outline">
                  Reconcile calendar
                </Button>
              </form>
              <form action={refreshMaterializedViewAction}>
                <Button type="submit" size="sm" variant="outline">
                  Refresh daily stats
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>Coverage heatmap · last {dates.length} sessions</CardTitle>
          <CardDescription>
            Green complete · amber partial + volume reconciled · red partial/missing + mismatch.
            Click a cell to open the day detail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {heatmapRows.length === 0 ? (
            <EmptyState
              title="No coverage rows"
              description="Fetch the nifty-50 catalog from the instruments screen."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-0 text-[10px]">
                <thead>
                  <tr>
                    <th className="bg-card sticky left-0 z-10 px-2 py-1 text-left">Instrument</th>
                    {dates.map((date) => (
                      <th key={date} className="text-muted-foreground px-1 py-1 font-normal">
                        {date.slice(5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapRows.map(([instrumentId, entry]) => (
                    <tr key={instrumentId}>
                      <th className="bg-card sticky left-0 z-10 px-2 py-1 text-left font-medium">
                        <Link href={`/instruments/${instrumentId}`} className="hover:text-primary">
                          {entry.rank}. {entry.symbol}
                        </Link>
                      </th>
                      {dates.map((date) => {
                        const cell = entry.cells.get(date);
                        if (!cell) {
                          return <td key={date} className="bg-muted/10 size-4 rounded-sm" />;
                        }
                        return (
                          <td key={date} className="p-0.5">
                            <Link
                              href={`/data/coverage/${instrumentId}/${date}`}
                              title={`${entry.symbol} ${date}: ${cell.status} / ${cell.validationStatus}`}
                              className={`block size-4 rounded-sm ${heatmapTone(cell)}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Backfill plans</CardTitle>
            <CardDescription>
              One parent plan, one child job per instrument, one run per month.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {plans.length === 0 ? (
              <EmptyState
                title="No plans"
                description="Launch a fetch from the instrument catalog."
              />
            ) : (
              <div className="space-y-2">
                {plans.map((plan) => (
                  <Link
                    key={plan.id}
                    href={`/data/backfills/${plan.id}`}
                    className="border-border/70 bg-background/40 block rounded-lg border p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs">{plan.id.slice(0, 8)}</span>
                      <StatusBadge status={plan.status} />
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {plan.progress.instruments} instruments · {plan.progress.succeeded}/
                      {plan.progress.chunks} chunks succeeded · {plan.progress.failed} failed ·{' '}
                      {plan.progress.running} running
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(plan.createdAt)} · {formatNumber(plan.progress.rowsWritten)}{' '}
                      rows written
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Quality issues</CardTitle>
            <CardDescription>
              One real problem, one issue, with an auditable lifecycle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {qualityIssues.length === 0 ? (
              <EmptyState title="No quality issues" description="The validation layer is clean." />
            ) : (
              <div className="space-y-3">
                {qualityIssues.slice(0, 10).map((issue) => (
                  <div
                    key={issue.id}
                    className="border-border/70 bg-background/40 rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link
                          href={`/data/issues/${issue.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {issue.ruleId ?? issue.issueType} · {issue.issueType.replaceAll('_', ' ')}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {issue.symbol ?? 'provider-wide'} · {issue.tradingDate ?? 'no date'} ·
                          seen {issue.occurrenceCount}×
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <StatusBadge status={issue.severity} />
                        <StatusBadge status={issue.status} />
                      </div>
                    </div>
                    <details className="mt-2">
                      <summary className="text-muted-foreground cursor-pointer text-xs">
                        Evidence
                      </summary>
                      <div className="mt-2">
                        <JsonBlock value={issue.details} />
                      </div>
                    </details>
                    <form
                      action={acknowledgeIssueAction}
                      className="mt-2 flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="issueId" value={issue.id} />
                      <input type="hidden" name="returnTo" value="/data" />
                      <select
                        name="status"
                        defaultValue="acknowledged"
                        className="border-input h-8 rounded-md border bg-transparent px-2 text-xs"
                      >
                        <option value="acknowledged">acknowledge</option>
                        <option value="resolved">resolve</option>
                        <option value="ignored">ignore</option>
                      </select>
                      <Input
                        name="note"
                        placeholder="Note (required to resolve/ignore)"
                        className="h-8 max-w-xs text-xs"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Update
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Ingestion runs</CardTitle>
            <CardDescription>
              Every provider fetch, including skipped and failed runs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ingestionRuns.length === 0 ? (
              <EmptyState
                title="No ingestion runs"
                description="Trigger a backfill to create one."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Rows</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingestionRuns.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>{run.runType}</TableCell>
                        <TableCell>{run.symbol ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {run.requestedFrom ?? '—'} → {run.requestedTo ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {run.rowsFetched}/{run.rowsWritten}/{run.rowsRejected}
                        </TableCell>
                        <TableCell>
                          <Link href={`/data/runs/${run.id}`}>
                            <StatusBadge status={run.status} />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Corporate actions import</CardTitle>
            <CardDescription>
              Reviewed CSV only. Dry run first; confirmed factors are used by read-time adjustment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={importCorporateActionsAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="csv">CSV</Label>
                <textarea
                  id="csv"
                  name="csv"
                  rows={6}
                  placeholder="isin,symbol,ex_date,action_type,ratio_numerator,ratio_denominator,dividend_per_share,price_factor,volume_factor,source,notes,status"
                  className="border-input w-full rounded-md border bg-transparent p-2 font-mono text-xs"
                />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="source">Source</Label>
                  <Input id="source" name="source" defaultValue="reviewed-csv" className="h-8" />
                </div>
                <select
                  name="dryRun"
                  defaultValue="true"
                  className="border-input h-8 rounded-md border bg-transparent px-2 text-xs"
                >
                  <option value="true">dry run</option>
                  <option value="false">import</option>
                </select>
                <Button type="submit" size="sm" variant="outline">
                  Validate
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>Bounded single-instrument repair</CardTitle>
          <CardDescription>
            Legacy 31-day repair endpoint. The instrument catalog is the normal entry point.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={backfillAction} className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="instrumentId">Instrument ID</Label>
              <Input id="instrumentId" name="instrumentId" placeholder="UUID" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from">From</Label>
              <Input id="from" name="from" type="date" min="2022-01-01" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="date" min="2022-01-01" required />
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="outline">
                Queue repair
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
