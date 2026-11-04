import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border/80 bg-card/30 rounded-xl border border-dashed px-5 py-8 text-center',
        className,
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-muted-foreground mt-1 text-xs">{description}</p> : null}
    </div>
  );
}
