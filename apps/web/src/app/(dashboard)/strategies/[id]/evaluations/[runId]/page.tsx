import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
import { apiFetch, getSession } from '@/lib/api';
import type {
  EvaluationResult,
  EvaluationRunDetail,
  Paginated,
  ResearchSignal,
} from '@/lib/types';
import { formatClock, formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { readLimit, readOffset } from '@/lib/pagination';
import { backLinkFor, detailHref } from '@/lib/navigation';
import { PageMeta } from '@/components/shell/page-meta';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { TableFilters, FilterSelect, DateFilter, DateRangeFilter } from '@/components/dashboard/table-filters';
import { TableActions, TableActionButton, TableRefreshButton } from '@/components/dashboard/table-actions';
import { DetailDialog } from '@/components/dashboard/detail-dialog';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { JsonBlock } from '@/components/dashboard/json-block';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Pagination } from '@/components/dashboard/pagination';
import { PageSizeSelect } from '@/components/dashboard/page-size-select';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CancelEvaluationDialog } from './cancel-evaluation-dialog';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function evidenceMetrics(signal: ResearchSignal) {
  const evidence = record(signal.evidence) ?? {};
  const openingRange = record(evidence.openingRange);
  const decisionBar = record(evidence.decisionBar);
  const market = record(evidence.market);
  const volume = record(evidence.volume);
  const pricing = record(evidence.pricing);
  const sizing = record(evidence.sizing);
  const exitPlan = record(evidence.exitPlan);

  return [
    {
      label: 'Opening range',
      value: openingRange
        ? `${formatNumber(openingRange.low as number)} – ${formatNumber(openingRange.high as number)}`
        : '—',
    },
    { label: 'VWAP', value: evidence.vwap == null ? '—' : formatNumber(evidence.vwap as number) },
    {
      label: 'NIFTY close',
      value: market?.close == null ? '—' : formatNumber(market.close as number),
    },
    {
      label: 'EMA 20 / 50',
      value:
        market?.emaFast == null || market?.emaSlow == null
          ? '—'
          : `${formatNumber(market.emaFast as number)} / ${formatNumber(market.emaSlow as number)}`,
    },
    {
      label: 'Volume ratio',
      value: volume?.ratio == null ? '—' : formatNumber(volume.ratio as number),
    },
    {
      label: 'Risk per share',
      value: pricing?.riskPerShare == null ? '—' : formatNumber(pricing.riskPerShare as number),
    },
    {
      label: 'Decision bar',
      value: decisionBar?.start ? formatDateTime(decisionBar.start as string) : '—',
    },
    {
      label: 'Target R',
      value: exitPlan?.targetRMultiple == null ? '—' : formatNumber(exitPlan.targetRMultiple as number),
    },
    {
      label: 'By risk / cash',
      value:
        sizing?.byRisk == null || sizing?.byCash == null
          ? '—'
          : `${formatNumber(sizing.byRisk as number)} / ${formatNumber(sizing.byCash as number)}`,
    },
  ];
}

