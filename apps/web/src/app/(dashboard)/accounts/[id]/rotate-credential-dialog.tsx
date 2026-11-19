'use client';

import { KeyRound } from 'lucide-react';
import { apiRequest } from '@/lib/api-browser';
import { apiErrorMessage } from '@/lib/api-error';
import { formString } from '@/lib/form';
import { useFormMutation } from '@/lib/use-form-mutation';
import { label } from '@/lib/labels';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField, FormSelect } from '@/components/dashboard/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const credentialTypes = [
  'api_key',
  'api_secret',
  'access_token',
  'refresh_token',
  'totp_secret',
] as const;

function accountsPath(accountId: string, flag: string, value: string): string {
  const path = accountId ? `/accounts/${accountId}` : '/accounts';
  return `${path}?${new URLSearchParams({ [flag]: value }).toString()}`;
}

export function RotateCredentialDialog({
  accountId,
  providerId,
}: {
  accountId: string;
  providerId: string;
}) {
  const action = useFormMutation<void>((formData) => {
    const credentialType = formString(formData, 'credentialType');
    const value = formString(formData, 'value');
    const expiresAt = formString(formData, 'expiresAt');

    return {
      request: async () => {
        if (!credentialType || !value) {
          throw new Error('Provider, credential type and value are required');
        }
        await apiRequest(`/accounts/${accountId}/credentials`, {
          method: 'POST',
          body: {
            providerId,
            credentialType,
            value,
            ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
          },
        });
      },
      successUrl: () => accountsPath(accountId, 'credentialSaved', '1'),
      errorUrl: (error) => accountsPath(accountId, 'error', apiErrorMessage(error)),
    };
  });

  return (
    <FormDialog
      trigger={
        <Button type="button" size="sm" variant="outline">
          <KeyRound className="size-4" />
          Rotate credential
        </Button>
      }
      title="Rotate a credential"
      description="The API encrypts with AES-256-GCM and never returns the ciphertext or plaintext."
      submitLabel="Encrypt and store"
      action={action}
    >
      <FormField label="Credential type" htmlFor="credentialType">
        <FormSelect
          id="credentialType"
          name="credentialType"
          defaultValue="access_token"
          options={credentialTypes.map((type) => ({ value: type, label: label(type) }))}
        />
      </FormField>
      <FormField label="Expires at" htmlFor="expiresAt">
        <Input id="expiresAt" name="expiresAt" type="datetime-local" />
      </FormField>
      <FormField label="Secret value" htmlFor="value">
        <Input id="value" name="value" type="password" placeholder="Write-only" required />
      </FormField>
    </FormDialog>
  );
}
