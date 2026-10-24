'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { formString } from '@/lib/form';

export async function createStrategyVersionAction(formData: FormData): Promise<void> {
  const strategyId = formString(formData, 'strategyId', '');
  const codeRef = formString(formData, 'codeRef', '');
  const changelog = formString(formData, 'changelog', '');
  const schemaText = formString(formData, 'parameterSchema', '');

  if (!strategyId || !codeRef || !schemaText) {
    throw new Error('Strategy, code reference and parameter schema are required');
  }

  let parameterSchema: unknown;
  try {
    parameterSchema = JSON.parse(schemaText);
  } catch {
    throw new Error('Parameter schema must be valid JSON');
  }

  await apiFetch(`/strategies/${strategyId}/versions`, {
    method: 'POST',
    body: JSON.stringify({
      codeRef,
      parameterSchema,
      ...(changelog ? { changelog } : {}),
    }),
  });

  revalidatePath('/strategies');
}
