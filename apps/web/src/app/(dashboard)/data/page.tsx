import { apiFetch } from '@/lib/api';
import type { CoverageRow, CoverageSummary, IngestionRun, QualityIssue } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
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
import { acknowledgeIssueAction, backfillAction, refreshMaterializedViewAction } from './actions';

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
  }>;
}) {
  const params = await searchParams;
  const coverageQuery = new URLSearchParams();
  if (params.date) coverageQuery.set('date', params.date);
  if (params.status) coverageQuery.set('status', params.status);
  if (params.instrumentId) coverageQuery.set('instrumentId', params.instrumentId);
  coverageQuery.set('limit', '500');

  const summaryQuery = params.date ? `?date=${params.date}` : '';
  const [summary, coverage, ingestionRuns, qualityIssues] = await Promise.all([
    apiFetch<CoverageSummary>(`/data/coverage/summary${summaryQuery}`),
    apiFetch<CoverageRow[]>(`/data/coverage?${coverageQuery.toString()}`),
    apiFetch<IngestionRun[]>('/data/ingestion-runs?limit=25'),
    apiFetch<QualityIssue[]>('/data/quality-issues?limit=50'),
  ]);

  return (
    <div>
      <PageHeader
        title="Data health"
        description="Coverage is the preflight gate for every backtest. A missing bar is visible evidence, not a silent gap."
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
      {params.ack ? (
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 rounded-lg border px-4 py-3 text-sm">
          Quality issue updated.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Complete"
          value={formatNumber(summary.complete)}
          hint="Expected bars present"
          tone="green"
        />
        <StatCard
          label="Partial"
          value={formatNumber(summary.partial)}
          hint="Some bars missing"
          tone="amber"
        />
        <StatCard
          label="Missing"
          value={formatNumber(summary.missing)}
          hint="No stored bars"
          tone="red"
        />
        <StatCard
          label="Instrument-days"
          value={formatNumber(summary.total)}
          hint="Checked rows"
          tone="cyan"
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Coverage</CardTitle>
            <CardDescription>
              Expected versus stored 1-minute bars per instrument-day.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form method="get" className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="date">Trading date</Label>
                <Input id="date" name="date" type="date" defaultValue={params.date ?? ''} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={params.status ?? ''}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="complete">Complete</option>
                  <option value="partial">Partial</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="outline">
                  Filter
                </Button>
              </div>
            </form>

            {coverage.length === 0 ? (
              <EmptyState
                title="No coverage rows"
                description="Run a bounded backfill or change the filter."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Stored</TableHead>
                    <TableHead>Gaps</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coverage.slice(0, 60).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <p className="font-medium">{row.symbol}</p>
                        <p className="text-muted-foreground text-xs">{row.name}</p>
                      </TableCell>
                      <TableCell>{row.tradingDate}</TableCell>
                      <TableCell>{row.expectedBars}</TableCell>
                      <TableCell>{row.storedBars}</TableCell>
                      <TableCell>{row.gapCount}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>Bounded backfill</CardTitle>
              <CardDescription>
                One month maximum per request for 1-minute candles. History starts 2022-01-01.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={backfillAction} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="instrumentId">Instrument ID</Label>
                  <Input id="instrumentId" name="instrumentId" placeholder="UUID" required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="from">From</Label>
                    <Input id="from" name="from" type="date" min="2022-01-01" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="to">To</Label>
                    <Input id="to" name="to" type="date" min="2022-01-01" required />
                  </div>
                </div>
                <Button type="submit">Queue backfill</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>Daily projection</CardTitle>
              <CardDescription>
                Rebuild the materialized view after ingestion. It is a cache, never a source of
                truth.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={refreshMaterializedViewAction}>
                <Button type="submit" variant="outline">
                  Refresh daily stats
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
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
                        <StatusBadge status={run.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Quality issues</CardTitle>
            <CardDescription>Validation findings, with an explicit workflow state.</CardDescription>
          </CardHeader>
          <CardContent>
            {qualityIssues.length === 0 ? (
              <EmptyState title="No quality issues" description="The validation layer is clean." />
            ) : (
              <div className="space-y-3">
                {qualityIssues.slice(0, 12).map((issue) => (
                  <div
                    key={issue.id}
                    className="border-border/70 bg-background/40 rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {issue.issueType.replaceAll('_', ' ')}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {issue.symbol ?? 'provider-wide'} · {issue.tradingDate ?? 'no date'} ·{' '}
                          {formatDateTime(issue.detectedAt)}
                        </p>
                      </div>
                      <StatusBadge status={issue.severity} />
                    </div>
                    <details className="mt-2">
                      <summary className="text-muted-foreground cursor-pointer text-xs">
                        Details
                      </summary>
                      <div className="mt-2">
                        <JsonBlock value={issue.details} />
                      </div>
                    </details>
                    <form action={acknowledgeIssueAction} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="issueId" value={issue.id} />
                      <select
                        name="status"
                        defaultValue="acknowledged"
                        className="border-input h-8 rounded-md border bg-transparent px-2 text-xs"
                      >
                        <option value="acknowledged">acknowledge</option>
                        <option value="resolved">resolve</option>
                        <option value="ignored">ignore</option>
                      </select>
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
    </div>
  );
}
