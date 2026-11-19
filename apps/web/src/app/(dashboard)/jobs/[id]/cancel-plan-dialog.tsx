'use client';

import { apiRequest } from '@/lib/api-browser';
import { apiErrorMessage } from '@/lib/api-error';
import { useFormMutation } from '@/lib/use-form-mutation';
import { ConfirmDialog } from '@/components/dashboard/confirm-dialog';
import { Button } from '@/components/ui/button';

export function CancelPlanDialog({ jobId, returnTo }: { jobId: string; returnTo: string }) {
  const action = useFormMutation<void>(() => ({
    request: () => apiRequest(`/jobs/${jobId}/cancel`, { method: 'POST' }),
    successUrl: () => `${returnTo}?cancelled=1`,
    errorUrl: (error) => `${returnTo}?error=${encodeURIComponent(apiErrorMessage(error))}`,
  }));

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" size="sm" variant="outline">
          Cancel plan
        </Button>
      }
      title="Cancel this backfill plan?"
      description="The plan stops queuing new instrument chunks. Chunks already in flight finish cleanly, and candles already written are kept."
      confirmLabel="Cancel plan"
      tone="destructive"
      action={action}
    />
  );
}
