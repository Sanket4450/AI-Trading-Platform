'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { apiRequest } from '@/lib/api-browser';
import { apiErrorMessage } from '@/lib/api-error';
import { formString } from '@/lib/form';
import { useFormMutation } from '@/lib/use-form-mutation';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField } from '@/components/dashboard/form-field';
import { FormSelect } from '@/components/dashboard/form-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EvaluationRun } from '@/lib/types';

export interface RunnableVersion {
  id: string;
  version: number;
  codeRef: string;
  runtimeStatus: string;
  parameterHash: string | null;
}

export interface RunnableInstrument {
  id: string;
  symbol: string;
  name: string;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 60 * 24 * 60 * 60 * 1000);
  return { from: isoDate(from), to: isoDate(to) };
}

export function RunEvaluationDialog({
  strategyId,
  versions,
  instruments = [],
}: {
  strategyId: string;
  versions: RunnableVersion[];
  instruments?: RunnableInstrument[];
}) {
  const range = defaultRange();
  const [selectedVersionId, setSelectedVersionId] = useState(versions[0]?.id ?? '');
  const selectedVersion =
    versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? null;
  const action = useFormMutation<EvaluationRun>((formData) => {
    const strategyVersionId = formString(formData, 'strategyVersionId');
    const fromDate = formString(formData, 'fromDate');
    const toDate = formString(formData, 'toDate');
    const capital = formString(formData, 'initialCapital');
    const note = formString(formData, 'note');
    const instrumentIds = formData
      .getAll('instrumentIds')
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    return {
      request: async () => {
        if (!strategyVersionId || !fromDate || !toDate || !capital) {
          throw new Error('Version, dates and capital are required');
        }
        const initialCapital = Number(capital);
        if (!Number.isFinite(initialCapital) || initialCapital <= 0) {
          throw new Error('Capital must be a positive number');
        }
        if (fromDate > toDate) {
          throw new Error('From date must be on or before the to date');
        }
        const days =
          Math.floor(
            (new Date(`${toDate}T00:00:00Z`).getTime() -
              new Date(`${fromDate}T00:00:00Z`).getTime()) /
              86_400_000,
          ) + 1;
        if (days > 750) {
          throw new Error('The evaluation range is limited to 750 calendar days');
        }
        return apiRequest<EvaluationRun>(`/strategies/${strategyId}/evaluation-runs`, {
          method: 'POST',
          body: {
            strategyVersionId,
            fromDate,
            toDate,
            initialCapital,
            ...(instrumentIds.length > 0 ? { instrumentIds } : {}),
            ...(note ? { note } : {}),
          },
        });
      },
      successUrl: (result) =>
        `/strategies/${strategyId}/evaluations/${result.id}?evaluationCreated=1`,
      errorUrl: (error) =>
        `/strategies/${strategyId}/evaluations?error=${encodeURIComponent(apiErrorMessage(error))}`,
    };
  });

  return (
    <FormDialog
      trigger={
        <Button type="button" size="sm" disabled={versions.length === 0}>
          <Play className="size-4" />
          Run evaluation
        </Button>
      }
      title="Run a research evaluation"
      description={
        versions.length === 0
          ? 'No registered active or validated version is available to evaluate.'
          : 'Research evaluation on stored candles. No order is sent.'
      }
      submitLabel="Queue evaluation"
      action={action}
      className="sm:max-w-xl"
    >
      <FormField label="Strategy version" htmlFor="strategyVersionId">
        <FormSelect
          id="strategyVersionId"
          name="strategyVersionId"
          defaultValue={versions[0]?.id ?? ''}
          onValueChange={setSelectedVersionId}
          options={versions.map((version) => ({
            value: version.id,
            label: `v${version.version} · ${version.codeRef} · ${version.runtimeStatus}`,
          }))}
        />
      </FormField>
      <div className="border-border/70 bg-background/40 rounded-lg border px-3 py-2 text-xs">
        <span className="text-muted-foreground">Effective parameter config</span>
        <p className="mt-1 break-all font-mono">
          {selectedVersion?.parameterHash ?? 'Resolved by the API at run creation'}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="From date" htmlFor="fromDate">
          <Input id="fromDate" name="fromDate" type="date" defaultValue={range.from} required />
        </FormField>
        <FormField label="To date" htmlFor="toDate">
          <Input id="toDate" name="toDate" type="date" defaultValue={range.to} required />
        </FormField>
      </div>
      <FormField label="Initial capital (INR)" htmlFor="initialCapital">
        <Input
          id="initialCapital"
          name="initialCapital"
          type="number"
          min="1"
          step="0.01"
          defaultValue="1000000"
          required
        />
      </FormField>
      <FormField label="Note" htmlFor="note" hint="Optional operator context, shown on the run.">
        <Textarea id="note" name="note" rows={2} placeholder="Why is this run being made?" />
      </FormField>
      {instruments.length > 0 ? (
        <FormField
          label="Instruments"
          htmlFor="instrumentIds"
          hint="Leave every box unchecked to evaluate all sync-target equities."
        >
          <div
            id="instrumentIds"
            className="border-border/70 bg-background/40 grid max-h-40 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2"
          >
            {instruments.map((instrument) => (
              <label key={instrument.id} className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="instrumentIds" value={instrument.id} />
                <span className="truncate">
                  {instrument.symbol} · {instrument.name}
                </span>
              </label>
            ))}
          </div>
        </FormField>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Parameter and risk configuration versions are resolved and pinned by the API. The range is
        limited to 750 calendar days.
      </p>
    </FormDialog>
  );
}
