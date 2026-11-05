import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { CorporateAction, InstrumentMapping, InstrumentStatusDetail } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { displayStatus, statusTone } from '@/lib/status';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import { SubmitButton } from '@/components/dashboard/submit-button';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, mappings, actions] = await Promise.all([
    apiFetch<InstrumentStatusDetail>(`/data/instrument-status/${id}`),
    apiFetch<InstrumentMapping[]>(`/instruments/${id}/mappings`),
    apiFetch<CorporateAction[]>(`/instruments/${id}/corporate-actions`),
  ]);
  const status = displayStatus(detail);

  return (
    <div>
      <PageMeta title={`${detail.symbol} · instrument detail`} />

      <DetailHeader
        badges={
          <>
            <Badge variant="outline" className={statusTone(status)}>
              {status}
            </Badge>
            <Badge variant="outline">
              {label(detail.fetchStatus, 'Not requested')} · {label(detail.dataStatus, 'Pending')}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {label(detail.segment)} · tick {formatNumber(detail.tickSize)}
            </Badge>
          </>
        }
        meta={`Target ${detail.targetFrom ?? '—'} → ${detail.targetTo ?? '—'}`}
        actions={
          <>
            <Link
              href="/instruments"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Back to catalog
            </Link>
            <form action={recomputeStatusAction}>
              <input type="hidden" name="instrumentId" value={detail.instrumentId} />
              <input type="hidden" name="returnTo" value={`/instruments/${detail.instrumentId}`} />
              <SubmitButton size="sm" variant="outline" pendingLabel="Recomputing…">
                Recompute
              </SubmitButton>
            </form>
            {detail.fetchStatus === 'failed' || detail.fetchStatus === 'partial' ? (
              <form action={retryInstrumentAction}>
                <input type="hidden" name="instrumentId" value={detail.instrumentId} />
                <input
                  type="hidden"
                  name="returnTo"
                  value={`/instruments/${detail.instrumentId}`}
                />
                <SubmitButton size="sm" variant="outline" pendingLabel="Retrying…">
                  Retry failed months
                </SubmitButton>
              </form>
            ) : null}
            {detail.fetchStatus === 'queued' || detail.fetchStatus === 'fetching' ? (
              <form action={cancelInstrumentAction}>
                <input type="hidden" name="instrumentId" value={detail.instrumentId} />
                <input
                  type="hidden"
                  name="returnTo"
                  value={`/instruments/${detail.instrumentId}`}
                />
                <SubmitButton size="sm" variant="outline" pendingLabel="Cancelling…">
                  Cancel
                </SubmitButton>
              </form>
            ) : (
              <form action={fetchInstrumentsAction}>
                <input type="hidden" name="instrumentIds" value={detail.instrumentId} />
                <input type="hidden" name="mode" value="missing_only" />
                <input
                  type="hidden"
                  name="returnTo"
                  value={`/instruments/${detail.instrumentId}`}
                />
                <SubmitButton size="sm" pendingLabel="Refreshing…">
                  Refresh missing months
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      <StatGrid>
        <StatCard
          label="Expected days"
          value={formatNumber(detail.expectedDays ?? 0)}
          hint="Scheduled instrument-days"
          tone="info"
        />
        <StatCard
          label="Complete days"
          value={formatNumber(detail.completeDays ?? 0)}
          hint="Strict zero-gap"
          tone="success"
        />
        <StatCard
          label="Partial days"
          value={formatNumber(detail.partialDays ?? 0)}
          hint="Some minutes missing"
          tone="warning"
        />
        <StatCard
          label="Open critical"
          value={formatNumber(detail.openCriticalIssues ?? 0)}
          hint="Blocks preflight"
          tone="danger"
        />
      </StatGrid>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard
          title="Month grid"
          description="Repair is month-granular because the provider returns a whole month per request."
        >
          {detail.months.length === 0 ? (
            <EmptyState
              title="No coverage yet"
              description="Fetch the target window to create coverage rows."
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
              {detail.months.map((month) => {
                const tone =
                  month.missing > 0
                    ? 'border-destructive/30 bg-destructive/10 text-destructive'
                    : month.partial > 0
                      ? 'border-warning/30 bg-warning/10 text-warning-strong'
                      : 'border-success/30 bg-success/10 text-success';
                return (
                  <div key={month.month} className={`rounded-lg border p-2 text-xs ${tone}`}>
                    <p className="font-mono">{month.month}</p>
                    <p className="mt-1 opacity-80">
                      {month.complete} complete · {month.partial} partial
                    </p>
                    <p className="opacity-70">
                      {month.missing} missing · {month.reconciled} reconciled · {month.mismatch}{' '}
                      mismatch
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Provider mappings"
          description="Upstox keys live only here; the canonical UUID never changes."
        >
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
                    <TableCell>{label(mapping.providerCode)}</TableCell>
                    <TableCell className="font-mono text-xs">{mapping.externalKey}</TableCell>
                    <TableCell>{mapping.isPrimary ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(mapping.validFrom)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Recent runs"
          description="Every chunk records its request, HTTP status, counts and duration."
        >
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
                      <TableCell>{label(run.runType)}</TableCell>
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
        </SectionCard>

        <SectionCard
          title="Open issues"
          description="Every partial or missing day has a rule, severity and decision."
        >
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
                    <span className="font-medium">{label(issue.issueType)}</span>
                    <StatusBadge status={issue.severity} />
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {issue.ruleId ?? 'No rule'} · {issue.tradingDate ?? 'No date'} · seen{' '}
                    {issue.occurrenceCount}×
                  </p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        className="mt-4"
        title="Corporate actions"
        description="Confirmed actions carry adjustment factors; candles stay raw."
      >
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
                    <TableCell>{label(action.actionType)}</TableCell>
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
      </SectionCard>

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
