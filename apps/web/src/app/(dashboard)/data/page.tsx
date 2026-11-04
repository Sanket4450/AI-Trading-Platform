import Link from 'next/link';
import { Database, Upload } from 'lucide-react';
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
import { label } from '@/lib/labels';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField, FormSelect } from '@/components/dashboard/form-field';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default async function DataPage() {
  const heatmapFrom = isoDaysAgo(120);
  const heatmapTo = new Date().toISOString().slice(0, 10);

  const [summary, heatmap, plans, ingestionRuns, qualityIssues, provider] = await Promise.all([
    apiFetch<CoverageSummary>('/data/coverage/summary'),
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

      <StatGrid columns={5}>
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
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Provider and budget"
        description="The token is never returned. Reference sync and corporate-action import require the admin role."
        actions={
          <>
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
          </>
        }
      >
        <KeyValueGrid
          columns={4}
          items={[
            { label: 'Network', value: provider.networkEnabled ? 'Enabled' : 'Disabled' },
            {
              label: 'Credentials',
              value: `API key ${provider.apiKeyConfigured ? 'set' : 'missing'} · token ${provider.tokenConfigured ? 'set' : 'missing'}`,
            },
            {
              label: 'Budget',
              value: provider.budget
                ? `${provider.budget.availableSecond}/s · ${provider.budget.availableMinute}/m · ${provider.budget.available30Minutes}/30m`
                : 'Unavailable',
            },
            {
              label: 'Last successful sync',
              value: provider.lastSuccessfulSyncAt
                ? formatDateTime(provider.lastSuccessfulSyncAt)
                : 'Never',
            },
            {
              label: 'Raw payloads',
              value: `${formatNumber(Number(provider.payloadCount))} · ${formatNumber(Number(provider.payloadBytes))} bytes`,
            },
            {
              label: 'Chunks',
              value: `${provider.runningChunks} running · ${provider.queuedChunks} queued · ${provider.failedRuns24h} failed in 24h`,
            },
            {
              label: 'Daily oracle',
              value: provider.dailyOracleEnabled ? 'Enabled' : 'Disabled',
            },
            {
              label: 'Last validation',
              value: provider.lastSuccessfulValidationAt
                ? formatDateTime(provider.lastSuccessfulValidationAt)
                : 'Never',
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        className="mt-4"
        title={`Coverage heatmap · last ${dates.length} sessions`}
        description="Green complete · amber partial + volume reconciled · red partial/missing + mismatch. Click a cell to open the day detail."
      >
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
                      <Link
                        href={`/instruments/${instrumentId}`}
                        className="hover:text-primary-strong"
                      >
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
                            title={`${entry.symbol} ${date}: ${label(cell.status)} / ${label(cell.validationStatus)}`}
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
      </SectionCard>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Backfill plans"
          description="One parent plan, one child job per instrument, one run per month."
        >
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
        </SectionCard>

        <SectionCard
          title="Quality issues"
          description="One real problem, one issue, with an auditable lifecycle."
        >
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
                    <div className="min-w-0">
                      <Link
                        href={`/data/issues/${issue.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {label(issue.issueType)}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {issue.ruleId ?? 'No rule'} · {issue.symbol ?? 'Provider-wide'} ·{' '}
                        {issue.tradingDate ?? 'No date'} · seen {issue.occurrenceCount}×
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <StatusBadge status={issue.severity} />
                      <StatusBadge status={issue.status} />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <details className="min-w-0 flex-1">
                      <summary className="text-muted-foreground cursor-pointer text-xs">
                        Evidence
                      </summary>
                      <div className="mt-2">
                        <JsonBlock value={issue.details} />
                      </div>
                    </details>
                    <FormDialog
                      trigger={
                        <Button type="button" size="sm" variant="outline">
                          Update
                        </Button>
                      }
                      title="Update issue lifecycle"
                      description="Acknowledgement records ownership. Resolving or ignoring requires a note and is audited."
                      submitLabel="Update issue"
                      action={acknowledgeIssueAction}
                    >
                      <input type="hidden" name="issueId" value={issue.id} />
                      <input type="hidden" name="returnTo" value="/data" />
                      <FormField label="Status" htmlFor={`status-${issue.id}`}>
                        <FormSelect
                          id={`status-${issue.id}`}
                          name="status"
                          defaultValue="acknowledged"
                          options={[
                            { value: 'acknowledged', label: 'Acknowledge' },
                            { value: 'resolved', label: 'Resolve' },
                            { value: 'ignored', label: 'Ignore' },
                          ]}
                        />
                      </FormField>
                      <FormField
                        label="Note"
                        htmlFor={`note-${issue.id}`}
                        hint="Required to resolve or ignore."
                      >
                        <Input id={`note-${issue.id}`} name="note" placeholder="What changed?" />
                      </FormField>
                    </FormDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Ingestion runs"
          description="Every provider fetch, including skipped and failed runs."
        >
          {ingestionRuns.length === 0 ? (
            <EmptyState title="No ingestion runs" description="Trigger a backfill to create one." />
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
                      <TableCell>{label(run.runType)}</TableCell>
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
        </SectionCard>

        <SectionCard
          title="Corporate actions import"
          description="Reviewed CSV only. Dry run first; confirmed factors are used by read-time adjustment."
          actions={
            <FormDialog
              trigger={
                <Button type="button" size="sm" variant="outline">
                  <Upload className="size-4" />
                  Import CSV
                </Button>
              }
              title="Import corporate actions"
              description="Validated before any row is written. Confirmed factors are used by read-time adjustment."
              submitLabel="Validate"
              action={importCorporateActionsAction}
              className="sm:max-w-2xl"
            >
              <FormField label="CSV" htmlFor="csv">
                <Textarea
                  id="csv"
                  name="csv"
                  rows={6}
                  placeholder="isin,symbol,ex_date,action_type,ratio_numerator,ratio_denominator,dividend_per_share,price_factor,volume_factor,source,notes,status"
                  className="font-mono text-xs leading-5"
                />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Source" htmlFor="source">
                  <Input id="source" name="source" defaultValue="reviewed-csv" />
                </FormField>
                <FormField label="Mode" htmlFor="dryRun">
                  <FormSelect
                    id="dryRun"
                    name="dryRun"
                    defaultValue="true"
                    options={[
                      { value: 'true', label: 'Dry run' },
                      { value: 'false', label: 'Import' },
                    ]}
                  />
                </FormField>
              </div>
            </FormDialog>
          }
        >
          <p className="text-muted-foreground text-sm">
            Import a reviewed CSV to record split, bonus and dividend factors. The dry run reports
            what would change before any row is written.
          </p>
        </SectionCard>
      </div>

      <SectionCard
        className="mt-4"
        title="Bounded single-instrument repair"
        description="Legacy 31-day repair endpoint. The instrument catalog is the normal entry point."
        actions={
          <FormDialog
            trigger={
              <Button type="button" size="sm" variant="outline">
                <Database className="size-4" />
                Queue repair
              </Button>
            }
            title="Queue a single-instrument repair"
            description="Bounded to the provider's documented window and the configured daily limit."
            submitLabel="Queue repair"
            action={backfillAction}
          >
            <FormField label="Instrument ID" htmlFor="repair-instrumentId">
              <Input id="repair-instrumentId" name="instrumentId" placeholder="UUID" required />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="From" htmlFor="repair-from">
                <Input id="repair-from" name="from" type="date" min="2022-01-01" required />
              </FormField>
              <FormField label="To" htmlFor="repair-to">
                <Input id="repair-to" name="to" type="date" min="2022-01-01" required />
              </FormField>
            </div>
          </FormDialog>
        }
      >
        <p className="text-muted-foreground text-sm">
          Use the instrument catalog for normal repairs. This bounded endpoint exists for a single
          instrument and a short window.
        </p>
      </SectionCard>
    </div>
  );
}
