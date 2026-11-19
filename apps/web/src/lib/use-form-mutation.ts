'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UnauthorizedError } from './api-error';

export interface FormMutation<Result> {
  request: () => Promise<Result>;
  successUrl: (result: Result) => string;
  errorUrl: (error: unknown) => string;
}

/**
 * Browser replacement for a redirecting server action: performs the request, then navigates to
 * the success or error URL so `ActionToast` reports the outcome exactly as before.
 */
export function useFormMutation<Result = void>(
  build: (formData: FormData) => FormMutation<Result>,
): (formData: FormData) => Promise<void> {
  const router = useRouter();

  return useCallback(
    async (formData: FormData) => {
      const { request, successUrl, errorUrl } = build(formData);

      let result: Result;
      try {
        result = await request();
      } catch (error) {
        // The session-expired redirect is already in flight; navigating again would race it.
        if (error instanceof UnauthorizedError) return;
        router.replace(errorUrl(error));
        return;
      }

      router.replace(successUrl(result));
    },
    [build, router],
  );
}
