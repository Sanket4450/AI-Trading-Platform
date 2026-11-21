import { apiFetch } from '@/lib/api';
import type { AuditRow, AuditSummary, Paginated } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { formatAction, label } from '@/lib/labels';
import { readLimit } from '@/lib/pagination';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { EmptyState } from '@/components/dashboard/empty-state';
import { TableActions, TableRefreshButton } from '@/components/dashboard/table-actions';
import { PageSizeSelect } from '@/components/dashboard/page-size-select';
import { Pagination } from '@/components/dashboard/pagination';
import { DateRangeFilter, SearchFilter, TableFilters } from '@/components/dashboard/table-filters';
import { AuditDialog } from '@/features/audit/components/audit-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function startOfUtcDay(value: string): string | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function endOfUtcDay(value: string): string | null {
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    from?: string;
    to?: string;
    limit?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const limit = readLimit(params.limit);
  const filters = new URLSearchParams();
  if (params.search) filters.set('search', params.search);
  if (params.from) {
    const from = startOfUtcDay(params.from);
    if (from) filters.set('from', from);
  }
  if (params.to) {
    const to = endOfUtcDay(params.to);
    if (to) filters.set('to', to);
  }
  const query = new URLSearchParams(filters);
  query.set('limit', String(limit));

  const [data, summary] = await Promise.all([
    apiFetch<Paginated<AuditRow>>(`/audit?${query.toString()}`),
    apiFetch<AuditSummary>(`/audit/summary?${filters.toString()}`),
  ]);
  const rows = data.items;
  const hasFilters = Boolean(params.search || params.from || params.to);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TableCard
        summary={
          <TableSummary
            items={[
              {
                label: 'Rows',
                value: formatNumber(summary.total),
                hint: 'Filtered result',
                tone: 'success',
              },
              {
                label: 'Actors',
                value: formatNumber(summary.actors),
                hint: 'Operators and system jobs',
                tone: 'info',
              },
              {
                label: 'Entity types',
                value: formatNumber(summary.entityTypes),
                hint: 'Distinct domains touched',
                tone: 'highlight',
              },
              {
                label: 'Retention',
                value: 'Append-only',
                hint: 'No update or delete path',
                tone: 'warning',
              },
            ]}
          />
        }
        filters={
          <TableFilters>
            <SearchFilter
              defaultValue={params.search ?? ''}
              placeholder="Search action, actor, entity, IP…"
            />
            <DateRangeFilter defaultFrom={params.from} defaultTo={params.to} />
          </TableFilters>
        }
        actions={<TableRefreshButton />}
        footer={
          <Pagination
            pageSizeControl={<PageSizeSelect value={limit} />}
            page={data.page}
            itemsCount={rows.length}
            pathname="/audit"
            searchParams={params}
            itemLabel="audit rows"
          />
        }
      >
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No audit rows"
              description={
                hasFilters
                  ? 'No audit entry matches these filters.'
                  : 'Change a configuration or run the seed.'
              }
            />
          </div>
        ) : (
          <Table containerClassName="h-full overflow-auto">
            <TableHeader className="bg-card sticky top-0 z-10">
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>IP</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{row.actorEmail ?? 'System'}</p>
                    <p className="text-muted-foreground font-mono text-[10px]">
                      {row.actorUserId ?? '—'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {formatAction(row.action)}
                    </Badge>
                    <p className="text-muted-foreground mt-1 font-mono text-[10px]">{row.action}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{label(row.entityType)}</p>
                    <p className="text-muted-foreground font-mono text-[10px]">
                      {row.entityId ?? '—'}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {row.ipAddress ?? '—'}
                  </TableCell>
                  <TableActions>
                    <AuditDialog row={row} />
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
