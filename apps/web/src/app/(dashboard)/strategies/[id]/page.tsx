import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { apiFetch, getSession } from '@/lib/api';
import type { Instrument, Paginated, StrategyDetail } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { backLinkFor, detailHref, type DetailSearchParams } from '@/lib/navigation';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { DetailDialog } from '@/components/dashboard/detail-dialog';
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
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreateVersionDialog } from './create-version-dialog';
import { RunEvaluationDialog } from './run-evaluation-dialog';

export default async function StrategyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: DetailSearchParams;
}) {
  const { id } = await params;
  const { from: fromParam } = await searchParams;
  const back = backLinkFor(fromParam, '/strategies');
  const [detail, session, instrumentPage] = await Promise.all([
    apiFetch<StrategyDetail>(`/strategies/${id}`),
    getSession(),
    apiFetch<Paginated<Instrument>>('/instruments?segment=NSE_EQ&limit=200'),
  ]);

  if (!detail) notFound();
  const isAdmin = session.user.role === 'admin';
  const runnableVersions = detail.versions.filter(
    (version) =>
      (version.status === 'active' || version.status === 'validated') &&
      version.runtimeStatus === 'registered',
  );
  const runnableInstruments = instrumentPage.items
    .filter((instrument) => instrument.isSyncTarget && instrument.instrumentType === 'EQ')
    .map((instrument) => ({
      id: instrument.id,
      symbol: instrument.tradingSymbol,
      name: instrument.name,
    }));

  return (
    <div>
      <PageMeta
        title={`${detail.code} · Strategy`}
        description="Versions, parameter bindings and activation state for this strategy."
      />

      <DetailHeader
        back={back}
        badges={
          <>
            <Badge variant="outline">{detail.code}</Badge>
            <StatusBadge status={detail.status} />
          </>
        }
        meta={`${detail.versions.length} versions`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={detailHref(`/strategies/${detail.id}/evaluations`, back.href)}>
                View evaluations
              </Link>
            </Button>
            {isAdmin ? (
              <RunEvaluationDialog
                strategyId={detail.id}
                versions={runnableVersions.map((version) => ({
                  id: version.id,
                  version: version.version,
                  codeRef: version.codeRef,
                  runtimeStatus: version.runtimeStatus ?? 'unregistered',
                  parameterHash:
                    version.bindings.find((binding) => binding.role === 'parameters')?.payloadHash ??
                    null,
                }))}
                instruments={runnableInstruments}
              />
            ) : null}
            <CreateVersionDialog strategyId={detail.id} />
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
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Runtime"
        description="Registry resolution for the latest version and the parameters it accepts."
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <KeyValueGrid
            columns={2}
            items={[
              { label: 'Status', value: <StatusBadge status={detail.runtime.status} /> },
              {
                label: 'Implementation',
                value: detail.runtime.implementation
                  ? `${detail.runtime.implementation}@${detail.runtime.implementationVersion}`
                  : '—',
              },
              { label: 'Code ref', value: detail.runtime.codeRef ?? '—' },
              {
                label: 'Schema match',
                value:
                  detail.runtime.schemaMatches === null
                    ? 'Not checked'
                    : detail.runtime.schemaMatches
                      ? 'Match'
                      : 'Mismatch',
              },
              {
                label: 'Error',
                value: detail.runtime.error ?? 'None',
              },
            ]}
          />
          <div>
            <h3 className="mb-2 text-sm font-medium">Supported parameters</h3>
            <div className="flex flex-wrap gap-1.5">
              {detail.runtime.parameterNames.map((name) => (
                <Badge key={name} variant="outline">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

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
              description={`${version.codeRef} · released ${formatDate(version.releasedAt)}`}
              actions={
                <>
                  <StatusBadge status={version.status} />
                  <StatusBadge status={version.runtimeStatus ?? 'unregistered'} />
                  <TableRefreshButton />
                </>
              }
              contentClassName="space-y-5"
            >
              {version.runtimeError ? (
                <p className="text-destructive text-sm">{version.runtimeError}</p>
              ) : null}
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
