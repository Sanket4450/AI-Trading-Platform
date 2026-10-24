import { apiFetch } from '@/lib/api';
import type { AuditRow } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    actorUserId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.action) query.set('action', params.action);
  if (params.entityType) query.set('entityType', params.entityType);
  if (params.actorUserId) query.set('actorUserId', params.actorUserId);
  if (params.from) query.set('from', new Date(params.from).toISOString());
  if (params.to) query.set('to', new Date(params.to).toISOString());
  query.set('limit', '300');

  const rows = await apiFetch<AuditRow[]>(`/audit?${query.toString()}`);
  const uniqueActors = new Set(rows.map((row) => row.actorEmail ?? 'system')).size;
  const uniqueEntities = new Set(rows.map((row) => row.entityType)).size;

  return (
    <div>
      <PageHeader
        title="Audit"
        description="Append-only history of security, configuration and operational changes. Secrets are redacted before storage."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Rows"
          value={formatNumber(rows.length)}
          hint="Filtered result"
          tone="green"
        />
        <StatCard
          label="Actors"
          value={formatNumber(uniqueActors)}
          hint="Operators and system jobs"
          tone="cyan"
        />
        <StatCard
          label="Entity types"
          value={formatNumber(uniqueEntities)}
          hint="Distinct domains touched"
          tone="violet"
        />
        <StatCard
          label="Retention"
          value="Append-only"
          hint="No update or delete path"
          tone="amber"
        />
      </div>

      <Card className="border-border/70 bg-card/60 mt-6">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Audit rows are ordered newest-first.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="action">Action</Label>
              <Input
                id="action"
                name="action"
                defaultValue={params.action ?? ''}
                placeholder="configuration.created"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entityType">Entity type</Label>
              <Input
                id="entityType"
                name="entityType"
                defaultValue={params.entityType ?? ''}
                placeholder="strategy_version"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="actorUserId">Actor user ID</Label>
              <Input
                id="actorUserId"
                name="actorUserId"
                defaultValue={params.actorUserId ?? ''}
                placeholder="UUID"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from">From</Label>
              <Input id="from" name="from" type="date" defaultValue={params.from ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="date" defaultValue={params.to ?? ''} />
            </div>
            <div className="flex items-end lg:col-span-5">
              <Button type="submit">Apply filters</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>Audit trail</CardTitle>
          <CardDescription>{rows.length} rows</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              title="No audit rows"
              description="Change a configuration or run the seed."
            />
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
                      <p className="text-sm">{row.actorEmail ?? 'system'}</p>
                      <p className="text-muted-foreground font-mono text-[10px]">
                        {row.actorUserId ?? '—'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {row.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{row.entityType}</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
