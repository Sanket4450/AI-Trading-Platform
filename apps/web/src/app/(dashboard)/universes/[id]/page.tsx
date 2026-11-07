import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { UniverseDetail } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { DetailDialog } from '@/components/dashboard/detail-dialog';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import {
  TableActionButton,
  TableActions,
  TableRefreshButton,
} from '@/components/dashboard/table-actions';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function UniverseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await apiFetch<UniverseDetail>(`/universes/${id}`);

  if (!detail) notFound();

  return (
    <div>
      <PageMeta
        title={`${detail.name} · Universe`}
        description="Version history and current members of this universe."
      />

      <DetailHeader
        badges={
          <>
            <Badge variant="outline">{detail.code}</Badge>
            <StatusBadge status={detail.isActive ? 'active' : 'retired'} />
          </>
        }
        meta={`${detail.versions.length} versions · latest v${detail.latestVersion ?? '—'}`}
        actions={
          <Link href="/universes" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to universes
          </Link>
        }
      />

      <StatGrid>
        <StatCard
          label="Versions"
          value={formatNumber(detail.versions.length)}
          hint="Immutable snapshots"
          tone="info"
        />
        <StatCard
          label="Latest version"
          value={detail.latestVersion ? `v${detail.latestVersion}` : '—'}
          hint={detail.latestEffectiveFrom ? formatDate(detail.latestEffectiveFrom) : 'No version'}
          tone="success"
        />
        <StatCard
          label="Latest members"
          value={formatNumber(detail.latestMemberCount ?? 0)}
          hint="ORB target is 20"
          tone="highlight"
        />
        <StatCard
          label="Refresh"
          value={label(detail.refreshCadence)}
          hint="Weekly in the strategy spec"
          tone="warning"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title={detail.name}
        description={detail.description ?? 'No description'}
      >
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
              actions={
                <>
                  <Badge variant="outline">{version.members.length} rows</Badge>
                  <TableRefreshButton />
                </>
              }
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
                    <TableHead />
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
                      <TableActions>
                        <DetailDialog
                          title={`${member.symbol} · universe member`}
                          description={`Version ${version.version} · rank ${member.rank}`}
                          trigger={<TableActionButton label={`View ${member.symbol}`} />}
                        >
                          <KeyValueGrid
                            columns={2}
                            items={[
                              { label: 'Symbol', value: member.symbol },
                              { label: 'Name', value: member.name },
                              { label: 'ISIN', value: member.isin ?? '—' },
                              { label: 'Rank', value: member.rank },
                              {
                                label: 'Median traded value',
                                value: member.medianTradedValue ?? '—',
                              },
                              { label: 'Added', value: formatDate(member.addedAt) },
                              {
                                label: 'Removed',
                                value: member.removedAt ? formatDate(member.removedAt) : 'Active',
                              },
                              {
                                label: 'Instrument ID',
                                value: (
                                  <span className="break-all font-mono text-xs">
                                    {member.instrumentId}
                                  </span>
                                ),
                              },
                            ]}
                          />
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/instruments/${member.instrumentId}`}>
                              Open instrument
                            </Link>
                          </Button>
                        </DetailDialog>
                      </TableActions>
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
