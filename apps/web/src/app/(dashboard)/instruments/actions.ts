'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorMessage, apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';

function selectedIds(formData: FormData): string[] {
  return formData.getAll('instrumentIds').map(String).filter(Boolean);
}

export async function fetchInstrumentsAction(formData: FormData): Promise<void> {
  const instrumentIds = selectedIds(formData);
  const universeCode = formString(formData, 'universeCode', 'nifty-50');
  const mode = formString(formData, 'mode', 'missing_only');
  const from = formString(formData, 'from', '');
  const to = formString(formData, 'to', '');
  const reason = formString(formData, 'reason', '');
  const returnTo = formString(formData, 'returnTo', '/instruments');

  try {
    await apiFetch('/data/instruments/fetch', {
      method: 'POST',
      body: JSON.stringify({
        instrumentIds: instrumentIds.length > 0 ? instrumentIds : undefined,
        universeCode: instrumentIds.length > 0 ? undefined : universeCode,
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
  revalidatePath('/data');
  redirect(`${returnTo}?queued=1`);
}

export async function cancelInstrumentAction(formData: FormData): Promise<void> {
  const instrumentId = formString(formData, 'instrumentId', '');
  const returnTo = formString(formData, 'returnTo', `/instruments/${instrumentId}`);
  try {
    await apiFetch(`/data/instruments/${instrumentId}/cancel`, { method: 'POST' });
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
    await apiFetch('/data/instrument-status/recompute', {
      method: 'POST',
      body: JSON.stringify(instrumentId ? { instrumentIds: [instrumentId] } : {}),
    });
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }
  revalidatePath('/instruments');
  redirect(`${returnTo}?recomputed=1`);
}
