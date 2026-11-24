'use client';

import { apiRequest } from '@/lib/api-browser';
import { apiErrorMessage } from '@/lib/api-error';
import { useFormMutation } from '@/lib/use-form-mutation';
import { ConfirmDialog } from '@/components/dashboard/confirm-dialog';
import { TableActionButton } from '@/components/dashboard/table-actions';
import type { EvaluationRunDetail } from '@/lib/types';

export function CancelEvaluationDialog({
  strategyId,
  run,
  returnUrl,
}: {
  strategyId: string;
  run: EvaluationRunDetail;
  returnUrl: string;
}) {
  const action = useFormMutation<EvaluationRunDetail>(() => ({
    request: () =>
      apiRequest<EvaluationRunDetail>(
        `/strategies/${strategyId}/evaluation-runs/${run.id}/cancel`,
        { method: 'POST' },
      ),
    successUrl: () => `${returnUrl}?evaluationCancelled=1`,
    errorUrl: (error) => `${returnUrl}?error=${encodeURIComponent(apiErrorMessage(error))}`,
  }));

  return (
    <ConfirmDialog
      trigger={<TableActionButton icon="cancel" label="Cancel run" tone="destructive" />}
      title="Cancel this evaluation?"
      description="The worker stops between days. Every completed day stays readable and the run is labelled cancelled."
      details={
        <p>
          Version v{run.version} · {run.fromDate} → {run.toDate} · {run.status}
        </p>
      }
      confirmLabel="Cancel run"
      action={action}
    />
  );
}
