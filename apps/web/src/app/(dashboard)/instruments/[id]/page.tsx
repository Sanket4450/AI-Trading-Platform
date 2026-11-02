import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { CorporateAction, InstrumentMapping, InstrumentStatusDetail } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/format';
import { displayStatus, statusTone } from '@/lib/status';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  cancelInstrumentAction,
  fetchInstrumentsAction,
  recomputeStatusAction,
  retryInstrumentAction,
} from '../actions';

export default async function InstrumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    queued?: string;
    cancelled?: string;
    recomputed?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [detail, mappings, actions] = await Promise.all([
    apiFetch<InstrumentStatusDetail>(`/data/instrument-status/${id}`),
    apiFetch<InstrumentMapping[]>(`/instruments/${id}/mappings`),
    apiFetch<CorporateAction[]>(`/instruments/${id}/corporate-actions`),
  ]);
  const status = displayStatus(detail);

  return (
    <div>
      <PageHeader
        title={`${detail.symbol} · instrument detail`}
        description="Target window, month grid, runs, mappings and issue evidence. The browser never computes coverage."
      />

      {query.error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm">
          {query.error}
        </div>
      ) : null}
      {query.queued || query.cancelled || query.recomputed ? (
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 rounded-lg border px-4 py-3 text-sm">
          {query.queued ? 'Fetch queued. ' : ''}
          {query.cancelled ? 'Cancellation recorded. ' : ''}
          {query.recomputed ? 'Status recompute queued.' : ''}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={statusTone(status)}>
          {status}
        </Badge>
        <Badge variant="outline">
          {detail.fetchStatus ?? 'not_requested'} / {detail.dataStatus ?? 'pending'}
        </Badge>
        <Badge variant="outline" className="font-mono text-[10px]">
          {detail.segment} · tick {detail.tickSize}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {detail.targetFrom ?? '—'} → {detail.targetTo ?? '—'}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          <Link href="/instruments" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to catalog
          </Link>
          <form action={recomputeStatusAction}>
            <input type="hidden" name="instrumentId" value={detail.instrumentId} />
            <input type="hidden" name="returnTo" value={`/instruments/${detail.instrumentId}`} />
            <Button type="submit" size="sm" variant="outline">
              Recompute
            </Button>
          </form>
          {detail.fetchStatus === 'failed' || detail.fetchStatus === 'partial' ? (
            <form action={retryInstrumentAction}>
              <input type="hidden" name="instrumentId" value={detail.instrumentId} />
              <input type="hidden" name="returnTo" value={`/instruments/${detail.instrumentId}`} />
              <Button type="submit" size="sm" variant="outline">
                Retry failed months
              </Button>
            </form>
          ) : null}
          {detail.fetchStatus === 'queued' || detail.fetchStatus === 'fetching' ? (
            <form action={cancelInstrumentAction}>
              <input type="hidden" name="instrumentId" value={detail.instrumentId} />
              <input type="hidden" name="returnTo" value={`/instruments/${detail.instrumentId}`} />
              <Button type="submit" size="sm" variant="outline">
                Cancel
              </Button>
            </form>
          ) : (
            <form action={fetchInstrumentsAction}>
              <input type="hidden" name="instrumentIds" value={detail.instrumentId} />
              <input type="hidden" name="mode" value="missing_only" />
              <input type="hidden" name="returnTo" value={`/instruments/${detail.instrumentId}`} />
              <Button type="submit" size="sm">
                Refresh missing months
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Expected days"
          value={formatNumber(detail.expectedDays ?? 0)}
          hint="Scheduled instrument-days"
          tone="cyan"
        />
        <StatCard
          label="Complete days"
          value={formatNumber(detail.completeDays ?? 0)}
          hint="Strict zero-gap"
          tone="green"
        />
        <StatCard
          label="Partial days"
          value={formatNumber(detail.partialDays ?? 0)}
          hint="Some minutes missing"
          tone="amber"
        />
        <StatCard
          label="Open critical"
          value={formatNumber(detail.openCriticalIssues ?? 0)}
          hint="Blocks preflight"
          tone="red"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Month grid</CardTitle>
            <CardDescription>
              Repair is month-granular because the provider returns a whole month per request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detail.months.length === 0 ? (
              <EmptyState
                title="No coverage yet"
                description="Fetch the target window to create coverage rows."
              />
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                {detail.months.map((month) => {
                  const tone =
                    month.missing > 0
                      ? 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]'
                      : month.partial > 0
                        ? 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]'
                        : 'border-primary/30 bg-primary/10 text-primary';
                  return (
                    <div key={month.month} className={`rounded-lg border p-2 text-xs ${tone}`}>
                      <p className="font-mono">{month.month}</p>
                      <p className="mt-1 opacity-80">
                        {month.complete}C · {month.partial}P · {month.missing}M
                      </p>
                      <p className="opacity-70">
                        {month.reconciled}R · {month.mismatch}X
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Provider mappings</CardTitle>
            <CardDescription>
              Upstox keys live only here; the canonical UUID never changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mappings.length === 0 ? (
              <EmptyState title="No mappings" description="Run instrument sync." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>External key</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead>Valid from</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell>{mapping.providerCode}</TableCell>
                      <TableCell className="font-mono text-xs">{mapping.externalKey}</TableCell>
                      <TableCell>{mapping.isPrimary ? 'yes' : 'no'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(mapping.validFrom)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <CardDescription>
              Every chunk records request, HTTP, counts and duration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detail.runs.length === 0 ? (
              <EmptyState title="No runs" description="Queue a fetch from the catalog." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Rows</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>{run.runType}</TableCell>
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
            <CardTitle>Open issues</CardTitle>
            <CardDescription>
              Every partial or missing day has a rule, severity and decision.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detail.issues.length === 0 ? (
              <EmptyState title="No issues" description="The validation layer is clean." />
            ) : (
              <div className="space-y-2">
                {detail.issues.slice(0, 10).map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/data/issues/${issue.id}`}
                    className="border-border/70 bg-background/40 block rounded-lg border p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {issue.ruleId ?? issue.issueType} · {issue.issueType.replaceAll('_', ' ')}
                      </span>
                      <StatusBadge status={issue.severity} />
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {issue.tradingDate ?? 'no date'} · seen {issue.occurrenceCount}× ·{' '}
                      {issue.status}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>Corporate actions</CardTitle>
          <CardDescription>
            Confirmed actions carry adjustment factors; candles stay raw.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <EmptyState
              title="No corporate actions"
              description="Import a reviewed CSV from the data console."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Ex-date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price factor</TableHead>
                    <TableHead>Volume factor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell>{action.actionType}</TableCell>
                      <TableCell>{action.exDate}</TableCell>
                      <TableCell>
                        <StatusBadge status={action.status} />
                      </TableCell>
                      <TableCell>{action.priceAdjustmentFactor}</TableCell>
                      <TableCell>{action.volumeAdjustmentFactor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <details className="mt-4">
        <summary className="text-muted-foreground cursor-pointer text-xs">
          Raw status evidence
        </summary>
        <div className="mt-2">
          <JsonBlock value={detail} />
        </div>
      </details>
    </div>
  );
}
