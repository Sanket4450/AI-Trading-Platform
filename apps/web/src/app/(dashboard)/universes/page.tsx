import { Suspense } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { Universe, UniverseDetail } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { DetailSkeleton } from '@/components/dashboard/skeletons';
import { SelectPrompt } from '@/components/dashboard/select-prompt';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
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
  searchParams: Promise<{ universe?: string }>;
}) {
  const params = await searchParams;
  const universes = await apiFetch<Universe[]>('/universes');
  const selected = params.universe
    ? (universes.find((universe) => universe.id === params.universe) ?? null)
    : null;

  if (universes.length === 0) {
    return <EmptyState title="No universes" description="Run the seed to create orb-liquid-20." />;
  }

  return (
    <div>
      <StatGrid>
        <StatCard
          label="Universes"
          value={formatNumber(universes.length)}
          hint="Selection definitions"
          tone="success"
        />
        <StatCard
          label="Versions"
          value={selected ? formatNumber(selected.versionCount) : '—'}
          hint="Immutable snapshots"
          tone="info"
        />
        <StatCard
          label="Latest members"
          value={selected ? formatNumber(selected.latestMemberCount ?? 0) : '—'}
          hint="ORB target is 20"
          tone="highlight"
        />
        <StatCard
          label="Refresh"
          value={selected ? label(selected.refreshCadence) : '—'}
          hint="Weekly in the strategy spec"
          tone="warning"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Universe definitions"
        description="Select a universe to load its version history and membership."
      >
        <Table>
          <TableHeader>
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
            {universes.map((universe) => {
              const isSelected = selected?.id === universe.id;
              return (
                <TableRow key={universe.id} data-state={isSelected ? 'selected' : undefined}>
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
                  <TableCell className="text-right">
                    <Link
                      href={`/universes?universe=${universe.id}`}
                      className={buttonVariants({
                        variant: isSelected ? 'secondary' : 'outline',
                        size: 'sm',
                      })}
                    >
                      {isSelected ? 'Inspecting' : 'Inspect'}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>

      {selected ? (
        <Suspense key={selected.id} fallback={<DetailSkeleton blocks={2} className="mt-4" />}>
          <UniverseDetailPanel universe={selected} />
        </Suspense>
      ) : (
        <SelectPrompt
          className="mt-4"
          title="Select a universe to inspect"
          description="Version history and membership are fetched only after a universe is selected."
        />
      )}
    </div>
  );
}

async function UniverseDetailPanel({ universe }: { universe: Universe }) {
  const detail = await apiFetch<UniverseDetail>(`/universes/${universe.id}`);

  return (
    <div>
      <DetailHeader
        className="mt-4"
        badges={
          <>
            <Badge variant="outline">{detail.code}</Badge>
            <StatusBadge status={detail.isActive ? 'active' : 'retired'} />
          </>
        }
        meta={`${detail.versions.length} versions · latest v${detail.latestVersion ?? '—'}`}
      />

      <SectionCard title={detail.name} description={detail.description ?? 'No description'}>
        <KeyValueGrid
          columns={4}
          items={[
            { label: 'Code', value: detail.code },
            { label: 'Selection method', value: label(detail.selectionMethod) },
            {
              label: 'Lookback',
              value: detail.lookbackSessions ? `${detail.lookbackSessions} sessions` : '—',
            },
            { label: 'Refresh cadence', value: label(detail.refreshCadence) },
          ]}
        />
      </SectionCard>

      {detail.versions.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="No versions"
          description="A universe needs at least one membership snapshot."
        />
      ) : (
        <div className="mt-4 space-y-4">
          {detail.versions.map((version) => (
            <SectionCard
              key={version.id}
              title={`Version ${version.version}`}
              description={`Effective ${formatDate(version.effectiveFrom)} → ${formatDate(version.effectiveTo)} · ${version.memberCount} members`}
              actions={<Badge variant="outline">{version.members.length} rows</Badge>}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Median traded value</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {version.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-mono text-xs">{member.rank}</TableCell>
                      <TableCell className="font-medium">{member.symbol}</TableCell>
                      <TableCell className="text-muted-foreground">{member.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {member.isin ?? '—'}
                      </TableCell>
                      <TableCell>{member.medianTradedValue ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(member.addedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
