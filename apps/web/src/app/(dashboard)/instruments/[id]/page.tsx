import { apiFetch } from '@/lib/api';
import type {
  CorporateAction,
  InstrumentCoverageDetail,
  InstrumentMapping,
  JobListResponse,
  Paginated,
  SystemIssue,
} from '@/lib/types';
import { PAGINATION_DEFAULT_LIMIT } from '@ai-trading/domain';
import { readOffset } from '@/lib/pagination';
import { formatDate, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { displayStatus, statusTone } from '@/lib/status';
import { backLinkFor } from '@/lib/navigation';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { DetailDialog } from '@/components/dashboard/detail-dialog';
import {
  TableActionButton,
  TableActions,
  TableRefreshButton,
} from '@/components/dashboard/table-actions';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InstrumentDetailActions } from '../instrument-actions';
import { InstrumentJobProgress } from '@/features/jobs/components/instrument-job-progress';
import { IssueList } from '@/features/issues/components/issue-list';
import { Pagination } from '@/components/dashboard/pagination';

export default async function InstrumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    from?: string | string[];
    actionsOffset?: string | string[];
    issuesOffset?: string | string[];
  }>;
}) {
  const { id } = await params;
  const queryParams = await searchParams;
  const fromParam = queryParams.from;
  const back = backLinkFor(fromParam, '/instruments');
  const actionsOffset = readOffset(queryParams.actionsOffset);
  const issuesOffset = readOffset(queryParams.issuesOffset);
  const [detail, mappings, actions, issues] = await Promise.all([
    apiFetch<InstrumentCoverageDetail>(`/instruments/${id}/coverage`),
    apiFetch<InstrumentMapping[]>(`/instruments/${id}/mappings`),
    apiFetch<Paginated<CorporateAction>>(
      `/instruments/${id}/corporate-actions?limit=${PAGINATION_DEFAULT_LIMIT}&offset=${actionsOffset}`,
    ),
    apiFetch<Paginated<SystemIssue>>(`/instruments/${id}/issues?limit=${PAGINATION_DEFAULT_LIMIT}&offset=${issuesOffset}`),
  ]);
  const jobs = await apiFetch<JobListResponse>(`/jobs?instrumentId=${id}&limit=1`);
  const latestJob = jobs.items[0] ?? null;
  const status = displayStatus(detail);

  return (
    <div>
      <PageMeta
        title={`${detail.symbol} · Instrument`}
        description="Coverage, download history, mappings and open issues for this instrument."
      />

      <DetailHeader
        back={back}
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
          <InstrumentDetailActions
            detail={detail}
            returnTo={`/instruments/${detail.instrumentId}`}
          />
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

      <InstrumentJobProgress
        initial={latestJob}
        returnTo={`/instruments/${detail.instrumentId}`}
      />

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
                      {month.missing} missing
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
          actions={<TableRefreshButton />}
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
                  <TableHead />
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
                    <TableActions>
                      <DetailDialog
                        title={`${label(mapping.providerCode)} mapping`}
                        description={mapping.externalKey}
                        trigger={<TableActionButton label="View mapping" />}
                      >
                        <KeyValueGrid
                          columns={2}
                          items={[
                            { label: 'Provider', value: label(mapping.providerCode) },
                            { label: 'Provider name', value: mapping.providerName },
                            {
                              label: 'External key',
                              value: (
                                <span className="break-all font-mono text-xs">
                                  {mapping.externalKey}
                                </span>
                              ),
                            },
                            { label: 'Exchange token', value: mapping.exchangeToken ?? '—' },
                            { label: 'Provider symbol', value: mapping.providerSymbol ?? '—' },
                            { label: 'Provider segment', value: mapping.providerSegment ?? '—' },
                            { label: 'Primary', value: mapping.isPrimary ? 'Yes' : 'No' },
                            { label: 'Valid from', value: formatDate(mapping.validFrom) },
                            {
                              label: 'Valid to',
                              value: mapping.validTo ? formatDate(mapping.validTo) : 'Open',
                            },
                          ]}
                        />
                      </DetailDialog>
                    </TableActions>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>

      <SectionCard
        className="mt-4"
        title="Active issues"
        description="One row per active problem; a successful re-fetch removes its row."
        footer={
          <Pagination
            page={issues.page}
            itemsCount={issues.items.length}
            pathname={`/instruments/${id}`}
            searchParams={queryParams}
            itemLabel="issues"
            names={{ offset: 'issuesOffset' }}
          />
        }
      >
        <IssueList
          issues={issues.items}
          from={back.href}
          currentInstrumentId={id}
          emptyTitle="No issues"
          emptyDescription="The validation layer is clean."
        />
      </SectionCard>

      <SectionCard
        className="mt-4"
        title="Corporate actions"
        description="Confirmed actions carry adjustment factors; candles stay raw."
        actions={<TableRefreshButton />}
        footer={
          <Pagination
            page={actions.page}
            itemsCount={actions.items.length}
            pathname={`/instruments/${id}`}
            searchParams={queryParams}
            itemLabel="corporate actions"
            names={{ offset: 'actionsOffset' }}
          />
        }
      >
        {actions.items.length === 0 ? (
          <EmptyState
            title="No corporate actions"
            description="Corporate actions are imported through the reference-data API and audited."
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
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.items.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell>{label(action.actionType)}</TableCell>
                    <TableCell>{action.exDate}</TableCell>
                    <TableCell>
                      <StatusBadge status={action.status} />
                    </TableCell>
                    <TableCell>{action.priceAdjustmentFactor}</TableCell>
                    <TableCell>{action.volumeAdjustmentFactor}</TableCell>
                    <TableActions>
                      <DetailDialog
                        title={`${label(action.actionType)} · ${action.exDate}`}
                        description={action.symbol}
                        trigger={<TableActionButton label="View corporate action" />}
                      >
                        <KeyValueGrid
                          columns={2}
                          items={[
                            { label: 'Type', value: label(action.actionType) },
                            { label: 'Ex-date', value: action.exDate },
                            { label: 'Status', value: label(action.status) },
                            { label: 'Ratio numerator', value: action.ratioNumerator ?? '—' },
                            { label: 'Ratio denominator', value: action.ratioDenominator ?? '—' },
                            {
                              label: 'Dividend per share',
                              value: action.dividendPerShare ?? '—',
                            },
                            { label: 'Price factor', value: action.priceAdjustmentFactor },
                            { label: 'Volume factor', value: action.volumeAdjustmentFactor },
                            { label: 'Source', value: label(action.source) },
                            { label: 'Notes', value: action.notes ?? '—' },
                          ]}
                        />
                      </DetailDialog>
                    </TableActions>
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
