'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';
import type { ConfigurationVersion } from '@/lib/types';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed';
}

export async function createConfigurationAction(formData: FormData): Promise<void> {
  const configType = formString(formData, 'configType', '');
  const scopeKey = formString(formData, 'scopeKey', '');
  const schemaVersion = formString(formData, 'schemaVersion', '1.0.0');
  const effectiveFrom = formString(formData, 'effectiveFrom', '');
  const effectiveTo = formString(formData, 'effectiveTo', '');
  const supersedesId = formString(formData, 'supersedesId', '');
  const payloadText = formString(formData, 'payload', '');

  let payload: unknown;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    redirect(`/configuration?error=${encodeURIComponent('Payload must be valid JSON')}`);
  }

  let created: ConfigurationVersion | null = null;
  try {
    created = await apiFetch<ConfigurationVersion>('/configuration', {
      method: 'POST',
      body: JSON.stringify({
        configType,
        scopeKey,
        schemaVersion,
        payload,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        ...(effectiveTo ? { effectiveTo: new Date(effectiveTo).toISOString() } : {}),
        ...(supersedesId ? { supersedesId } : {}),
      }),
    });
  } catch (error) {
    redirect(`/configuration?error=${encodeURIComponent(messageOf(error))}`);
  }

  revalidatePath('/configuration');
  redirect(`/configuration?config=${created.id}&created=1`);
}

export async function bindConfigurationAction(formData: FormData): Promise<void> {
  const configurationId = formString(formData, 'configurationId', '');
  const strategyVersionId = formString(formData, 'strategyVersionId', '');
  const role = formString(formData, 'role', 'parameters');

  try {
    await apiFetch(`/configuration/${configurationId}/bind`, {
      method: 'POST',
      body: JSON.stringify({ strategyVersionId, role }),
    });
  } catch (error) {
    redirect(
      `/configuration?config=${configurationId}&error=${encodeURIComponent(messageOf(error))}`,
    );
  }

  revalidatePath('/configuration');
  redirect(`/configuration?config=${configurationId}&bound=1`);
}
