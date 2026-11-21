import { apiFetch } from '@/lib/api';
import type { SystemIssue } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { detailHref, originHref } from '@/lib/navigation';
import { issueWindow } from '@/features/issues/issue-format';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { EmptyState } from '@/components/dashboard/empty-state';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { FilterSelect, TableFilters } from '@/components/dashboard/table-filters';
import { TableActionLink, TableActions, TableRefreshButton } from '@/components/dashboard/table-actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SEVERITY_OPTIONS = [
  { value: '', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
] as const;

const SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'ingestion', label: 'Ingestion' },
  { value: 'validation', label: 'Validation' },
  { value: 'reconciliation', label: 'Reconciliation' },
  { value: 'manual', label: 'Manual' },
] as const;

const SCOPE_OPTIONS = [
  { value: '', label: 'All scopes' },
  { value: 'instrument', label: 'Instrument' },
  { value: 'provider', label: 'Provider' },
  { value: 'system', label: 'System' },
] as const;

const KIND_OPTIONS = [
  { value: '', label: 'All kinds' },
  { value: 'candle_fetch_failed', label: 'Candle fetch failed' },
  { value: 'missing_bar', label: 'Missing bar' },
  { value: 'gap', label: 'Gap' },
  { value: 'coverage_shortfall', label: 'Coverage shortfall' },
  { value: 'partial_bar', label: 'Partial bar' },
  { value: 'calendar_mismatch', label: 'Calendar mismatch' },
  { value: 'invalid_ohlc', label: 'Invalid OHLC' },
  { value: 'schema_invalid', label: 'Schema invalid' },
  { value: 'duplicate_bar', label: 'Duplicate bar' },
  { value: 'tick_size_mismatch', label: 'Tick size mismatch' },
  { value: 'provider_revision', label: 'Provider revision' },
  { value: 'mapping_missing', label: 'Mapping missing' },
  { value: 'instrument_missing', label: 'Instrument missing' },
  { value: 'unsupported_instrument', label: 'Unsupported instrument' },
  { value: 'corporate_action_mismatch', label: 'Corporate action mismatch' },
  { value: 'stale_ingestion', label: 'Stale ingestion' },
  { value: 'stale_job', label: 'Stale job' },
  { value: 'stale_coverage', label: 'Stale coverage' },
  { value: 'duplicate_mapping', label: 'Duplicate mapping' },
] as const;

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{
    severity?: string;
    source?: string;
    kind?: string;
    scope?: string;
  }>;
}) {
  const params = await searchParams;
  const from = originHref('/issues', params);
  const query = new URLSearchParams();
  if (params.severity) query.set('severity', params.severity);
  if (params.source) query.set('source', params.source);
  if (params.kind) query.set('kind', params.kind);
  if (params.scope) query.set('scope', params.scope);
  query.set('limit', '100');

  const issues = await apiFetch<SystemIssue[]>(`/issues?${query.toString()}`);
  const critical = issues.filter((issue) => issue.severity === 'critical').length;
  const instrumentScoped = issues.filter((issue) => issue.scope === 'instrument').length;
  const providerScoped = issues.filter((issue) => issue.scope === 'provider').length;
  const hasFilters = Boolean(params.severity || params.source || params.kind || params.scope);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TableCard
        summary={
          <TableSummary
            items={[
              {
                label: 'Shown',
                value: formatNumber(issues.length),
                hint: 'Active rows in this view',
                tone: 'info',
              },
              {
                label: 'Critical',
                value: formatNumber(critical),
                hint: 'Blocks preflight',
                tone: critical > 0 ? 'danger' : 'success',
              },
              {
                label: 'Instrument',
                value: formatNumber(instrumentScoped),
                hint: 'Single-instrument scope',
                tone: 'warning',
              },
              {
                label: 'Provider',
                value: formatNumber(providerScoped),
                hint: 'Provider-wide scope',
                tone: 'highlight',
              },
            ]}
          />
        }
        filters={
          <TableFilters>
            <FilterSelect
              id="filter-severity"
              name="severity"
              defaultValue={params.severity ?? ''}
              submitOnChange
              options={SEVERITY_OPTIONS}
            />
            <FilterSelect
              id="filter-source"
              name="source"
              defaultValue={params.source ?? ''}
              submitOnChange
              options={SOURCE_OPTIONS}
            />
            <FilterSelect
              id="filter-kind"
              name="kind"
              defaultValue={params.kind ?? ''}
              submitOnChange
              options={KIND_OPTIONS}
            />
            <FilterSelect
              id="filter-scope"
              name="scope"
              defaultValue={params.scope ?? ''}
              submitOnChange
              options={SCOPE_OPTIONS}
            />
          </TableFilters>
        }
        actions={<TableRefreshButton />}
      >
        {issues.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No issues match"
              description={
                hasFilters
                  ? 'Clear the filters to see every active issue.'
                  : 'No active problem is recorded. A successful re-run removes its row.'
              }
            />
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Seen</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>
                      <StatusBadge status={issue.severity} />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{label(issue.kind)}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {label(issue.source)}
                    </TableCell>
                    <TableCell>
                      {issue.symbol ?? issue.providerCode ?? label(issue.scope)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {issueWindow(issue.payload) ?? '—'}
                    </TableCell>
                    <TableCell>{formatNumber(issue.occurrenceCount)}×</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(issue.lastSeenAt)}
                    </TableCell>
                    <TableActions>
                      <TableActionLink
                        href={detailHref(`/issues/${issue.id}`, from)}
                        label="View issue"
                      />
                    </TableActions>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TableCard>
    </div>
  );
}
