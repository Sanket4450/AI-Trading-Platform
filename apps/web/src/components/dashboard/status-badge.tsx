import { Badge } from '@/components/ui/badge';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  healthy: 'border-success/30 bg-success/10 text-success',
  ok: 'border-success/30 bg-success/10 text-success',
  complete: 'border-success/30 bg-success/10 text-success',
  succeeded: 'border-success/30 bg-success/10 text-success',
  fetched: 'border-success/30 bg-success/10 text-success',
  partial_reconciled: 'border-warning/30 bg-warning/10 text-warning-strong',
  active: 'border-success/30 bg-success/10 text-success',
  open: 'border-warning/30 bg-warning/10 text-warning-strong',
  partial: 'border-warning/30 bg-warning/10 text-warning-strong',
  partial_mismatch: 'border-destructive/30 bg-destructive/10 text-destructive',
  needs_review: 'border-destructive/30 bg-destructive/10 text-destructive',
  degraded: 'border-warning/30 bg-warning/10 text-warning-strong',
  running: 'border-info/30 bg-info/10 text-info',
  fetching: 'border-info/30 bg-info/10 text-info',
  queued: 'border-info/30 bg-info/10 text-info',
  verifying: 'border-info/30 bg-info/10 text-info',
  pending: 'border-info/30 bg-info/10 text-info',
  missing: 'border-destructive/30 bg-destructive/10 text-destructive',
  failed: 'border-destructive/30 bg-destructive/10 text-destructive',
  cancelled: 'border-destructive/30 bg-destructive/10 text-destructive',
  unhealthy: 'border-destructive/30 bg-destructive/10 text-destructive',
  critical: 'border-destructive/30 bg-destructive/10 text-destructive',
  stale: 'border-warning/30 bg-warning/10 text-warning-strong',
  not_requested: 'border-muted/30 bg-muted/10 text-muted-foreground',
  not_applicable: 'border-muted/30 bg-muted/10 text-muted-foreground',
  warning: 'border-warning/30 bg-warning/10 text-warning-strong',
  info: 'border-info/30 bg-info/10 text-info',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn(styles[status] ?? '')}>
      {label(status)}
    </Badge>
  );
}
