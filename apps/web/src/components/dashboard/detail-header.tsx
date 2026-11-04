import { cn } from '@/lib/utils';

/** Detail-page status strip: badges first, context after, actions pinned right. */
export function DetailHeader({
  badges,
  meta,
  actions,
  className,
}: {
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border/70 bg-card/40 mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2',
        className,
      )}
    >
      {badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
      {meta ? <span className="text-muted-foreground text-xs">{meta}</span> : null}
      {actions ? (
        <div className="ml-auto flex flex-wrap items-center gap-1.5">{actions}</div>
      ) : null}
    </div>
  );
}