export default async function EvaluationRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; runId: string }>;
  searchParams: Promise<{
    from?: string | string[];
    signalType?: string;
    signalFrom?: string;
    signalTo?: string;
    resultStatus?: string;
    resultReason?: string;
    resultDate?: string;
    signalOffset?: string | string[];
    resultOffset?: string | string[];
    limit?: string | string[];
  }>;
}) {
  const { id, runId } = await params;
  const query = await searchParams;
  const back = backLinkFor(query.from, `/strategies/${id}/evaluations`);
  const limit = readLimit(query.limit);
  const signalOffset = readOffset(query.signalOffset);
  const resultOffset = readOffset(query.resultOffset);

  const signalQuery = new URLSearchParams({
    limit: String(limit),
    offset: String(signalOffset),
  });
  if (query.signalType) signalQuery.set('signalType', query.signalType);
  if (query.signalFrom) signalQuery.set('from', query.signalFrom);
  if (query.signalTo) signalQuery.set('to', query.signalTo);

  const resultQuery = new URLSearchParams({
    limit: String(limit),
    offset: String(resultOffset),
  });
  if (query.resultStatus) resultQuery.set('status', query.resultStatus);
  if (query.resultReason) resultQuery.set('reasonCode', query.resultReason);
  if (query.resultDate) resultQuery.set('date', query.resultDate);

  const base = `/strategies/${id}/evaluation-runs/${runId}`;
  const [run, signals, results, session] = await Promise.all([
    apiFetch<EvaluationRunDetail>(base),
    apiFetch<Paginated<ResearchSignal>>(`${base}/signals?${signalQuery.toString()}`),
    apiFetch<Paginated<EvaluationResult>>(`${base}/results?${resultQuery.toString()}`),
    getSession(),
  ]);

  if (!run) notFound();
  const isAdmin = session.user.role === 'admin';
  const isActive = run.status === 'queued' || run.status === 'running';
  const returnUrl = detailHref(`/strategies/${id}/evaluations/${runId}`, query.from ? String(query.from) : back.href);
  const errorMessage =
    typeof run.error?.message === 'string' ? run.error.message : 'The run failed';
  const errorDay = typeof run.error?.day === 'string' ? run.error.day : null;

  return (
    <div>
      <PageMeta
        title={`${run.strategyCode} v${run.version} · Evaluation`}
        description="Pinned inputs, research signals and the instrument-day explainability ledger."
      />
      <DetailHeader
        back={back}
        badges={
          <>
            <Badge variant="outline">
              {run.strategyCode} v{run.version}
            </Badge>
            <StatusBadge status={run.status} />
          </>
        }
        meta={`${run.fromDate} → ${run.toDate}`}
        links={
          run.jobRunId
            ? [{ href: `/jobs/${run.jobRunId}`, label: 'Open job ledger for the stage rail' }]
            : []
        }
        actions={
          <>
            {isAdmin && isActive ? (
              <CancelEvaluationDialog strategyId={id} run={run} returnUrl={returnUrl} />
            ) : null}
            <TableRefreshButton label="Refresh run" />
          </>
        }
      />

      <div className="border-info/30 bg-info/10 text-info mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
        <FlaskConical className="mt-0.5 size-4 shrink-0" />
        <p>
          Research evaluation on stored candles. No order was sent. Prices are research signals,
          not fills; costs, slippage and the equity curve arrive in R4.
        </p>
      </div>

      <StatGrid columns={4}>
        <StatCard
          label="Instrument-days"
          value={formatNumber(run.summary.instrumentDays)}
          hint="Evaluated rows in the ledger"
          tone="info"
        />
        <StatCard
          label="Instruments with signals"
          value={formatNumber(run.summary.instrumentsWithSignals)}
          hint="At least one entry or exit"
          tone="success"
        />
        <StatCard
          label="Entries"
          value={formatNumber(run.summary.entries)}
          hint="Research entries"
          tone="highlight"
        />
        <StatCard
          label="Exits"
          value={formatNumber(run.summary.exits)}
          hint="Stop, target or EOD"
          tone="warning"
        />
        <StatCard
          label="Skipped days"
          value={formatNumber(run.summary.skippedDays)}
          hint="Data-quality preflight"
          tone="danger"
        />
        <StatCard
          label="No-signal days"
          value={formatNumber(run.summary.noSignalDays)}
          hint="Evaluated without an entry"
        />
        <StatCard
          label="Capital"
          value={formatMoney(run.initialCapital)}
          hint="Fixed for the run"
        />
        <StatCard
          label="Pinned configs"
          value={`v${run.parameterVersion}${run.riskVersion ? ` / v${run.riskVersion}` : ''}`}
          hint="Parameter / risk configuration versions"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Pinned inputs"
        description="Every input that could change later is frozen on the run."
      >
        <KeyValueGrid
          columns={3}
          items={[
            { label: 'Strategy', value: `${run.strategyCode} · v${run.version}` },
            { label: 'Code ref', value: run.codeRef },
            { label: 'Runtime', value: <StatusBadge status={run.runtime.status} /> },
            { label: 'Parameter config', value: `v${run.parameterVersion}` },
            {
              label: 'Risk config',
              value: run.riskVersion ? `v${run.riskVersion}` : 'Missing',
            },
            {
              label: 'Parameter hash',
              value: <span className="break-all font-mono text-xs">{run.parameterHash}</span>,
            },
            { label: 'Created', value: formatDateTime(run.createdAt) },
            { label: 'Started', value: formatDateTime(run.startedAt) },
            { label: 'Finished', value: formatDateTime(run.finishedAt) },
          ]}
        />
        {run.note ? <p className="text-muted-foreground mt-3 text-sm">{run.note}</p> : null}
        {run.error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive mt-3 rounded-lg border p-2 text-xs">
            {errorMessage}
            {errorDay ? ` · ${errorDay}` : ''}
          </div>
        ) : null}
      </SectionCard>

      <TableCard
        className="mt-4"
        summary={
          <TableSummary
            items={[
              { label: 'Signals', value: formatNumber(signals.page.total), hint: 'This run' },
              {
                label: 'Showing',
                value: formatNumber(signals.items.length),
                hint: 'This page',
                tone: 'info',
              },
            ]}
          />
        }
        filters={
          <TableFilters>
            <FilterSelect
              id="signalType"
              name="signalType"
              defaultValue={query.signalType ?? ''}
              options={[
                { value: '', label: 'Any type' },
                { value: 'entry', label: 'Entry' },
                { value: 'stop', label: 'Stop' },
                { value: 'target', label: 'Target' },
                { value: 'eod', label: 'EOD' },
              ]}
            />
            <DateRangeFilter
              fromName="signalFrom"
              toName="signalTo"
              defaultFrom={query.signalFrom}
              defaultTo={query.signalTo}
            />
          </TableFilters>
        }
        actions={<TableRefreshButton label="Refresh signals" />}
        footer={
          <Pagination
            pageSizeControl={
              <PageSizeSelect
                value={limit}
                resetKeys={['signalOffset', 'resultOffset']}
              />
            }
            page={signals.page}
            itemsCount={signals.items.length}
            pathname={`/strategies/${id}/evaluations/${runId}`}
            searchParams={query}
            itemLabel="signals"
            names={{ offset: 'signalOffset' }}
          />
        }
      >
        {signals.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No signals for this filter"
              description="The instrument-day ledger below explains every day that produced no entry."
            />
          </div>
        ) : (
          <Table containerClassName="overflow-auto">
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Instrument</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Stop</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals.items.map((signal) => (
                <TableRow key={signal.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDate(signal.signalAt)} {formatClock(signal.signalAt)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{signal.symbol}</p>
                    <p className="text-muted-foreground text-xs">{signal.name}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{label(signal.signalType)}</Badge>
                  </TableCell>
                  <TableCell>{formatNumber(signal.referencePrice)}</TableCell>
                  <TableCell>{formatNumber(signal.entryPrice)}</TableCell>
                  <TableCell>{formatNumber(signal.stopPrice)}</TableCell>
                  <TableCell>{formatNumber(signal.targetPrice)}</TableCell>
                  <TableCell>{formatNumber(signal.quantity)}</TableCell>
                  <TableCell>
                    <StatusBadge status={signal.status} />
                  </TableCell>
                  <TableActions>
                    <DetailDialog
                      title={`${signal.symbol} · ${label(signal.signalType)}`}
                      description={`${formatDateTime(signal.signalAt)} · research signal, not a fill`}
                      trigger={<TableActionButton label="View evidence" />}
                      className="sm:max-w-2xl"
                    >
                      <KeyValueGrid columns={2} items={evidenceMetrics(signal)} />
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Raw evidence</h4>
                        <JsonBlock value={signal.evidence ?? {}} />
                      </div>
                    </DetailDialog>
                  </TableActions>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <TableCard
        className="mt-4"
        summary={
          <TableSummary
            items={[
              {
                label: 'Instrument-days',
                value: formatNumber(results.page.total),
                hint: 'The why-no-trade ledger',
              },
              {
                label: 'Showing',
                value: formatNumber(results.items.length),
                hint: 'This page',
                tone: 'info',
              },
            ]}
          />
        }
        filters={
          <TableFilters>
            <FilterSelect
              id="resultStatus"
              name="resultStatus"
              defaultValue={query.resultStatus ?? ''}
              options={[
                { value: '', label: 'Any status' },
                { value: 'signal', label: 'Signal' },
                { value: 'no_signal', label: 'No signal' },
                { value: 'skipped', label: 'Skipped' },
              ]}
            />
            <FilterSelect
              id="resultReason"
              name="resultReason"
              defaultValue={query.resultReason ?? ''}
              options={[
                { value: '', label: 'Any reason' },
                { value: 'no_breakout', label: 'No breakout' },
                { value: 'below_vwap', label: 'Below VWAP' },
                { value: 'market_filter', label: 'Market filter' },
                { value: 'volume_filter', label: 'Volume filter' },
                { value: 'position_open', label: 'Position open' },
                { value: 'daily_limit', label: 'Daily limit' },
                { value: 'unsizeable', label: 'Unsizeable' },
                { value: 'warmup', label: 'Warm-up' },
                { value: 'coverage_partial', label: 'Coverage partial' },
                { value: 'coverage_missing', label: 'Coverage missing' },
                { value: 'index_insufficient_coverage', label: 'Index coverage' },
                { value: 'opening_range_incomplete', label: 'Opening range' },
                { value: 'exit_window_incomplete', label: 'Exit window incomplete' },
                { value: 'special_session', label: 'Special session' },
              ]}
            />
            <DateFilter name="resultDate" defaultValue={query.resultDate} />
          </TableFilters>
        }
        actions={<TableRefreshButton label="Refresh results" />}
        footer={
          <Pagination
            page={results.page}
            itemsCount={results.items.length}
            pathname={`/strategies/${id}/evaluations/${runId}`}
            searchParams={query}
            itemLabel="instrument-days"
            names={{ offset: 'resultOffset' }}
            showPageSize={false}
          />
        }
      >
        {results.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No instrument-day results"
              description="Results appear as the worker completes each trading day."
            />
          </div>
        ) : (
          <Table containerClassName="overflow-auto">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Instrument</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Signals</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.items.map((result) => (
                <TableRow key={result.id}>
                  <TableCell className="whitespace-nowrap text-xs">{result.tradingDate}</TableCell>
                  <TableCell>
                    <p className="font-medium">{result.symbol}</p>
                    <p className="text-muted-foreground text-xs">{result.name}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={result.status} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {result.reasonCode ? label(result.reasonCode) : '—'}
                  </TableCell>
                  <TableCell>{formatNumber(result.signalCount)}</TableCell>
                  <TableActions>
                    <DetailDialog
                      title={`${result.symbol} · ${result.tradingDate}`}
                      description={`${label(result.status)} · ${result.reasonCode ? label(result.reasonCode) : 'Trade produced'}`}
                      trigger={<TableActionButton label="View diagnostics" />}
                      className="sm:max-w-2xl"
                    >
                      <KeyValueGrid
                        columns={2}
                        items={[
                          { label: 'Status', value: label(result.status) },
                          {
                            label: 'Primary reason',
                            value: result.reasonCode ? label(result.reasonCode) : 'Trade produced',
                          },
                          { label: 'Signals', value: formatNumber(result.signalCount) },
                          { label: 'Trading date', value: result.tradingDate },
                        ]}
                      />
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Diagnostics</h4>
                        <JsonBlock value={result.diagnostics} />
                      </div>
                    </DetailDialog>
                  </TableActions>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <div className="mt-4 flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={detailHref(`/strategies/${id}/evaluations`, back.href)}>
            Back to evaluations
          </Link>
        </Button>
      </div>
    </div>
  );
}
