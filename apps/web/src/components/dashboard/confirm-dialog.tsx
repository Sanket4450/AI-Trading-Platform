'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
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
import { SubmitButton } from '@/components/dashboard/submit-button';
import { cn } from '@/lib/utils';

/**
 * Confirmation step for a direct server action. The dialog owns the form so a row action can
 * never fire on a single click; on submit it closes and the redirect plus toast report the result.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  details,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  action,
  hiddenFields,
  className,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  details?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string | number | undefined>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn('sm:max-w-md', className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className={cn(
                'size-4 shrink-0',
                tone === 'destructive' ? 'text-destructive' : 'text-warning-strong',
              )}
            />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {details ? <div className="text-muted-foreground text-xs">{details}</div> : null}
        <form action={action} onSubmit={() => setOpen(false)}>
          {Object.entries(hiddenFields ?? {}).map(([name, value]) =>
            value === undefined ? null : (
              <input key={name} type="hidden" name={name} value={String(value)} />
            ),
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {cancelLabel}
            </Button>
            <SubmitButton variant={tone === 'destructive' ? 'destructive' : 'default'}>
              {confirmLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
