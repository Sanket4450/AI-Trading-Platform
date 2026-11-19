'use client';

import { Plus } from 'lucide-react';
import { apiRequest } from '@/lib/api-browser';
import { apiErrorMessage } from '@/lib/api-error';
import { formString } from '@/lib/form';
import { useFormMutation } from '@/lib/use-form-mutation';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField } from '@/components/dashboard/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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

function strategiesPath(strategyId: string, flag: string, value: string): string {
  const path = strategyId ? `/strategies/${strategyId}` : '/strategies';
  return `${path}?${new URLSearchParams({ [flag]: value }).toString()}`;
}

export function CreateVersionDialog({ strategyId }: { strategyId: string }) {
  const action = useFormMutation<void>((formData) => {
    const codeRef = formString(formData, 'codeRef');
    const changelog = formString(formData, 'changelog');
    const schemaText = formString(formData, 'parameterSchema');

    return {
      request: async () => {
        if (!codeRef || !schemaText) {
          throw new Error('Strategy, code reference and parameter schema are required');
        }
        let parameterSchema: unknown;
        try {
          parameterSchema = JSON.parse(schemaText);
        } catch {
          throw new Error('Parameter schema must be valid JSON');
        }
        await apiRequest(`/strategies/${strategyId}/versions`, {
          method: 'POST',
          body: {
            codeRef,
            parameterSchema,
            ...(changelog ? { changelog } : {}),
          },
        });
      },
      successUrl: () => strategiesPath(strategyId, 'versionCreated', '1'),
      errorUrl: (error) => strategiesPath(strategyId, 'error', apiErrorMessage(error)),
    };
  });

  return (
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
      action={action}
      className="sm:max-w-2xl"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Code reference" htmlFor="codeRef">
          <Input id="codeRef" name="codeRef" placeholder="Git commit or package version" required />
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
  );
}
