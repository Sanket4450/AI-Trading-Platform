'use client';

import { PencilLine } from 'lucide-react';
import type { SystemSetting } from '@/lib/types';
import { formatSettingKey } from '@/lib/labels';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField } from '@/components/dashboard/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUpdateSetting } from './mutations';

export function SettingEditor({ setting }: { setting: SystemSetting }) {
  const action = useUpdateSetting();

  return (
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
      action={action}
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
        <Input id={`description-${setting.key}`} name="description" defaultValue={setting.description ?? ''} />
      </FormField>
    </FormDialog>
  );
}
