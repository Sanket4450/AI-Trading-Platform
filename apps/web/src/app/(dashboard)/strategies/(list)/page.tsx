import { apiFetch } from '@/lib/api';
import type { Paginated, Strategy, StrategySummary } from '@/lib/types';
import { formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { readLimit, readOffset } from '@/lib/pagination';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { SearchFilter, TableFilters } from '@/components/dashboard/table-filters';
import { TableRefreshButton } from '@/components/dashboard/table-actions';
import { PageSizeSelect } from '@/components/dashboard/page-size-select';
import { Pagination } from '@/components/dashboard/pagination';
import { detailHref, originHref } from '@/lib/navigation';
import {
  TableActionLink,
  TableActions,
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

export default async function StrategiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    limit?: string | string[];
    offset?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const from = originHref('/strategies', params);
  const limit = readLimit(params.limit);
  const offset = readOffset(params.offset);
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (params.search) query.set('search', params.search);

  const [data, summary] = await Promise.all([
    apiFetch<Paginated<Strategy>>(`/strategies?${query.toString()}`),
    apiFetch<StrategySummary>(`/strategies/summary?${query.toString()}`),
  ]);
  const strategies = data.items;
  const hasFilters = Boolean(params.search);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TableCard
        summary={
          <TableSummary
            items={[
              {
                label: 'Strategies',
                value: formatNumber(summary.total),
                hint: 'Logical registry',
                tone: 'success',
              },
              {
                label: 'Versions',
                value: formatNumber(summary.versions),
                hint: 'Immutable code releases',
                tone: 'info',
              },
              {
                label: 'Active activations',
                value: formatNumber(summary.activeActivations),
                hint: 'None while research-only',
                tone: 'warning',
              },
            ]}
          />
        }
        filters={
          <TableFilters>
            <SearchFilter defaultValue={params.search ?? ''} placeholder="Search code or name…" />
          </TableFilters>
        }
        actions={<TableRefreshButton />}
        footer={
          <Pagination
            pageSizeControl={<PageSizeSelect value={limit} />}
            page={data.page}
            itemsCount={strategies.length}
            pathname="/strategies"
            searchParams={params}
            itemLabel="strategies"
          />
        }
      >
        {strategies.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No strategies"
              description={
                hasFilters ? 'No strategy matches this search.' : 'Run the seed to create orb-15m.'
              }
            />
          </div>
        ) : (
          <Table containerClassName="h-full overflow-auto">
            <TableHeader className="bg-card sticky top-0 z-10">
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Runtime</TableHead>
                <TableHead>Latest version</TableHead>
                <TableHead>Versions</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {strategies.map((strategy) => (
                <TableRow key={strategy.id}>
                  <TableCell>
                    <p className="font-medium">{strategy.code}</p>
                    <p className="text-muted-foreground text-xs">{strategy.name}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={strategy.status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={strategy.runtimeStatus ?? 'unregistered'} />
                  </TableCell>
                  <TableCell>
                    {strategy.latestVersion ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{strategy.latestVersion}</Badge>
                        <span className="text-muted-foreground text-xs">
                          {label(strategy.latestVersionStatus)}
                        </span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{strategy.versionCount}</TableCell>
                  <TableCell>
                    {strategy.lastEvaluationStatus ? (
                      <StatusBadge status={strategy.lastEvaluationStatus} />
                    ) : (
                      <span className="text-muted-foreground text-xs">Never</span>
                    )}
                  </TableCell>
                  <TableActions>
                    <TableActionLink
                      href={detailHref(`/strategies/${strategy.id}`, from)}
                      label="View strategy"
                    />
                  </TableActions>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </div>
  );
}
