'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition, type ComponentProps, type ReactNode } from 'react';
import { Eye, Pencil, RefreshCw, RotateCcw, Trash2, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { SubmitButton } from '@/components/dashboard/submit-button';
import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type TableActionTone = 'view' | 'edit' | 'refresh' | 'destructive' | 'neutral';

const toneClasses: Record<TableActionTone, string> = {
  view: 'text-info hover:bg-info/10 hover:text-info',
  edit: 'text-warning-strong hover:bg-warning/10 hover:text-warning-strong',
  refresh: 'text-success hover:bg-success/10 hover:text-success',
  destructive: 'text-destructive hover:bg-destructive/10 hover:text-destructive',
  neutral: 'text-muted-foreground hover:bg-muted hover:text-foreground',
};

/**
 * Icons are referenced by name, not by component, so server components can choose one
 * without passing a non-serializable value across the client boundary.
 */
export type TableActionIcon = 'view' | 'edit' | 'delete' | 'cancel' | 'refresh' | 'retry';

const actionIcons: Record<TableActionIcon, LucideIcon> = {
  view: Eye,
  edit: Pencil,
  delete: Trash2,
  cancel: X,
  refresh: RefreshCw,
  retry: RotateCcw,
};

/**
 * The trailing, title-less table cell. Every table uses it so row actions share one alignment,
 * spacing and icon treatment.
 */
export function TableActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <TableCell className={cn('w-px py-1 text-right', className)}>
      <div className="flex items-center justify-end gap-0.5">{children}</div>
    </TableCell>
  );
}

type TableActionButtonProps = ComponentProps<typeof Button> & {
  icon?: TableActionIcon;
  label: string;
  tone?: TableActionTone;
};

/** Icon-only row action used as a dialog trigger or a one-off control. */
export function TableActionButton({
  icon = 'view',
  label,
  tone = 'view',
  className,
  ...props
}: TableActionButtonProps) {
  const Icon = actionIcons[icon];

  return (
    <InfoTooltip content={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        className={cn('size-7', toneClasses[tone], className)}
        {...props}
      >
        <Icon className="size-4" />
      </Button>
    </InfoTooltip>
  );
}

/** Icon link for row actions that open a dedicated page. */
export function TableActionLink({
  href,
  icon = 'view',
  label,
  tone = 'view',
}: {
  href: string;
  icon?: TableActionIcon;
  label: string;
  tone?: TableActionTone;
}) {
  const Icon = actionIcons[icon];

  return (
    <InfoTooltip content={label}>
      <Button asChild variant="ghost" size="icon-sm" className={cn('size-7', toneClasses[tone])}>
        <Link href={href} aria-label={label}>
          <Icon className="size-4" />
        </Link>
      </Button>
    </InfoTooltip>
  );
}

/** Icon submit button for a row-level server action such as fetch, retry or cancel. */
export function TableActionSubmit({
  icon = 'refresh',
  label,
  tone = 'refresh',
  className,
  ...props
}: ComponentProps<typeof SubmitButton> & {
  icon?: TableActionIcon;
  label: string;
  tone?: TableActionTone;
}) {
  const Icon = actionIcons[icon];

  return (
    <InfoTooltip content={label}>
      <SubmitButton
        size="icon-sm"
        variant="ghost"
        aria-label={label}
        pendingLabel=""
        className={cn('size-7', toneClasses[tone], className)}
        {...props}
      >
        <Icon className="size-4" />
      </SubmitButton>
    </InfoTooltip>
  );
}

export function TableActionEdit(props: Omit<TableActionButtonProps, 'icon' | 'label' | 'tone'>) {
  return <TableActionButton icon="edit" label="Edit" tone="edit" {...props} />;
}

export function TableActionDelete(props: Omit<TableActionButtonProps, 'icon' | 'label' | 'tone'>) {
  return <TableActionButton icon="delete" label="Delete" tone="destructive" {...props} />;
}

export function TableActionCancel(props: Omit<TableActionButtonProps, 'icon' | 'label' | 'tone'>) {
  return <TableActionButton icon="cancel" label="Cancel" tone="destructive" {...props} />;
}

/** Table-level fallback that re-runs the server render for the current route. */
export function TableRefreshButton({ label = 'Refresh table' }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <InfoTooltip content={label}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={label}
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RefreshCw className={cn('size-4', pending && 'animate-spin')} />
      </Button>
    </InfoTooltip>
  );
}
