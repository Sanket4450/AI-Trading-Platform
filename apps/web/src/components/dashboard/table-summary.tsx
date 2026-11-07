import { statToneClasses, type StatTone } from '@/components/dashboard/stat-card';
import { cn } from '@/lib/utils';

export interface TableSummaryItem {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: StatTone;
}

/** Compact, card-less metric strip that sits at the top-left of a table. */
export function TableSummary({
  items,
  className,
}: {
  items: readonly TableSummaryItem[];
  className?: string;
}) {
  return (
    <dl className={cn('flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn('flex min-w-0 flex-col', index > 0 && 'border-border/60 border-l pl-4')}
        >
          <dt className="text-muted-foreground text-[9px] font-medium uppercase tracking-[0.16em]">
            {item.label}
          </dt>
          <dd
            className={cn(
              'truncate text-sm font-semibold leading-tight tracking-tight',
              statToneClasses[item.tone ?? 'default'],
            )}
            title={item.hint}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
