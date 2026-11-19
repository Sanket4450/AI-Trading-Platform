import Link from 'next/link';
import { PencilLine, Plus, SlidersHorizontal } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type {
  ConfigurationVersion,
  ProviderStatus,
  QualityIssue,
  SystemSetting,
} from '@/lib/types';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { formatSettingKey, label } from '@/lib/labels';
import { detailHref } from '@/lib/navigation';
import { SectionCard } from '@/components/dashboard/section-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField, FormSelect } from '@/components/dashboard/form-field';
import { FilterSelect, SearchFilter, TableFilters } from '@/components/dashboard/table-filters';
import { TableActions, TableRefreshButton } from '@/components/dashboard/table-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { createConfigurationAction, updateSettingAction } from './actions';
import { ConfigurationVersionDialog } from './configuration-version-dialog';

const configTypes = ['strategy', 'risk', 'system'] as const;

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

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    configType?: string;
    scopeKey?: string;
    version?: string;
  }>;
}) {
  const params = await searchParams;

  const configQuery = new URLSearchParams();
  if (params.configType) configQuery.set('configType', params.configType);
  if (params.scopeKey) configQuery.set('scopeKey', params.scopeKey);
  configQuery.set('limit', '100');

  const selectedVersion = params.version
    ? apiFetch<ConfigurationVersion>(`/configuration/${params.version}`).catch(() => null)
    : Promise.resolve(null);

  const [settings, provider, providerIssues, versions, versionDetail] = await Promise.all([
    apiFetch<SystemSetting[]>('/settings'),
    apiFetch<ProviderStatus>('/settings/provider'),
    apiFetch<QualityIssue[]>('/settings/issues?limit=20'),
    apiFetch<ConfigurationVersion[]>(`/configuration?${configQuery.toString()}`),
    selectedVersion,
  ]);

  const distinctTypes = new Set(versions.map((version) => version.configType)).size;
  const distinctScopes = new Set(versions.map((version) => version.scopeKey)).size;

  function versionHref(id: string) {
    const query = new URLSearchParams();
    if (params.configType) query.set('configType', params.configType);
    if (params.scopeKey) query.set('scopeKey', params.scopeKey);
    query.set('version', id);
    return `/settings?${query.toString()}`;
  }

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
      <SectionCard
        title="Provider and schedule state"
        description="Read-only operational state. Credentials are reported as present or missing, never returned."
      >
        <KeyValueGrid
          columns={4}
          items={[
            { label: 'Network', value: provider.networkEnabled ? 'Enabled' : 'Disabled' },
            { label: 'API key', value: provider.apiKeyConfigured ? 'Set' : 'Missing' },
            { label: 'Token', value: provider.tokenConfigured ? 'Configured' : 'Missing' },
            { label: 'Daily oracle', value: provider.dailyOracleEnabled ? 'Enabled' : 'Disabled' },
            {
              label: 'Budget',
              value: provider.budget
                ? `${provider.budget.availableSecond}/s · ${provider.budget.availableMinute}/m · ${provider.budget.available30Minutes}/30m`
                : 'Unavailable',
            },
            {
              label: 'Chunks',
              value: `${formatNumber(provider.runningChunks)} running · ${formatNumber(provider.queuedChunks)} queued`,
            },
            {
              label: 'Failed 24h',
              value: formatNumber(provider.failedRuns24h),
            },
            {
              label: 'Raw payloads',
              value: `${formatNumber(Number(provider.payloadCount))} rows · ${formatNumber(Number(provider.payloadBytes))} bytes`,
            },
            {
              label: 'Last instrument sync',
              value: provider.lastSuccessfulSyncAt
                ? formatDateTime(provider.lastSuccessfulSyncAt)
                : 'Never',
            },
            {
              label: 'Last backfill',
              value: provider.lastSuccessfulBackfillAt
                ? formatDateTime(provider.lastSuccessfulBackfillAt)
                : 'Never',
            },
            {
              label: 'Last intraday finalize',
              value: provider.lastSuccessfulIntradayAt
                ? formatDateTime(provider.lastSuccessfulIntradayAt)
                : 'Never',
            },
            {
              label: 'Last validation',
              value: provider.lastSuccessfulValidationAt
                ? formatDateTime(provider.lastSuccessfulValidationAt)
                : 'Never',
            },
            {
              label: 'Oldest payload',
              value: provider.oldestPayloadAt
                ? formatDateTime(provider.oldestPayloadAt)
                : 'None retained',
            },
            {
              label: 'Paused until',
              value: provider.budget?.pausedUntil
                ? formatDateTime(provider.budget.pausedUntil)
                : 'Not paused',
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        className="mt-4"
        title="Provider issues"
        description="Findings with no single instrument: provider, trading calendar and market-wide checks."
      >
        {providerIssues.length === 0 ? (
          <EmptyState
            title="No provider issues"
            description="Provider-wide validation has not raised anything."
          />
        ) : (
          <div className="space-y-2">
            {providerIssues.map((issue) => (
              <Link
                key={issue.id}
                href={detailHref(`/settings/issues/${issue.id}`, '/settings')}
                className="border-border/70 bg-background/40 block rounded-lg border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{label(issue.issueType)}</span>
                  <div className="flex gap-1">
                    <StatusBadge status={issue.severity} />
                    <StatusBadge status={issue.status} />
                  </div>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {issue.ruleId ?? 'No rule'} · {issue.tradingDate ?? 'No date'} · seen{' '}
                  {issue.occurrenceCount}× · last {formatDateTime(issue.lastSeenAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        className="mt-4"
        title="Configuration versions"
        description={`${formatNumber(versions.length)} rows · ${formatNumber(distinctTypes)} types · ${formatNumber(distinctScopes)} scopes · immutable snapshots.`}
        toolbar={
          <TableFilters>
            <SearchFilter
              name="scopeKey"
              defaultValue={params.scopeKey ?? ''}
              placeholder="Search scope key…"
            />
            <FilterSelect
              id="filter-configType"
              name="configType"
              defaultValue={params.configType ?? ''}
              submitOnChange
              options={[
                { value: '', label: 'All types' },
                ...configTypes.map((type) => ({ value: type, label: label(type) })),
              ]}
            />
          </TableFilters>
        }
        actions={
          <>
            <TableRefreshButton />
            {createForm}
          </>
        }
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
              {versions.map((version) => (
                <TableRow key={version.id}>
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
                  <TableActions>
                    <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
                      <Link href={versionHref(version.id)}>
                        <SlidersHorizontal className="size-3.5" />
                        Open snapshot
                      </Link>
                    </Button>
                  </TableActions>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {versionDetail ? <ConfigurationVersionDialog version={versionDetail} defaultOpen /> : null}

      <div className="mt-6">
        <h2 className="text-sm font-semibold tracking-tight">System settings</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Non-trading preferences. Each change is validated as JSON and audited.
        </p>
      </div>

      {settings.length === 0 ? (
        <EmptyState
          className="mt-3"
          title="No settings"
          description="Run the seed to create the default system settings."
        />
      ) : (
        <div className="mt-3 space-y-3">
          {settings.map((setting) => (
            <SectionCard
              key={setting.key}
              title={formatSettingKey(setting.key)}
              description={
                <>
                  {setting.description ?? 'No description'}
                  <span className="text-muted-foreground ml-2 font-mono text-[10px]">
                    {setting.key}
                  </span>
                </>
              }
              actions={
                <FormDialog
                  trigger={
                    <Button type="button" size="sm" variant="outline">
                      <PencilLine className="size-4" />
                      Edit
                    </Button>
                  }
                  title={formatSettingKey(setting.key)}
                  description="Changes are validated as JSON, written once and audited."
                  submitLabel="Save"
                  action={updateSettingAction}
                >
                  <input type="hidden" name="key" value={setting.key} />
                  <FormField label="Value (JSON)" htmlFor={`value-${setting.key}`}>
                    <Input
                      id={`value-${setting.key}`}
                      name="value"
                      defaultValue={JSON.stringify(setting.value)}
                      className="font-mono text-xs"
                      required
                    />
                  </FormField>
                  <FormField label="Description" htmlFor={`description-${setting.key}`}>
                    <Input
                      id={`description-${setting.key}`}
                      name="description"
                      defaultValue={setting.description ?? ''}
                    />
                  </FormField>
                </FormDialog>
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="bg-muted/40 rounded-md px-2 py-1 font-mono text-xs">
                  {JSON.stringify(setting.value)}
                </code>
                <Badge variant="outline" className="text-[10px]">
                  Updated {formatDateTime(setting.updatedAt)}
                </Badge>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
