'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';
import type { JobRun } from '@/lib/types';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed';
}

export async function backfillAction(formData: FormData): Promise<void> {
  const instrumentId = formString(formData, 'instrumentId', '');
  const from = formString(formData, 'from', '');
  const to = formString(formData, 'to', '');

  let job: JobRun | null = null;
  try {
    job = await apiFetch<JobRun>('/data/backfill', {
      method: 'POST',
      body: JSON.stringify({ instrumentId, from, to }),
    });
  } catch (error) {
    redirect(`/data?error=${encodeURIComponent(messageOf(error))}`);
  }

  revalidatePath('/data');
  redirect(`/data?job=${job.id}`);
}

export async function refreshMaterializedViewAction(): Promise<void> {
  let job: JobRun | null = null;
  try {
    job = await apiFetch<JobRun>('/data/refresh-materialized-view', { method: 'POST' });
  } catch (error) {
    redirect(`/data?error=${encodeURIComponent(messageOf(error))}`);
  }

  revalidatePath('/data');
  redirect(`/data?job=${job.id}`);
}

export async function acknowledgeIssueAction(formData: FormData): Promise<void> {
  const issueId = formString(formData, 'issueId', '');
  const status = formString(formData, 'status', 'acknowledged');

  try {
    await apiFetch(`/data/quality-issues/${issueId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  } catch (error) {
    redirect(`/data?error=${encodeURIComponent(messageOf(error))}`);
  }

  revalidatePath('/data');
  redirect('/data?ack=1');
}
