import { apiFetch } from '@/lib/api';
import type { AuditRow } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { formatAction, label } from '@/lib/labels';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import { FilterField, FilterReset, TableFilters } from '@/components/dashboard/table-filters';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    entityType?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.action) query.set('action', params.action);
  if (params.entityType) query.set('entityType', params.entityType);
  if (params.from) query.set('from', new Date(params.from).toISOString());
  if (params.to) query.set('to', new Date(params.to).toISOString());
  query.set('limit', '300');

  const rows = await apiFetch<AuditRow[]>(`/audit?${query.toString()}`);
  const uniqueActors = new Set(rows.map((row) => row.actorEmail ?? 'system')).size;
  const uniqueEntities = new Set(rows.map((row) => row.entityType)).size;
  const hasFilters = Boolean(params.action || params.entityType || params.from || params.to);

  return (
    <div>
      <StatGrid>
        <StatCard
          label="Rows"
          value={formatNumber(rows.length)}
          hint="Filtered result"
          tone="success"
        />
        <StatCard
          label="Actors"
          value={formatNumber(uniqueActors)}
          hint="Operators and system jobs"
          tone="info"
        />
        <StatCard
          label="Entity types"
          value={formatNumber(uniqueEntities)}
          hint="Distinct domains touched"
          tone="highlight"
        />
        <StatCard
          label="Retention"
          value="Append-only"
          hint="No update or delete path"
          tone="warning"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Audit trail"
        description={`${rows.length} rows · ordered newest-first.`}
        toolbar={
          <TableFilters>
            <FilterField label="Action" htmlFor="action">
              <Input
                id="action"
                name="action"
                defaultValue={params.action ?? ''}
                placeholder="configuration.created"
                className="h-8 w-40 text-xs"
              />
            </FilterField>
            <FilterField label="Entity type" htmlFor="entityType">
              <Input
                id="entityType"
                name="entityType"
                defaultValue={params.entityType ?? ''}
                placeholder="strategy_version"
                className="h-8 w-36 text-xs"
              />
            </FilterField>
            <FilterField label="Date range" htmlFor="from">
              <div className="flex items-center gap-1">
                <Input
                  id="from"
                  name="from"
                  type="date"
                  aria-label="From date"
                  defaultValue={params.from ?? ''}
                  className="h-8 w-32 text-xs"
                />
                <span className="text-muted-foreground text-xs">→</span>
                <Input
                  id="to"
                  name="to"
                  type="date"
                  aria-label="To date"
                  defaultValue={params.to ?? ''}
                  className="h-8 w-32 text-xs"
                />
              </div>
            </FilterField>
            {hasFilters ? <FilterReset href="/audit" /> : null}
          </TableFilters>
        }
      >
        {rows.length === 0 ? (
          <EmptyState title="No audit rows" description="Change a configuration or run the seed." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>State</TableHead>
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
                  <TableCell>
                    <details>
                      <summary className="text-muted-foreground cursor-pointer text-xs">
                        View
                      </summary>
                      <div className="mt-2 w-72">
                        <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wide">
                          Before
                        </p>
                        <JsonBlock value={row.beforeState} />
                        <p className="text-muted-foreground mb-1 mt-2 text-[10px] uppercase tracking-wide">
                          After
                        </p>
                        <JsonBlock value={row.afterState} />
                      </div>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
