import { PencilLine } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { ProviderStatus, SystemSetting } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { formatSettingKey } from '@/lib/labels';
import { SectionCard } from '@/components/dashboard/section-card';
import { EmptyState } from '@/components/dashboard/empty-state';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField } from '@/components/dashboard/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateSettingAction } from './actions';

export default async function SettingsPage() {
  const [settings, provider] = await Promise.all([
    apiFetch<SystemSetting[]>('/settings'),
    apiFetch<ProviderStatus>('/data/provider-status'),
  ]);

  return (
    <div>
      <SectionCard
        title="Provider and schedule state"
        description="Read-only operational state. Tokens are never returned."
      >
        <KeyValueGrid
          columns={4}
          items={[
            { label: 'Network', value: provider.networkEnabled ? 'Enabled' : 'Disabled' },
            { label: 'Token', value: provider.tokenConfigured ? 'Configured' : 'Missing' },
            { label: 'Daily oracle', value: provider.dailyOracleEnabled ? 'Enabled' : 'Disabled' },
            {
              label: 'Budget',
              value: provider.budget
                ? `${provider.budget.availableSecond}/s · ${provider.budget.availableMinute}/m`
                : 'Unavailable',
            },
            {
              label: 'Last instrument sync',
              value: provider.lastSuccessfulSyncAt
                ? formatDateTime(provider.lastSuccessfulSyncAt)
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
              label: 'Raw payloads',
              value: `${formatNumber(Number(provider.payloadCount))} rows`,
            },
          ]}
        />
      </SectionCard>

      <div className="border-primary/20 bg-primary/5 mt-4 rounded-xl border px-4 py-3 text-sm">
        <p className="text-muted-foreground">
          <span className="text-foreground font-medium">Guardrail:</span> trading mode, risk limits
          and strategy parameters are not editable here. They live in configuration versions so
          every signal can point at the exact snapshot it used.
        </p>
      </div>

      {settings.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="No settings"
          description="Run the seed to create the default system settings."
        />
      ) : (
        <div className="mt-4 space-y-3">
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
