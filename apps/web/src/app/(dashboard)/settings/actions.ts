'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';

export async function updateSettingAction(formData: FormData): Promise<void> {
  const key = formString(formData, 'key', '');
  const valueText = formString(formData, 'value', '');
  const description = formString(formData, 'description', '');

  let value: unknown;
  try {
    value = JSON.parse(valueText);
  } catch {
    redirect(`/settings?error=${encodeURIComponent(`${key}: value must be valid JSON`)}`);
  }

  try {
    await apiFetch(`/settings/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify({ value, ...(description ? { description } : {}) }),
    });
  } catch (error) {
    redirect(
      `/settings?error=${encodeURIComponent(
        `${key}: ${error instanceof Error ? error.message : 'update failed'}`,
      )}`,
    );
  }

  revalidatePath('/settings');
  redirect('/settings?saved=1');
}
