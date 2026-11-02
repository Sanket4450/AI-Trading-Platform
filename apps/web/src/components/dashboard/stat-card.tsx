import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const tones = {
  default: 'text-foreground',
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  danger: 'text-destructive',
  highlight: 'text-highlight',
} as const;

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: keyof typeof tones;
}) {
  return (
    <Card className="border-border/70 bg-card/60">
      <CardContent className="p-4">
        <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.16em]">
          {label}
        </p>
        <p className={cn('mt-2 text-2xl font-semibold tracking-tight', tones[tone])}>{value}</p>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
