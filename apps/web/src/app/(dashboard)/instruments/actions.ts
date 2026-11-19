'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorMessage, apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';

/** Forms submit one instrument; the API surface is per-instrument by design. */
function selectedInstrument(formData: FormData): string {
  return formData.getAll('instrumentIds').map(String).find(Boolean) ?? '';
}

export async function fetchInstrumentsAction(formData: FormData): Promise<void> {
  const instrumentId = selectedInstrument(formData);
  const mode = formString(formData, 'mode', 'missing_only');
  const from = formString(formData, 'from', '');
  const to = formString(formData, 'to', '');
  const reason = formString(formData, 'reason', '');
  const returnTo = formString(formData, 'returnTo', '/instruments');

  if (!instrumentId) {
    redirect(`${returnTo}?error=${encodeURIComponent('Select an instrument first')}`);
  }

  try {
    await apiFetch(`/instruments/${instrumentId}/fetch`, {
      method: 'POST',
      body: JSON.stringify({
        mode,
        from: from || undefined,
        to: to || undefined,
        reason: reason || undefined,
        dryRun: false,
      }),
    });
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }

  revalidatePath('/instruments');
  redirect(`${returnTo}?queued=1`);
}

export async function cancelInstrumentAction(formData: FormData): Promise<void> {
  const instrumentId = formString(formData, 'instrumentId', '');
  const returnTo = formString(formData, 'returnTo', `/instruments/${instrumentId}`);
  try {
    await apiFetch(`/instruments/${instrumentId}/fetch/cancel`, { method: 'POST' });
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }
  revalidatePath('/instruments');
  revalidatePath(`/instruments/${instrumentId}`);
  redirect(`${returnTo}?cancelled=1`);
}

export async function recomputeStatusAction(formData: FormData): Promise<void> {
  const instrumentId = formString(formData, 'instrumentId', '');
  const returnTo = formString(formData, 'returnTo', '/instruments');
  try {
    await apiFetch(`/instruments/${instrumentId}/coverage/recompute`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }
  revalidatePath('/instruments');
  redirect(`${returnTo}?recomputed=1`);
}
