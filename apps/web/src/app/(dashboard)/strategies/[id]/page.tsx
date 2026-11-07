import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { StrategyDetail } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { DetailDialog } from '@/components/dashboard/detail-dialog';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField } from '@/components/dashboard/form-field';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import {
  TableActionButton,
  TableActions,
  TableRefreshButton,
} from '@/components/dashboard/table-actions';
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
import { createStrategyVersionAction } from '../actions';

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

export default async function StrategyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await apiFetch<StrategyDetail>(`/strategies/${id}`);

  if (!detail) notFound();

  return (
    <div>
      <PageMeta
        title={`${detail.code} · Strategy`}
        description="Versions, parameter bindings, universes and activation state for this strategy."
      />

      <DetailHeader
        badges={
          <>
            <Badge variant="outline">{detail.code}</Badge>
            <StatusBadge status={detail.status} />
          </>
        }
        meta={`${detail.versions.length} versions · ${detail.universeCount} universes`}
        actions={
          <>
            <Link href="/strategies" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Back to strategies
            </Link>
            <FormDialog
              trigger={
                <Button type="button" size="sm" variant="outline">
                  <Plus className="size-4" />
                  New draft version
                </Button>
              }
              title="Create a draft version"
              description="Draft versions are insert-only. Bind a configuration snapshot after validation."
              submitLabel="Create draft"
              action={createStrategyVersionAction}
              className="sm:max-w-2xl"
            >
              <input type="hidden" name="strategyId" value={detail.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Code reference" htmlFor="codeRef">
                  <Input
                    id="codeRef"
                    name="codeRef"
                    placeholder="Git commit or package version"
                    required
                  />
                </FormField>
                <FormField label="Changelog" htmlFor="changelog">
                  <Input id="changelog" name="changelog" placeholder="What changed?" />
                </FormField>
              </div>
              <FormField label="Parameter schema (JSON Schema)" htmlFor="parameterSchema">
                <Textarea
                  id="parameterSchema"
                  name="parameterSchema"
                  defaultValue={defaultSchema}
                  rows={12}
                  className="font-mono text-xs leading-5"
                  required
                />
              </FormField>
            </FormDialog>
          </>
        }
      />

      <StatGrid>
        <StatCard
          label="Versions"
          value={formatNumber(detail.versions.length)}
          hint="Immutable code releases"
          tone="info"
        />
        <StatCard
          label="Latest version"
          value={detail.latestVersion ? `v${detail.latestVersion}` : '—'}
          hint={label(detail.latestVersionStatus)}
          tone="success"
        />
        <StatCard
          label="Active activations"
          value={formatNumber(detail.activeActivations)}
          hint="None while research-only"
          tone="warning"
        />
        <StatCard
          label="Universes"
          value={formatNumber(detail.universeCount)}
          hint="Bound membership sets"
          tone="highlight"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title={detail.name}
        description={detail.description ?? 'No description'}
      >
        <div className="text-muted-foreground text-sm">
          {detail.latestVersion ? `Latest version v${detail.latestVersion}` : 'No released version'}{' '}
          · {detail.versions.length} immutable versions · {detail.activeActivations} active
          activations
        </div>
      </SectionCard>

      {detail.versions.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="No versions"
          description="Create the first draft version from the header."
        />
      ) : (
        <div className="mt-4 space-y-4">
          {detail.versions.map((version) => (
            <SectionCard
              key={version.id}
              title={`Version ${version.version}`}
              description={`${version.codeRef} · released ${formatDate(version.releasedAt)} · ${version.members.length} universe members`}
              actions={
                <>
                  <StatusBadge status={version.status} />
                  <TableRefreshButton />
                </>
              }
              contentClassName="space-y-5"
            >
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
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {version.bindings.map((binding) => (
                        <TableRow key={binding.id}>
                          <TableCell>
                            <Badge variant="outline">{label(binding.role)}</Badge>
                          </TableCell>
                          <TableCell>
                            {label(binding.configType)} / {binding.scopeKey}
                          </TableCell>
                          <TableCell>v{binding.configVersion}</TableCell>
                          <TableCell className="text-muted-foreground max-w-48 truncate font-mono text-xs">
                            {binding.payloadHash}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(binding.effectiveFrom)}
                          </TableCell>
                          <TableActions>
                            <DetailDialog
                              title={`Binding · ${label(binding.role)}`}
                              description={`${label(binding.configType)} / ${binding.scopeKey} v${binding.configVersion}`}
                              trigger={<TableActionButton label="View binding" />}
                            >
                              <KeyValueGrid
                                columns={2}
                                items={[
                                  { label: 'Role', value: label(binding.role) },
                                  {
                                    label: 'Configuration',
                                    value: `${label(binding.configType)} / ${binding.scopeKey}`,
                                  },
                                  { label: 'Version', value: `v${binding.configVersion}` },
                                  {
                                    label: 'Payload hash',
                                    value: (
                                      <span className="break-all font-mono text-xs">
                                        {binding.payloadHash}
                                      </span>
                                    ),
                                  },
                                  {
                                    label: 'Effective from',
                                    value: formatDate(binding.effectiveFrom),
                                  },
                                  {
                                    label: 'Effective to',
                                    value: binding.effectiveTo
                                      ? formatDate(binding.effectiveTo)
                                      : 'Open',
                                  },
                                  { label: 'Bound at', value: formatDate(binding.boundAt) },
                                ]}
                              />
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/settings?version=${binding.configurationVersionId}`}>
                                  <SlidersHorizontal className="size-4" />
                                  View configuration snapshot
                                </Link>
                              </Button>
                            </DetailDialog>
                          </TableActions>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Tradable universe</h3>
                {version.members.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No instruments bound to this version.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {version.members.map((member) => (
                      <Badge key={member.id} variant="outline" className="text-[10px]">
                        {member.rank}. {member.symbol}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-medium">Activations</h3>
                  {version.activations.length === 0 ? (
                    <EmptyState
                      title="No activations"
                      description="R2 does not activate a live strategy."
                    />
                  ) : (
                    <div className="space-y-2">
                      {version.activations.map((activation) => (
                        <div
                          key={activation.id}
                          className="border-border/70 bg-background/40 flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <span className="text-sm">
                            {activation.accountCode} · {label(activation.mode)}
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
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
