import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type {
  ConfigurationSummary,
  ConfigurationVersion,
  Paginated,
  ProviderStatus,
  SystemSetting,
} from '@/lib/types';
import { readLimit, readOffset } from '@/lib/pagination';
import { configurationTypes } from '@/lib/configuration';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { formatSettingKey, label } from '@/lib/labels';
import { SectionCard } from '@/components/dashboard/section-card';
import { EmptyState } from '@/components/dashboard/empty-state';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { FilterSelect, SearchFilter, TableFilters } from '@/components/dashboard/table-filters';
import { TableActions, TableRefreshButton } from '@/components/dashboard/table-actions';
import { PageSizeSelect } from '@/components/dashboard/page-size-select';
import { Pagination } from '@/components/dashboard/pagination';
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
import { ConfigurationVersionDialog } from './configuration-version-dialog';
import { CreateConfigurationDialog } from './create-configuration-dialog';
import { SettingEditor } from './setting-editor';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    configType?: string;
    scopeKey?: string;
    version?: string;
    limit?: string | string[];
    offset?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const limit = readLimit(params.limit);
  const offset = readOffset(params.offset);

  const configQuery = new URLSearchParams();
  if (params.configType) configQuery.set('configType', params.configType);
  if (params.scopeKey) configQuery.set('scopeKey', params.scopeKey);
  configQuery.set('limit', String(limit));
  configQuery.set('offset', String(offset));

  const selectedVersion = params.version
    ? apiFetch<ConfigurationVersion>(`/configuration/${params.version}`).catch(() => null)
    : Promise.resolve(null);

  const [settings, provider, versionsPage, summary, versionDetail] = await Promise.all([
    apiFetch<SystemSetting[]>('/settings'),
    apiFetch<ProviderStatus>('/settings/provider'),
    apiFetch<Paginated<ConfigurationVersion>>(`/configuration?${configQuery.toString()}`),
    apiFetch<ConfigurationSummary>(`/configuration/summary?${configQuery.toString()}`),
    selectedVersion,
  ]);
  const versions = versionsPage.items;

  function versionHref(id: string) {
    const query = new URLSearchParams();
    if (params.configType) query.set('configType', params.configType);
    if (params.scopeKey) query.set('scopeKey', params.scopeKey);
    query.set('limit', String(limit));
    query.set('offset', String(offset));
    query.set('version', id);
    return `/settings?${query.toString()}`;
  }

  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  const createForm = (
    <CreateConfigurationDialog
      defaultConfigType={params.configType ?? 'strategy'}
      defaultScopeKey={params.scopeKey ?? 'orb-15m'}
      nowLocal={nowLocal}
    />
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
            {
              label: 'Budget',
              value: provider.budget
                ? `${provider.budget.availableSecond}/s · ${provider.budget.availableMinute}/m · ${provider.budget.available30Minutes}/30m`
                : 'Unavailable',
            },
            {
              label: 'Jobs',
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
        title="Configuration versions"
        description={`${formatNumber(summary.total)} rows · ${formatNumber(summary.configTypes)} types · ${formatNumber(summary.scopeKeys)} scopes · immutable snapshots.`}
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
                ...configurationTypes.map((type) => ({ value: type, label: label(type) })),
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
        footer={
          <Pagination
            pageSizeControl={<PageSizeSelect value={limit} />}
            page={versionsPage.page}
            itemsCount={versions.length}
            pathname="/settings"
            searchParams={params}
            itemLabel="configuration versions"
          />
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
              actions={<SettingEditor setting={setting} />}
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
