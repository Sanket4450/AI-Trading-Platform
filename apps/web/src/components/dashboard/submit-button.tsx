'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SubmitButtonProps = ComponentProps<typeof Button> & {
  pendingLabel?: string;
};

/**
 * Submit button that disables itself and swaps to a spinner while its form's server action runs.
 */
export function SubmitButton({
  children,
  pendingLabel = 'Working…',
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button {...props} type="submit" disabled={pending || disabled} aria-busy={pending}>
      {pending ? (
        <>
          <LoaderCircle className="size-3.5 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
