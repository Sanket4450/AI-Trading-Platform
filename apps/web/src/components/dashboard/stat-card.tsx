import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const statToneClasses = {
  default: 'text-foreground',
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning-strong',
  danger: 'text-destructive',
  highlight: 'text-highlight',
} as const;

export type StatTone = keyof typeof statToneClasses;

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <Card size="sm" className="border-border/70 bg-card/60">
      <CardContent>
        <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.16em]">
          {label}
        </p>
        <p
          className={cn(
            'mt-1 text-xl font-semibold leading-none tracking-tight',
            statToneClasses[tone],
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="text-muted-foreground mt-1 truncate text-[11px]" title={hint}>
            {hint}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export const statGridColumnClasses = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 xl:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
  5: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
} as const;

export type StatGridColumns = keyof typeof statGridColumnClasses;

/** Keeps every page's summary row on the same compact rhythm. */
export function StatGrid({
  columns = 4,
  className,
  children,
}: {
  columns?: StatGridColumns;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('grid auto-rows-fr gap-3', statGridColumnClasses[columns], className)}>
      {children}
    </div>
  );
}
