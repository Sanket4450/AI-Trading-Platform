'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorMessage, apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';
import type { JobRun } from '@/lib/types';

export async function refreshMaterializedViewAction(): Promise<void> {
  let job: JobRun | null = null;
  try {
    job = await apiFetch<JobRun>('/data/refresh-materialized-view', { method: 'POST' });
  } catch (error) {
    redirect(`/data?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }

  revalidatePath('/data');
  redirect(`/data?job=${job.id}`);
}

export async function acknowledgeIssueAction(formData: FormData): Promise<void> {
  const issueId = formString(formData, 'issueId', '');
  const status = formString(formData, 'status', 'acknowledged');
  const note = formString(formData, 'note', '');
  const returnTo = formString(formData, 'returnTo', '/data');

  try {
    await apiFetch(`/data/quality-issues/${issueId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ status, note: note || undefined }),
    });
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }

  revalidatePath('/data');
  revalidatePath(`/data/issues/${issueId}`);
  redirect(`${returnTo}?ack=1`);
}

export async function cancelPlanAction(formData: FormData): Promise<void> {
  const planId = formString(formData, 'planId', '');
  const returnTo = formString(formData, 'returnTo', `/data/backfills/${planId}`);
  try {
    await apiFetch(`/data/backfill-plans/${planId}/cancel`, { method: 'POST' });
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }
  revalidatePath('/data');
  revalidatePath(`/data/backfills/${planId}`);
  redirect(`${returnTo}?cancelled=1`);
}

export async function syncInstrumentsAction(): Promise<void> {
  let job: JobRun | null = null;
  try {
    job = await apiFetch<JobRun>('/data/reference/instrument-sync', { method: 'POST' });
  } catch (error) {
    redirect(`/data?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }
  revalidatePath('/data');
  redirect(`/data?job=${job.id}`);
}

export async function syncCalendarAction(): Promise<void> {
  let job: JobRun | null = null;
  try {
    job = await apiFetch<JobRun>('/data/reference/calendar-sync', { method: 'POST' });
  } catch (error) {
    redirect(`/data?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }
  revalidatePath('/data');
  redirect(`/data?job=${job.id}`);
}

export async function importCorporateActionsAction(formData: FormData): Promise<void> {
  const csv = formString(formData, 'csv', '');
  const source = formString(formData, 'source', 'reviewed-csv');
  const dryRun = formString(formData, 'dryRun', 'true') === 'true';
  try {
    await apiFetch('/data/reference/corporate-actions/import', {
      method: 'POST',
      body: JSON.stringify({ csv, source, dryRun }),
    });
  } catch (error) {
    redirect(`/data?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }
  revalidatePath('/data');
  redirect(`/data?${dryRun ? 'previewed' : 'imported'}=1`);
}
