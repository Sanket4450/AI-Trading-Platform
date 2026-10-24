'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';

export async function rotateCredentialAction(formData: FormData): Promise<void> {
  const accountId = formString(formData, 'accountId', '');
  const providerId = formString(formData, 'providerId', '');
  const credentialType = formString(formData, 'credentialType', '');
  const value = formString(formData, 'value', '');
  const expiresAt = formString(formData, 'expiresAt', '');

  if (!accountId || !providerId || !credentialType || !value) {
    throw new Error('Account, provider, credential type and value are required');
  }

  await apiFetch(`/accounts/${accountId}/credentials`, {
    method: 'POST',
    body: JSON.stringify({
      providerId,
      credentialType,
      value,
      ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
    }),
  });

  revalidatePath('/accounts');
}
