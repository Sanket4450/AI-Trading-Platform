'use client';

import { apiRequest } from '@/lib/api-browser';
import { apiErrorMessage } from '@/lib/api-error';
import { formString } from '@/lib/form';
import { useFormMutation } from '@/lib/use-form-mutation';

/** Instrument issues live under /instruments; provider-wide issues under /settings. */
export type IssueScope = 'instruments' | 'settings';

export function useAcknowledgeIssue(scope: IssueScope) {
  return useFormMutation<void>((formData) => {
    const issueId = formString(formData, 'issueId');
    const status = formString(formData, 'status', 'acknowledged');
    const note = formString(formData, 'note');
    const returnTo = formString(formData, 'returnTo');

    return {
      request: () =>
        apiRequest(`/${scope}/issues/${issueId}/acknowledge`, {
          method: 'POST',
          body: { status, note: note || undefined },
        }),
      successUrl: () => `${returnTo}?ack=1`,
      errorUrl: (error) => `${returnTo}?error=${encodeURIComponent(apiErrorMessage(error))}`,
    };
  });
}
