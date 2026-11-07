'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorMessage, apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';
import type { ConfigurationVersion } from '@/lib/types';

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
    redirect(`/settings?error=${encodeURIComponent('Payload must be valid JSON')}`);
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
    redirect(`/settings?error=${encodeURIComponent(apiErrorMessage(error))}`);
  }

  revalidatePath('/settings');
  redirect(`/settings?version=${created.id}&created=1`);
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
      `/settings?version=${configurationId}&error=${encodeURIComponent(apiErrorMessage(error))}`,
    );
  }

  revalidatePath('/settings');
  redirect(`/settings?version=${configurationId}&bound=1`);
}
