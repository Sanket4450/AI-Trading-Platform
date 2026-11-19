'use client';

import { apiRequest } from '@/lib/api-browser';
import { apiErrorMessage } from '@/lib/api-error';
import { formString } from '@/lib/form';
import { useFormMutation } from '@/lib/use-form-mutation';

/** Forms submit one instrument; the API surface is per-instrument by design. */
function selectedInstrument(formData: FormData): string {
  return formData.getAll('instrumentIds').map(String).find(Boolean) ?? '';
}

function returnPath(formData: FormData, fallback: string): string {
  return formString(formData, 'returnTo', fallback);
}

export function useFetchInstruments() {
  return useFormMutation<void>((formData) => {
    const instrumentId = selectedInstrument(formData);
    const mode = formString(formData, 'mode', 'missing_only');
    const from = formString(formData, 'from', '');
    const to = formString(formData, 'to', '');
    const reason = formString(formData, 'reason', '');
    const target = returnPath(formData, '/instruments');

    return {
      request: async () => {
        if (!instrumentId) throw new Error('Select an instrument first');
        await apiRequest(`/instruments/${instrumentId}/fetch`, {
          method: 'POST',
          body: {
            mode,
            from: from || undefined,
            to: to || undefined,
            reason: reason || undefined,
            dryRun: false,
          },
        });
      },
      successUrl: () => `${target}?queued=1`,
      errorUrl: (error) => `${target}?error=${encodeURIComponent(apiErrorMessage(error))}`,
    };
  });
}

export function useCancelInstrument() {
  return useFormMutation<void>((formData) => {
    const instrumentId = formString(formData, 'instrumentId', '');
    const target = returnPath(formData, `/instruments/${instrumentId}`);

    return {
      request: () => apiRequest(`/instruments/${instrumentId}/fetch/cancel`, { method: 'POST' }),
      successUrl: () => `${target}?cancelled=1`,
      errorUrl: (error) => `${target}?error=${encodeURIComponent(apiErrorMessage(error))}`,
    };
  });
}

export function useRecomputeStatus() {
  return useFormMutation<void>((formData) => {
    const instrumentId = formString(formData, 'instrumentId', '');
    const target = returnPath(formData, '/instruments');

    return {
      request: () =>
        apiRequest(`/instruments/${instrumentId}/coverage/recompute`, {
          method: 'POST',
          body: {},
        }),
      successUrl: () => `${target}?recomputed=1`,
      errorUrl: (error) => `${target}?error=${encodeURIComponent(apiErrorMessage(error))}`,
    };
  });
}
