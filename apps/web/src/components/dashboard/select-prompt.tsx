import { MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Shown in place of a detail panel until the operator picks a primary entry. */
export function SelectPrompt({
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
        'border-border/80 bg-card/30 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-5 py-10 text-center',
        className,
      )}
    >
      <MousePointerClick className="text-muted-foreground size-5" />
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-muted-foreground max-w-md text-xs">{description}</p> : null}
    </div>
  );
}
