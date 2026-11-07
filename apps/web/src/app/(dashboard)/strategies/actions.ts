'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorMessage, apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';

function strategiesPath(strategyId: string, flag: string, value: string): string {
  const path = strategyId ? `/strategies/${strategyId}` : '/strategies';
  return `${path}?${new URLSearchParams({ [flag]: value }).toString()}`;
}

export async function createStrategyVersionAction(formData: FormData): Promise<void> {
  const strategyId = formString(formData, 'strategyId', '');
  const codeRef = formString(formData, 'codeRef', '');
  const changelog = formString(formData, 'changelog', '');
  const schemaText = formString(formData, 'parameterSchema', '');

  if (!strategyId || !codeRef || !schemaText) {
    redirect(
      strategiesPath(
        strategyId,
        'error',
        'Strategy, code reference and parameter schema are required',
      ),
    );
  }

  let parameterSchema: unknown;
  try {
    parameterSchema = JSON.parse(schemaText);
  } catch {
    redirect(strategiesPath(strategyId, 'error', 'Parameter schema must be valid JSON'));
  }

  try {
    await apiFetch(`/strategies/${strategyId}/versions`, {
      method: 'POST',
      body: JSON.stringify({
        codeRef,
        parameterSchema,
        ...(changelog ? { changelog } : {}),
      }),
    });
  } catch (error) {
    redirect(strategiesPath(strategyId, 'error', apiErrorMessage(error)));
  }

  revalidatePath('/strategies');
  redirect(strategiesPath(strategyId, 'versionCreated', '1'));
}
