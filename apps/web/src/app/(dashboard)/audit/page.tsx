import { apiFetch } from '@/lib/api';
import type { AuditRow } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { formatAction, label } from '@/lib/labels';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import { DetailDialog } from '@/components/dashboard/detail-dialog';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import {
  TableActionButton,
  TableActions,
  TableRefreshButton,
} from '@/components/dashboard/table-actions';
import { DateRangeFilter, SearchFilter, TableFilters } from '@/components/dashboard/table-filters';
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
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.from) {
    const from = startOfUtcDay(params.from);
    if (from) query.set('from', from);
  }
  if (params.to) {
    const to = endOfUtcDay(params.to);
    if (to) query.set('to', to);
  }
  query.set('limit', '300');

  const rows = await apiFetch<AuditRow[]>(`/audit?${query.toString()}`);
  const uniqueActors = new Set(rows.map((row) => row.actorEmail ?? 'system')).size;
  const uniqueEntities = new Set(rows.map((row) => row.entityType)).size;
  const hasFilters = Boolean(params.search || params.from || params.to);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TableCard
        summary={
          <TableSummary
            items={[
              {
                label: 'Rows',
                value: formatNumber(rows.length),
                hint: 'Filtered result',
                tone: 'success',
              },
              {
                label: 'Actors',
                value: formatNumber(uniqueActors),
                hint: 'Operators and system jobs',
                tone: 'info',
              },
              {
                label: 'Entity types',
                value: formatNumber(uniqueEntities),
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
                    <DetailDialog
                      title={formatAction(row.action)}
                      description={formatDateTime(row.createdAt)}
                      trigger={<TableActionButton label="View audit entry" />}
                    >
                      <KeyValueGrid
                        columns={2}
                        items={[
                          { label: 'Actor', value: row.actorEmail ?? 'System' },
                          {
                            label: 'Actor user ID',
                            value: (
                              <span className="break-all font-mono text-xs">
                                {row.actorUserId ?? '—'}
                              </span>
                            ),
                          },
                          { label: 'Action', value: row.action },
                          { label: 'Entity', value: label(row.entityType) },
                          {
                            label: 'Entity ID',
                            value: (
                              <span className="break-all font-mono text-xs">
                                {row.entityId ?? '—'}
                              </span>
                            ),
                          },
                          { label: 'IP address', value: row.ipAddress ?? '—' },
                          {
                            label: 'Request ID',
                            value: (
                              <span className="break-all font-mono text-xs">
                                {row.requestId ?? '—'}
                              </span>
                            ),
                          },
                          { label: 'Recorded', value: formatDateTime(row.createdAt) },
                        ]}
                      />
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs font-medium">Before</p>
                        <JsonBlock value={row.beforeState} />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs font-medium">After</p>
                        <JsonBlock value={row.afterState} />
                      </div>
                    </DetailDialog>
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
