import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { Universe, UniverseDetail } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const selectedId = params.universe ?? universes[0]?.id;
  const detail = selectedId ? await apiFetch<UniverseDetail>(`/universes/${selectedId}`) : null;

  return (
    <div>
      <PageHeader
        title="Universes"
        description="Named selection rules with immutable weekly snapshots. A backtest asks for the version effective on its date."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Universes"
          value={formatNumber(universes.length)}
          hint="Selection definitions"
          tone="green"
        />
        <StatCard
          label="Selected versions"
          value={formatNumber(detail?.versions.length ?? 0)}
          hint="Immutable snapshots"
          tone="cyan"
        />
        <StatCard
          label="Latest members"
          value={formatNumber(detail?.latestMemberCount ?? 0)}
          hint="ORB target is 20"
          tone="violet"
        />
        <StatCard
          label="Refresh"
          value={detail?.refreshCadence ?? '—'}
          hint="Weekly in the strategy spec"
          tone="amber"
        />
      </div>

      <Card className="border-border/70 bg-card/60 mt-6">
        <CardHeader>
          <CardTitle>Universe definitions</CardTitle>
          <CardDescription>
            Select a universe to inspect its version history and membership.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {universes.length === 0 ? (
            <EmptyState title="No universes" description="Run the seed to create orb-liquid-20." />
          ) : (
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
                {universes.map((universe) => (
                  <TableRow key={universe.id}>
                    <TableCell>
                      <p className="font-medium">{universe.code}</p>
                      <p className="text-muted-foreground text-xs">{universe.name}</p>
                    </TableCell>
                    <TableCell>{universe.selectionMethod}</TableCell>
                    <TableCell>{universe.lookbackSessions ?? '—'} sessions</TableCell>
                    <TableCell>{universe.refreshCadence}</TableCell>
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
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        Inspect
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {detail ? (
        <div className="mt-4 space-y-4">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>{detail.code}</CardTitle>
                  <CardDescription>{detail.description}</CardDescription>
                </div>
                <StatusBadge status={detail.isActive ? 'active' : 'retired'} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-muted-foreground text-xs">Selection</p>
                <p>{detail.selectionMethod}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Lookback</p>
                <p>{detail.lookbackSessions ?? '—'} sessions</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Refresh</p>
                <p>{detail.refreshCadence}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Versions</p>
                <p>{detail.versions.length}</p>
              </div>
            </CardContent>
          </Card>

          {detail.versions.map((version) => (
            <Card key={version.id} className="border-border/70 bg-card/60">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Version {version.version}</CardTitle>
                    <CardDescription>
                      Effective {formatDate(version.effectiveFrom)} →{' '}
                      {formatDate(version.effectiveTo)} · {version.memberCount} members
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{version.members.length} rows</Badge>
                </div>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
