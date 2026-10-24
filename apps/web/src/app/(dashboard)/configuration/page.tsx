import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { ConfigurationDiff, ConfigurationVersion } from '@/lib/types';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
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
import { bindConfigurationAction, createConfigurationAction } from './actions';

const configTypes = ['strategy', 'risk', 'system'];

export default async function ConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{
    configType?: string;
    scopeKey?: string;
    config?: string;
    against?: string;
    error?: string;
    created?: string;
    bound?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.configType) query.set('configType', params.configType);
  if (params.scopeKey) query.set('scopeKey', params.scopeKey);
  query.set('limit', '100');

  const versions = await apiFetch<ConfigurationVersion[]>(`/configuration?${query.toString()}`);
  const selected = versions.find((version) => version.id === params.config) ?? versions[0] ?? null;
  const detail = selected
    ? await apiFetch<ConfigurationVersion>(`/configuration/${selected.id}`)
    : null;
  const diff =
    selected && params.against
      ? await apiFetch<ConfigurationDiff>(
          `/configuration/${selected.id}/diff?against=${params.against}`,
        )
      : null;

  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return (
    <div>
      <PageHeader
        title="Configuration"
        description="Immutable JSONB snapshots with a canonical hash and effective dates. A change creates a new version; history is never edited."
      />

      {params.error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm">
          {params.error}
        </div>
      ) : null}
      {params.created ? (
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 rounded-lg border px-4 py-3 text-sm">
          Configuration version created.
        </div>
      ) : null}
      {params.bound ? (
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 rounded-lg border px-4 py-3 text-sm">
          Binding saved.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Versions"
          value={formatNumber(versions.length)}
          hint="Filtered result"
          tone="green"
        />
        <StatCard
          label="Selected type"
          value={selected?.configType ?? '—'}
          hint={selected?.scopeKey ?? 'No scope'}
          tone="cyan"
        />
        <StatCard
          label="Selected version"
          value={selected ? `v${selected.version}` : '—'}
          hint={selected ? formatDate(selected.effectiveFrom) : '—'}
          tone="violet"
        />
        <StatCard
          label="Bindings"
          value={formatNumber(detail?.bindings?.length ?? 0)}
          hint="Strategy versions using it"
          tone="amber"
        />
      </div>

      <Card className="border-border/70 bg-card/60 mt-6">
        <CardHeader>
          <CardTitle>Filter versions</CardTitle>
          <CardDescription>Configurations are grouped by type and scope.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="configType">Type</Label>
              <select
                id="configType"
                name="configType"
                defaultValue={params.configType ?? ''}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">All types</option>
                {configTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scopeKey">Scope key</Label>
              <Input
                id="scopeKey"
                name="scopeKey"
                defaultValue={params.scopeKey ?? ''}
                placeholder="orb-15m, global…"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>Version history</CardTitle>
          <CardDescription>{versions.length} rows</CardDescription>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <EmptyState
              title="No configuration versions"
              description="Create one below or run the seed."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead>Effective from</TableHead>
                  <TableHead>Effective to</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell>
                      <Badge variant="outline">{version.configType}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{version.scopeKey}</TableCell>
                    <TableCell>v{version.version}</TableCell>
                    <TableCell className="text-muted-foreground max-w-48 truncate font-mono text-xs">
                      {version.payloadHash}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(version.effectiveFrom)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(version.effectiveTo)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/configuration?config=${version.id}${params.configType ? `&configType=${params.configType}` : ''}${params.scopeKey ? `&scopeKey=${params.scopeKey}` : ''}`}
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
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>
                    {detail.configType} / {detail.scopeKey} / v{detail.version}
                  </CardTitle>
                  <CardDescription>
                    Schema {detail.schemaVersion} · effective {formatDateTime(detail.effectiveFrom)}{' '}
                    → {formatDateTime(detail.effectiveTo)}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {detail.payloadHash.slice(0, 12)}…
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <JsonBlock value={detail.payload} />
              <div>
                <h3 className="mb-2 text-sm font-medium">Bindings</h3>
                {!detail.bindings || detail.bindings.length === 0 ? (
                  <EmptyState
                    title="Not bound"
                    description="Bind this snapshot to a strategy version."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Strategy</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Bound at</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.bindings.map((binding) => (
                        <TableRow key={binding.id}>
                          <TableCell>{binding.strategyCode}</TableCell>
                          <TableCell>v{binding.strategyVersion}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{binding.role}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDateTime(binding.boundAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle>Compare</CardTitle>
                <CardDescription>Diff this payload against another version.</CardDescription>
              </CardHeader>
              <CardContent>
                <form method="get" className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="config" value={detail.id} />
                  <div className="min-w-48 flex-1 space-y-1.5">
                    <Label htmlFor="against">Against</Label>
                    <select
                      id="against"
                      name="against"
                      defaultValue={params.against ?? ''}
                      className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    >
                      <option value="">Select a version</option>
                      {versions
                        .filter((version) => version.id !== detail.id)
                        .map((version) => (
                          <option key={version.id} value={version.id}>
                            {version.configType}/{version.scopeKey} v{version.version}
                          </option>
                        ))}
                    </select>
                  </div>
                  <Button type="submit" variant="outline">
                    Diff
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle>Bind to a strategy version</CardTitle>
                <CardDescription>
                  Binding is the only path from a snapshot to a strategy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={bindConfigurationAction} className="space-y-3">
                  <input type="hidden" name="configurationId" value={detail.id} />
                  <div className="space-y-1.5">
                    <Label htmlFor="strategyVersionId">Strategy version ID</Label>
                    <Input
                      id="strategyVersionId"
                      name="strategyVersionId"
                      placeholder="UUID"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="role">Role</Label>
                    <select
                      id="role"
                      name="role"
                      className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                      defaultValue="parameters"
                    >
                      <option value="parameters">parameters</option>
                      <option value="risk">risk</option>
                      <option value="execution">execution</option>
                    </select>
                  </div>
                  <Button type="submit">Bind</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {diff ? (
        <Card className="border-border/70 bg-card/60 mt-4">
          <CardHeader>
            <CardTitle>Payload diff</CardTitle>
            <CardDescription>
              {diff.left.configType}/{diff.left.scopeKey} v{diff.left.version} → v
              {diff.right.version}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {diff.changes.length === 0 ? (
              <EmptyState title="No differences" description="The payloads are identical." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Path</TableHead>
                    <TableHead>Left</TableHead>
                    <TableHead>Right</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diff.changes.map((change) => (
                    <TableRow key={change.path}>
                      <TableCell className="font-mono text-xs">{change.path}</TableCell>
                      <TableCell className="text-muted-foreground max-w-72 truncate font-mono text-xs">
                        {JSON.stringify(change.left)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-72 truncate font-mono text-xs">
                        {JSON.stringify(change.right)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>Create an immutable version</CardTitle>
          <CardDescription>
            The API validates against the strategy parameter schema or the built-in risk/system
            schema, then hashes the payload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createConfigurationAction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="configType">Type</Label>
                <select
                  id="configType"
                  name="configType"
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  defaultValue={detail?.configType ?? 'strategy'}
                >
                  {configTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scopeKey">Scope key</Label>
                <Input
                  id="scopeKey"
                  name="scopeKey"
                  defaultValue={detail?.scopeKey ?? 'orb-15m'}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schemaVersion">Schema version</Label>
                <Input id="schemaVersion" name="schemaVersion" defaultValue="1.0.0" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="effectiveFrom">Effective from</Label>
                <Input
                  id="effectiveFrom"
                  name="effectiveFrom"
                  type="datetime-local"
                  defaultValue={nowLocal}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="effectiveTo">Effective to</Label>
                <Input id="effectiveTo" name="effectiveTo" type="datetime-local" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supersedesId">Supersedes ID</Label>
                <Input id="supersedesId" name="supersedesId" placeholder="Optional UUID" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payload">Payload (JSON)</Label>
              <textarea
                id="payload"
                name="payload"
                rows={12}
                defaultValue={
                  '{\n  "riskPerTradePct": 0.005,\n  "dailyLossLimitPct": 0.01,\n  "maxOpenPositions": 1,\n  "maxEntriesPerDay": 2,\n  "maxDrawdownPct": 0.08,\n  "killSwitchEnabled": true\n}'
                }
                className="border-input w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs leading-5"
                required
              />
            </div>
            <Button type="submit">Validate and create</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
