import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { Strategy, StrategyDetail } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { createStrategyVersionAction } from './actions';

const defaultSchema = JSON.stringify(
  {
    type: 'object',
    additionalProperties: false,
    required: ['openingRangeStart', 'openingRangeEnd', 'signalTimeframe'],
    properties: {
      openingRangeStart: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
      openingRangeEnd: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
      signalTimeframe: { type: 'string', enum: ['5m'] },
    },
  },
  null,
  2,
);

export default async function StrategiesPage({
  searchParams,
}: {
  searchParams: Promise<{ strategy?: string }>;
}) {
  const params = await searchParams;
  const strategies = await apiFetch<Strategy[]>('/strategies');
  const selectedId = params.strategy ?? strategies[0]?.id;
  const detail = selectedId ? await apiFetch<StrategyDetail>(`/strategies/${selectedId}`) : null;

  return (
    <div>
      <PageHeader
        title="Strategies"
        description="Registry, immutable code versions, bound configuration snapshots, tradable universe and activations."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Strategies"
          value={formatNumber(strategies.length)}
          hint="Logical registry"
          tone="green"
        />
        <StatCard
          label="Versions"
          value={formatNumber(detail?.versions.length ?? 0)}
          hint="Immutable code releases"
          tone="cyan"
        />
        <StatCard
          label="Universe members"
          value={formatNumber(detail?.versions[0]?.members.length ?? 0)}
          hint="Latest version"
          tone="violet"
        />
        <StatCard
          label="Active activations"
          value={formatNumber(detail?.activeActivations ?? 0)}
          hint="None in R1"
          tone="amber"
        />
      </div>

      <Card className="border-border/70 bg-card/60 mt-6">
        <CardHeader>
          <CardTitle>Strategy registry</CardTitle>
          <CardDescription>Select a strategy to inspect its versions and bindings.</CardDescription>
        </CardHeader>
        <CardContent>
          {strategies.length === 0 ? (
            <EmptyState title="No strategies" description="Run the seed to create orb-15m." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Latest version</TableHead>
                  <TableHead>Versions</TableHead>
                  <TableHead>Universe</TableHead>
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
                            {strategy.latestVersionStatus}
                          </span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{strategy.versionCount}</TableCell>
                    <TableCell>{strategy.universeCount}</TableCell>
                    <TableCell>{strategy.activeActivations}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/strategies?strategy=${strategy.id}`}
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
                <StatusBadge status={detail.status} />
              </div>
            </CardHeader>
          </Card>

          {detail.versions.map((version) => (
            <Card key={version.id} className="border-border/70 bg-card/60">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Version {version.version}</CardTitle>
                    <CardDescription>
                      {version.codeRef} · released {formatDate(version.releasedAt)} ·{' '}
                      {version.members.length} universe members
                    </CardDescription>
                  </div>
                  <StatusBadge status={version.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <h3 className="mb-2 text-sm font-medium">Configuration bindings</h3>
                  {version.bindings.length === 0 ? (
                    <EmptyState
                      title="No bindings"
                      description="Bind a parameters and risk snapshot."
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Role</TableHead>
                          <TableHead>Configuration</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Hash</TableHead>
                          <TableHead>Effective</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {version.bindings.map((binding) => (
                          <TableRow key={binding.id}>
                            <TableCell>
                              <Badge variant="outline">{binding.role}</Badge>
                            </TableCell>
                            <TableCell>
                              {binding.configType} / {binding.scopeKey}
                            </TableCell>
                            <TableCell>v{binding.configVersion}</TableCell>
                            <TableCell className="text-muted-foreground max-w-48 truncate font-mono text-xs">
                              {binding.payloadHash}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(binding.effectiveFrom)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium">Tradable universe</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {version.members.map((member) => (
                      <Badge key={member.id} variant="outline" className="font-mono text-[10px]">
                        {member.rank}. {member.symbol}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Activations</h3>
                    {version.activations.length === 0 ? (
                      <EmptyState
                        title="No activations"
                        description="R1 does not activate a live strategy."
                      />
                    ) : (
                      <div className="space-y-2">
                        {version.activations.map((activation) => (
                          <div
                            key={activation.id}
                            className="border-border/70 bg-background/40 flex items-center justify-between rounded-lg border px-3 py-2"
                          >
                            <span className="text-sm">
                              {activation.accountCode} · {activation.mode}
                            </span>
                            <StatusBadge status={activation.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Parameter schema</h3>
                    <JsonBlock value={version.parameterSchema} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>Create a draft version</CardTitle>
              <CardDescription>
                Draft versions are insert-only. Bind a configuration snapshot after validation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createStrategyVersionAction} className="space-y-3">
                <input type="hidden" name="strategyId" value={detail.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="codeRef">Code reference</Label>
                    <Input
                      id="codeRef"
                      name="codeRef"
                      placeholder="git commit or package version"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="changelog">Changelog</Label>
                    <Input id="changelog" name="changelog" placeholder="What changed?" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="parameterSchema">Parameter schema (JSON Schema)</Label>
                  <textarea
                    id="parameterSchema"
                    name="parameterSchema"
                    defaultValue={defaultSchema}
                    rows={14}
                    className="border-input w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs leading-5"
                    required
                  />
                </div>
                <Button type="submit">Create draft</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
