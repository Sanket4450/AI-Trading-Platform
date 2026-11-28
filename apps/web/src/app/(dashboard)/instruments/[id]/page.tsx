import { apiFetch } from '@/lib/api';
import type {
  CorporateAction,
  ExternalApiCallPage,
  InstrumentCoverageDetail,
  InstrumentMapping,
  JobListResponse,
  Paginated,
  SystemIssue,
} from '@/lib/types';
import { INSTRUMENT_ISSUE_PAGE_LIMIT, PAGINATION_DEFAULT_LIMIT } from '@ai-trading/domain';
import { readCursorValue, readLimit, readOffset } from '@/lib/pagination';
import { formatDate, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { displayStatus, statusTone } from '@/lib/status';
import { backLinkFor } from '@/lib/navigation';
import { PageMeta } from '@/components/shell/page-meta';
import { LiveJobRefresh } from '@/components/dashboard/live-job-refresh';
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
import { MultiSelectFilter, TableFilters } from '@/components/dashboard/table-filters';
import { PageSizeSelect } from '@/components/dashboard/page-size-select';
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
import { ApiCallsSection } from '@/features/jobs/components/api-calls';
import { API_OUTCOME_OPTIONS, API_SERVICE_OPTIONS } from '@/features/jobs/api-call-labels';
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
    issuesAfter?: string | string[];
    issuesBefore?: string | string[];
    service?: string | string[];
    outcome?: string | string[];
    limit?: string | string[];
    callsAfter?: string | string[];
    callsBefore?: string | string[];
  }>;
}) {
  const { id } = await params;
  const queryParams = await searchParams;
  const fromParam = queryParams.from;
  const back = backLinkFor(fromParam, '/instruments');
  const actionsOffset = readOffset(queryParams.actionsOffset);

  const services = queryParams.service
    ? Array.isArray(queryParams.service)
      ? queryParams.service
      : [queryParams.service]
    : [];
  const outcomes = queryParams.outcome
    ? Array.isArray(queryParams.outcome)
      ? queryParams.outcome
      : [queryParams.outcome]
    : [];
  const callsLimit = readLimit(queryParams.limit);
  const callsAfter = readCursorValue(queryParams.callsAfter);
  const callsBefore = readCursorValue(queryParams.callsBefore);

  const issuesQuery = new URLSearchParams({ limit: String(INSTRUMENT_ISSUE_PAGE_LIMIT) });
  const issuesAfter = readCursorValue(queryParams.issuesAfter);
  const issuesBefore = readCursorValue(queryParams.issuesBefore);
  if (issuesAfter) issuesQuery.set('after', issuesAfter);
  if (issuesBefore) issuesQuery.set('before', issuesBefore);

  const callsQuery = new URLSearchParams({ instrumentId: id, limit: String(callsLimit) });
  for (const service of services) callsQuery.append('service', service);
  for (const outcome of outcomes) callsQuery.append('outcome', outcome);
  if (callsAfter) callsQuery.set('after', callsAfter);
  if (callsBefore) callsQuery.set('before', callsBefore);
  const callsQueryString = callsQuery.toString();

  const [detail, mappings, actions, issues, calls] = await Promise.all([
    apiFetch<InstrumentCoverageDetail>(`/instruments/${id}/coverage`),
    apiFetch<InstrumentMapping[]>(`/instruments/${id}/mappings`),
    apiFetch<Paginated<CorporateAction>>(
      `/instruments/${id}/corporate-actions?limit=${PAGINATION_DEFAULT_LIMIT}&offset=${actionsOffset}`,
    ),
    apiFetch<Paginated<SystemIssue>>(`/instruments/${id}/issues?${issuesQuery.toString()}`),
    apiFetch<ExternalApiCallPage>(`/api-calls?${callsQueryString}`),
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
      <LiveJobRefresh instrumentId={detail.instrumentId} />

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

      <InstrumentJobProgress initial={latestJob} returnTo={`/instruments/${detail.instrumentId}`} />

      {/*
        The right column is absolutely positioned on xl so the month grid alone sets the row
        height; mappings keep a 320px band and active issues absorb whatever remains.
      */}
      <div className="mt-4 grid gap-4 xl:min-h-[480px] xl:grid-cols-[1.2fr_1fr]">
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
                    <p className="opacity-70">{month.missing} missing</p>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <div className="relative min-h-0">
          <div className="flex flex-col gap-4 xl:absolute xl:inset-0">
            <SectionCard
              className="max-h-[320px] shrink-0"
              title="Provider mappings"
              description="Upstox keys live only here; the canonical UUID never changes."
              actions={<TableRefreshButton />}
              contentClassName="min-h-0 overflow-auto"
            >
              {mappings.length === 0 ? (
                <EmptyState title="No mappings" description="Run instrument sync." />
              ) : (
                <Table>
                  <TableHeader className="bg-card sticky top-0 z-10">
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
                                {
                                  label: 'Provider segment',
                                  value: mapping.providerSegment ?? '—',
                                },
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

            <SectionCard
              className="min-h-0 flex-1"
              title="Active issues"
              description="One row per active problem; a successful re-fetch removes its row."
              actions={<TableRefreshButton label="Refresh issues" />}
              contentClassName="min-h-0 flex-1 overflow-auto"
              footer={
                <Pagination
                  page={issues.page}
                  itemsCount={issues.items.length}
                  pathname={`/instruments/${id}`}
                  searchParams={queryParams}
                  itemLabel="issues"
                  names={{ after: 'issuesAfter', before: 'issuesBefore' }}
                  showPageSize={false}
                />
              }
            >
              <IssueList
                issues={issues.items}
                from={back.href}
                currentInstrumentId={id}
                emptyTitle="No issues"
                emptyDescription="The validation layer is clean."
                className="sm:grid-cols-1"
              />
            </SectionCard>
          </div>
        </div>
      </div>

      <SectionCard
        className="mt-4"
        title="External API calls"
        description="Every outbound request this instrument made, with its exact failure and request URL."
        toolbar={
          <TableFilters>
            {typeof queryParams.from === 'string' ? (
              <input type="hidden" name="from" value={queryParams.from} readOnly />
            ) : null}
            <MultiSelectFilter
              id="service"
              name="service"
              defaultValue={services}
              options={API_SERVICE_OPTIONS}
              placeholder="All services"
            />
            <MultiSelectFilter
              id="outcome"
              name="outcome"
              defaultValue={outcomes}
              options={API_OUTCOME_OPTIONS}
              placeholder="All outcomes"
            />
          </TableFilters>
        }
        actions={<TableRefreshButton />}
        footer={
          <Pagination
            pageSizeControl={
              <PageSizeSelect value={callsLimit} resetKeys={['callsAfter', 'callsBefore']} />
            }
            page={calls.page}
            itemsCount={calls.items.length}
            pathname={`/instruments/${id}`}
            searchParams={queryParams}
            itemLabel="calls"
            names={{ after: 'callsAfter', before: 'callsBefore' }}
          />
        }
      >
        <ApiCallsSection instrumentId={id} initial={calls} query={callsQueryString} />
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
