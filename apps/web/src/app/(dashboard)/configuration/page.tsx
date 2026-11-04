import { Suspense } from 'react';
import Link from 'next/link';
import { GitCompare, Plus, SlidersHorizontal } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { ConfigurationDiff, ConfigurationVersion } from '@/lib/types';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { DetailSkeleton } from '@/components/dashboard/skeletons';
import { SelectPrompt } from '@/components/dashboard/select-prompt';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField, FormSelect } from '@/components/dashboard/form-field';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import {
  FilterField,
  FilterReset,
  FilterSelect,
  TableFilters,
} from '@/components/dashboard/table-filters';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { bindConfigurationAction, createConfigurationAction } from './actions';

const configTypes = ['strategy', 'risk', 'system'] as const;
const bindingRoles = ['parameters', 'risk', 'execution'] as const;

const defaultPayload = JSON.stringify(
  {
    riskPerTradePct: 0.005,
    dailyLossLimitPct: 0.01,
    maxOpenPositions: 1,
    maxEntriesPerDay: 2,
    maxDrawdownPct: 0.08,
    killSwitchEnabled: true,
  },
  null,
  2,
);

export default async function ConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{
    configType?: string;
    scopeKey?: string;
    config?: string;
    against?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.configType) query.set('configType', params.configType);
  if (params.scopeKey) query.set('scopeKey', params.scopeKey);
  query.set('limit', '100');

  const versions = await apiFetch<ConfigurationVersion[]>(`/configuration?${query.toString()}`);
  const selected = params.config
    ? (versions.find((version) => version.id === params.config) ?? null)
    : null;
  const hasFilters = Boolean(params.configType || params.scopeKey);

  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  const createForm = (
    <FormDialog
      trigger={
        <Button type="button" size="sm">
          <Plus className="size-4" />
          New version
        </Button>
      }
      title="Create an immutable version"
      description="The API validates against the strategy parameter schema or the built-in risk/system schema, then hashes the payload."
      submitLabel="Validate and create"
      action={createConfigurationAction}
      className="sm:max-w-2xl"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Type" htmlFor="configType">
          <FormSelect
            id="configType"
            name="configType"
            defaultValue={params.configType ?? 'strategy'}
            options={configTypes.map((type) => ({ value: type, label: label(type) }))}
          />
        </FormField>
        <FormField label="Scope key" htmlFor="scopeKey">
          <Input
            id="scopeKey"
            name="scopeKey"
            defaultValue={params.scopeKey ?? 'orb-15m'}
            required
          />
        </FormField>
        <FormField label="Schema version" htmlFor="schemaVersion">
          <Input id="schemaVersion" name="schemaVersion" defaultValue="1.0.0" required />
        </FormField>
        <FormField label="Effective from" htmlFor="effectiveFrom">
          <Input
            id="effectiveFrom"
            name="effectiveFrom"
            type="datetime-local"
            defaultValue={nowLocal}
            required
          />
        </FormField>
        <FormField label="Effective to" htmlFor="effectiveTo">
          <Input id="effectiveTo" name="effectiveTo" type="datetime-local" />
        </FormField>
        <FormField label="Supersedes" htmlFor="supersedesId" hint="Optional configuration UUID.">
          <Input id="supersedesId" name="supersedesId" placeholder="Optional UUID" />
        </FormField>
      </div>
      <FormField label="Payload (JSON)" htmlFor="payload">
        <Textarea
          id="payload"
          name="payload"
          rows={12}
          defaultValue={defaultPayload}
          className="font-mono text-xs leading-5"
          required
        />
      </FormField>
    </FormDialog>
  );

  return (
    <div>
      <StatGrid>
        <StatCard
          label="Versions"
          value={formatNumber(versions.length)}
          hint="Filtered result"
          tone="success"
        />
        <StatCard
          label="Selected type"
          value={selected ? label(selected.configType) : '—'}
          hint={selected?.scopeKey ?? 'Select a version'}
          tone="info"
        />
        <StatCard
          label="Selected version"
          value={selected ? `v${selected.version}` : '—'}
          hint={selected ? formatDate(selected.effectiveFrom) : 'Select a version'}
          tone="highlight"
        />
        <StatCard
          label="Bindings"
          value={selected ? formatNumber(selected.bindings?.length ?? 0) : '—'}
          hint="Strategy versions using it"
          tone="warning"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Version history"
        description={`${versions.length} rows · configurations are grouped by type and scope.`}
        toolbar={
          <TableFilters>
            <FilterField label="Type" htmlFor="filter-configType">
              <FilterSelect
                id="filter-configType"
                name="configType"
                defaultValue={params.configType ?? ''}
                className="w-32"
                submitOnChange
                options={[
                  { value: '', label: 'All types' },
                  ...configTypes.map((type) => ({ value: type, label: label(type) })),
                ]}
              />
            </FilterField>
            <FilterField label="Scope key" htmlFor="filter-scopeKey">
              <Input
                id="filter-scopeKey"
                name="scopeKey"
                defaultValue={params.scopeKey ?? ''}
                placeholder="orb-15m, global…"
                className="h-8 w-40 text-xs"
              />
            </FilterField>
            {hasFilters ? <FilterReset href="/configuration" /> : null}
          </TableFilters>
        }
        actions={createForm}
      >
        {versions.length === 0 ? (
          <EmptyState
            title="No configuration versions"
            description="Create one from the header or run the seed."
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
              {versions.map((version) => {
                const isSelected = selected?.id === version.id;
                const target = new URLSearchParams();
                target.set('config', version.id);
                if (params.configType) target.set('configType', params.configType);
                if (params.scopeKey) target.set('scopeKey', params.scopeKey);
                return (
                  <TableRow key={version.id} data-state={isSelected ? 'selected' : undefined}>
                    <TableCell>
                      <Badge variant="outline">{label(version.configType)}</Badge>
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
                        href={`/configuration?${target.toString()}`}
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
        )}
      </SectionCard>

      {selected ? (
        <Suspense
          key={`${selected.id}:${params.against ?? ''}`}
          fallback={<DetailSkeleton blocks={2} className="mt-4" />}
        >
          <ConfigurationDetailPanel
            version={selected}
            versions={versions}
            against={params.against}
          />
        </Suspense>
      ) : (
        <SelectPrompt
          className="mt-4"
          title="Select a configuration version"
          description="Bindings, payload and comparisons load only after a version is selected."
        />
      )}
    </div>
  );
}

async function ConfigurationDetailPanel({
  version,
  versions,
  against,
}: {
  version: ConfigurationVersion;
  versions: ConfigurationVersion[];
  against?: string;
}) {
  const [detail, diff] = await Promise.all([
    apiFetch<ConfigurationVersion>(`/configuration/${version.id}`),
    against
      ? apiFetch<ConfigurationDiff>(`/configuration/${version.id}/diff?against=${against}`)
      : Promise.resolve(null),
  ]);

  return (
    <div className="mt-4">
      <DetailHeader
        badges={
          <>
            <Badge variant="outline">{label(detail.configType)}</Badge>
            <Badge variant="outline">v{detail.version}</Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              {detail.payloadHash.slice(0, 12)}…
            </Badge>
          </>
        }
        meta={`${detail.scopeKey} · schema ${detail.schemaVersion} · effective ${formatDateTime(detail.effectiveFrom)} → ${formatDateTime(detail.effectiveTo)}`}
        actions={
          <FormDialog
            trigger={
              <Button type="button" size="sm" variant="outline">
                <SlidersHorizontal className="size-4" />
                Bind to strategy
              </Button>
            }
            title="Bind to a strategy version"
            description="Binding is the only path from a snapshot to a strategy."
            submitLabel="Bind"
            action={bindConfigurationAction}
          >
            <input type="hidden" name="configurationId" value={detail.id} />
            <FormField
              label="Strategy version ID"
              htmlFor="strategyVersionId"
              hint="Copy the UUID from the strategy detail page."
            >
              <Input id="strategyVersionId" name="strategyVersionId" placeholder="UUID" required />
            </FormField>
            <FormField label="Role" htmlFor="role">
              <FormSelect
                id="role"
                name="role"
                defaultValue="parameters"
                options={bindingRoles.map((role) => ({ value: role, label: label(role) }))}
              />
            </FormField>
          </FormDialog>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard title="Payload and bindings" description="Immutable snapshot content.">
          <div className="space-y-4">
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
                          <Badge variant="outline">{label(binding.role)}</Badge>
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
          </div>
        </SectionCard>

        <SectionCard title="Compare" description="Diff this payload against another version.">
          <form method="get" className="flex flex-nowrap items-center gap-2">
            <input type="hidden" name="config" value={detail.id} />
            <FormField label="Against" htmlFor="against" className="min-w-0 flex-1">
              <FormSelect
                id="against"
                name="against"
                defaultValue={against ?? ''}
                options={[
                  { value: '', label: 'Select a version' },
                  ...versions
                    .filter((version) => version.id !== detail.id)
                    .map((version) => ({
                      value: version.id,
                      label: `${label(version.configType)} / ${version.scopeKey} v${version.version}`,
                    })),
                ]}
              />
            </FormField>
            <Button type="submit" variant="outline">
              <GitCompare className="size-4" />
              Compare
            </Button>
          </form>
        </SectionCard>
      </div>

      {diff ? (
        <SectionCard
          className="mt-4"
          title="Payload diff"
          description={`${label(diff.left.configType)} / ${diff.left.scopeKey} v${diff.left.version} → v${diff.right.version}`}
        >
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
        </SectionCard>
      ) : null}
    </div>
  );
}
