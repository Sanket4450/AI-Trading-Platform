import { apiFetch } from '@/lib/api';
import type { Universe } from '@/lib/types';
import { formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
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

export default async function UniversesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  const queryString = query.toString();

  const universes = await apiFetch<Universe[]>(`/universes${queryString ? `?${queryString}` : ''}`);

  const versionTotal = universes.reduce((total, universe) => total + universe.versionCount, 0);
  const memberTotal = universes.reduce(
    (total, universe) => total + (universe.latestMemberCount ?? 0),
    0,
  );
  const activeTotal = universes.filter((universe) => universe.isActive).length;
  const hasFilters = Boolean(params.search);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TableCard
        summary={
          <TableSummary
            items={[
              {
                label: 'Universes',
                value: formatNumber(universes.length),
                hint: 'Selection definitions',
                tone: 'success',
              },
              {
                label: 'Versions',
                value: formatNumber(versionTotal),
                hint: 'Immutable snapshots',
                tone: 'info',
              },
              {
                label: 'Latest members',
                value: formatNumber(memberTotal),
                hint: 'Rows across latest versions',
                tone: 'highlight',
              },
              {
                label: 'Active',
                value: formatNumber(activeTotal),
                hint: 'Available to strategies',
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
      >
        {universes.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No universes"
              description={
                hasFilters
                  ? 'No universe matches this search.'
                  : 'Run the seed to create orb-liquid-20.'
              }
            />
          </div>
        ) : (
          <Table containerClassName="h-full overflow-auto">
            <TableHeader className="bg-card sticky top-0 z-10">
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Lookback</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Latest version</TableHead>
                <TableHead>Members</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {universes.map((universe) => (
                <TableRow key={universe.id}>
                  <TableCell>
                    <p className="font-medium">{universe.code}</p>
                    <p className="text-muted-foreground text-xs">{universe.name}</p>
                  </TableCell>
                  <TableCell>{label(universe.selectionMethod)}</TableCell>
                  <TableCell>{universe.lookbackSessions ?? '—'} sessions</TableCell>
                  <TableCell>{label(universe.refreshCadence)}</TableCell>
                  <TableCell>
                    {universe.latestVersion ? (
                      <Badge variant="outline">v{universe.latestVersion}</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{universe.latestMemberCount ?? '—'}</TableCell>
                  <TableActions>
                    <TableActionLink href={`/universes/${universe.id}`} label="View universe" />
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
