import { cn } from '@/lib/utils';

const columnClasses = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 xl:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
} as const;

export interface KeyValueItem {
  label: string;
  value: React.ReactNode;
  title?: string;
}

/** Shared label/value block for provider state, run details and evidence summaries. */
export function KeyValueGrid({
  items,
  columns = 2,
  className,
}: {
  items: KeyValueItem[];
  columns?: keyof typeof columnClasses;
  className?: string;
}) {
  return (
    <dl className={cn('grid gap-3 text-sm', columnClasses[columns], className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-muted-foreground text-xs">{item.label}</dt>
          <dd className="mt-0.5 break-words" title={item.title}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
