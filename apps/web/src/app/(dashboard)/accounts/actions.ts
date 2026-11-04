'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorMessage, apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';

function accountsPath(accountId: string, flag: string, value: string): string {
  const query = new URLSearchParams();
  if (accountId) query.set('account', accountId);
  query.set(flag, value);
  return `/accounts?${query.toString()}`;
}

export async function rotateCredentialAction(formData: FormData): Promise<void> {
  const accountId = formString(formData, 'accountId', '');
  const providerId = formString(formData, 'providerId', '');
  const credentialType = formString(formData, 'credentialType', '');
  const value = formString(formData, 'value', '');
  const expiresAt = formString(formData, 'expiresAt', '');

  if (!accountId || !providerId || !credentialType || !value) {
    redirect(
      accountsPath(accountId, 'error', 'Account, provider, credential type and value are required'),
    );
  }

  try {
    await apiFetch(`/accounts/${accountId}/credentials`, {
      method: 'POST',
      body: JSON.stringify({
        providerId,
        credentialType,
        value,
        ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      }),
    });
  } catch (error) {
    redirect(accountsPath(accountId, 'error', apiErrorMessage(error)));
  }

  revalidatePath('/accounts');
  redirect(accountsPath(accountId, 'credentialSaved', '1'));
}
