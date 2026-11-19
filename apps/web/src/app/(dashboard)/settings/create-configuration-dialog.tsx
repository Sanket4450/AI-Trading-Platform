'use client';

import { Plus } from 'lucide-react';
import { configurationTypes } from '@/lib/configuration';
import { label } from '@/lib/labels';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField, FormSelect } from '@/components/dashboard/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateConfiguration } from './mutations';

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

export function CreateConfigurationDialog({
  defaultConfigType,
  defaultScopeKey,
  nowLocal,
}: {
  defaultConfigType: string;
  defaultScopeKey: string;
  nowLocal: string;
}) {
  const action = useCreateConfiguration();

  return (
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
      action={action}
      className="sm:max-w-2xl"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Type" htmlFor="configType">
          <FormSelect
            id="configType"
            name="configType"
            defaultValue={defaultConfigType}
            options={configurationTypes.map((type) => ({ value: type, label: label(type) }))}
          />
        </FormField>
        <FormField label="Scope key" htmlFor="scopeKey">
          <Input id="scopeKey" name="scopeKey" defaultValue={defaultScopeKey} required />
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
}
