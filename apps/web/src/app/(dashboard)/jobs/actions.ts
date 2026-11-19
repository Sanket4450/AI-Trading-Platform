'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorMessage, apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';

export async function cancelPlanAction(formData: FormData): Promise<void> {
  const jobId = formString(formData, 'jobId', '');
  const returnTo = formString(formData, 'returnTo', `/jobs/${jobId}`);
  try {
    await apiFetch(`/jobs/${jobId}/cancel`, { method: 'POST' });
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }
  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);
  redirect(`${returnTo}?cancelled=1`);
}
