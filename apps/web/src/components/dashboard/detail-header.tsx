import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { BackLink } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Detail-page status strip. The back link is always first and always the same shape, so every
 * drill-down returns to its origin page with the filter state it was opened from.
 */
export function DetailHeader({
  back,
  badges,
  meta,
  links = [],
  actions,
  className,
}: {
  back: BackLink;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  links?: Array<{ href: string; label: string }>;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border/70 bg-card/40 mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-2 py-2',
        className,
      )}
    >
      <Link
        href={back.href}
        className={buttonVariants({
          variant: 'ghost',
          size: 'sm',
          className: 'text-muted-foreground',
        })}
      >
        <ArrowLeft className="size-4" />
        {back.label}
      </Link>
      <span className="bg-border/70 h-4 w-px" aria-hidden />
      {badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
      {meta ? <span className="text-muted-foreground text-xs">{meta}</span> : null}
      {links.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-primary-strong text-xs hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
      {actions ? (
        <div className="ml-auto flex flex-wrap items-center gap-1.5">{actions}</div>
      ) : null}
    </div>
  );
}
