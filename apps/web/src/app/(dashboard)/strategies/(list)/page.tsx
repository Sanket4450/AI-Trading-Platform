import { apiFetch } from '@/lib/api';
import type { Strategy } from '@/lib/types';
import { formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { SearchFilter, TableFilters } from '@/components/dashboard/table-filters';
import {
  TableActionLink,
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

export default async function StrategiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  const queryString = query.toString();

  const strategies = await apiFetch<Strategy[]>(
    `/strategies${queryString ? `?${queryString}` : ''}`,
  );

  const versionTotal = strategies.reduce((total, strategy) => total + strategy.versionCount, 0);
  const activationTotal = strategies.reduce(
    (total, strategy) => total + strategy.activeActivations,
    0,
  );
  const universeTotal = strategies.reduce((total, strategy) => total + strategy.universeCount, 0);
  const hasFilters = Boolean(params.search);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TableCard
        summary={
          <TableSummary
            items={[
              {
                label: 'Strategies',
                value: formatNumber(strategies.length),
                hint: 'Logical registry',
                tone: 'success',
              },
              {
                label: 'Versions',
                value: formatNumber(versionTotal),
                hint: 'Immutable code releases',
                tone: 'info',
              },
              {
                label: 'Active activations',
                value: formatNumber(activationTotal),
                hint: 'None while research-only',
                tone: 'warning',
              },
              {
                label: 'Universes',
                value: formatNumber(universeTotal),
                hint: 'Bound membership sets',
                tone: 'highlight',
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
                <TableHead>Latest version</TableHead>
                <TableHead>Versions</TableHead>
                <TableHead>Universes</TableHead>
                <TableHead>Activations</TableHead>
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
                  <TableCell>{strategy.universeCount}</TableCell>
                  <TableCell>{strategy.activeActivations}</TableCell>
                  <TableActions>
                    <TableActionLink href={`/strategies/${strategy.id}`} label="View strategy" />
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
