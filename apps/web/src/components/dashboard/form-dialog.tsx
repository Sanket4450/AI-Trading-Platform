'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * One dialog shape for every write form. The dialog closes on submit so the server action's
 * redirect and toast are the only visible result.
 */
export function FormDialog({
  trigger,
  title,
  description,
  submitLabel,
  action,
  children,
  className,
  submitVariant = 'default',
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  submitLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
  submitVariant?: 'default' | 'outline' | 'destructive';
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn('sm:max-w-lg', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          action={action}
          onSubmit={() => setOpen(false)}
          className="max-h-[70vh] space-y-3 overflow-y-auto"
        >
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={submitVariant}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
