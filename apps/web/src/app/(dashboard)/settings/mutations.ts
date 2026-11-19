'use client';

import { apiRequest } from '@/lib/api-browser';
import { apiErrorMessage } from '@/lib/api-error';
import { formString } from '@/lib/form';
import { useFormMutation } from '@/lib/use-form-mutation';
import type { ConfigurationVersion } from '@/lib/types';

export function useUpdateSetting() {
  return useFormMutation<void>((formData) => {
    const key = formString(formData, 'key');
    const valueText = formString(formData, 'value');
    const description = formString(formData, 'description');

    return {
      request: async () => {
        let value: unknown;
        try {
          value = JSON.parse(valueText);
        } catch {
          throw new Error(`${key}: value must be valid JSON`);
        }
        await apiRequest(`/settings/${encodeURIComponent(key)}`, {
          method: 'PATCH',
          body: { value, ...(description ? { description } : {}) },
        });
      },
      successUrl: () => '/settings?saved=1',
      errorUrl: (error) => `/settings?error=${encodeURIComponent(apiErrorMessage(error))}`,
    };
  });
}

export function useCreateConfiguration() {
  return useFormMutation<ConfigurationVersion>((formData) => {
    const configType = formString(formData, 'configType');
    const scopeKey = formString(formData, 'scopeKey');
    const schemaVersion = formString(formData, 'schemaVersion', '1.0.0');
    const effectiveFrom = formString(formData, 'effectiveFrom');
    const effectiveTo = formString(formData, 'effectiveTo');
    const supersedesId = formString(formData, 'supersedesId');
    const payloadText = formString(formData, 'payload');

    return {
      request: async () => {
        let payload: unknown;
        try {
          payload = JSON.parse(payloadText);
        } catch {
          throw new Error('Payload must be valid JSON');
        }
        return apiRequest<ConfigurationVersion>('/configuration', {
          method: 'POST',
          body: {
            configType,
            scopeKey,
            schemaVersion,
            payload,
            effectiveFrom: new Date(effectiveFrom).toISOString(),
            ...(effectiveTo ? { effectiveTo: new Date(effectiveTo).toISOString() } : {}),
            ...(supersedesId ? { supersedesId } : {}),
          },
        });
      },
      successUrl: (created) => `/settings?version=${created.id}&created=1`,
      errorUrl: (error) => `/settings?error=${encodeURIComponent(apiErrorMessage(error))}`,
    };
  });
}

export function useBindConfiguration(configurationId: string) {
  return useFormMutation<void>((formData) => {
    const strategyVersionId = formString(formData, 'strategyVersionId');
    const role = formString(formData, 'role', 'parameters');

    return {
      request: () =>
        apiRequest(`/configuration/${configurationId}/bind`, {
          method: 'POST',
          body: { strategyVersionId, role },
        }),
      successUrl: () => `/settings?version=${configurationId}&bound=1`,
      errorUrl: (error) =>
        `/settings?version=${configurationId}&error=${encodeURIComponent(apiErrorMessage(error))}`,
    };
  });
}
