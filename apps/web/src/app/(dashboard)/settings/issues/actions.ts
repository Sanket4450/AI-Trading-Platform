'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorMessage, apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';

export async function acknowledgeIssueAction(formData: FormData): Promise<void> {
  const issueId = formString(formData, 'issueId', '');
  const status = formString(formData, 'status', 'acknowledged');
  const note = formString(formData, 'note', '');
  const returnTo = formString(
    formData,
    'returnTo',
    `/settings/issues/${issueId}`,
  );

  try {
    await apiFetch(`/settings/issues/${issueId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ status, note: note || undefined }),
    });
  } catch (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }

  revalidatePath('/settings');
  revalidatePath(`/settings/issues/${issueId}`);
  redirect(`${returnTo}?ack=1`);
}
