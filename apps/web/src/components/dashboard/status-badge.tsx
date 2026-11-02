import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  healthy: 'border-primary/30 bg-primary/10 text-primary',
  ok: 'border-primary/30 bg-primary/10 text-primary',
  complete: 'border-primary/30 bg-primary/10 text-primary',
  succeeded: 'border-primary/30 bg-primary/10 text-primary',
  fetched: 'border-primary/30 bg-primary/10 text-primary',
  partial_reconciled: 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]',
  active: 'border-primary/30 bg-primary/10 text-primary',
  open: 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]',
  partial: 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]',
  partial_mismatch: 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]',
  needs_review: 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]',
  degraded: 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]',
  running: 'border-[#38d9f5]/30 bg-[#38d9f5]/10 text-[#38d9f5]',
  fetching: 'border-[#38d9f5]/30 bg-[#38d9f5]/10 text-[#38d9f5]',
  queued: 'border-[#38d9f5]/30 bg-[#38d9f5]/10 text-[#38d9f5]',
  verifying: 'border-[#38d9f5]/30 bg-[#38d9f5]/10 text-[#38d9f5]',
  pending: 'border-[#38d9f5]/30 bg-[#38d9f5]/10 text-[#38d9f5]',
  missing: 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]',
  failed: 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]',
  cancelled: 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]',
  unhealthy: 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]',
  critical: 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]',
  stale: 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]',
  not_requested: 'border-muted/30 bg-muted/10 text-muted-foreground',
  not_applicable: 'border-muted/30 bg-muted/10 text-muted-foreground',
  warning: 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]',
  info: 'border-[#38d9f5]/30 bg-[#38d9f5]/10 text-[#38d9f5]',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('capitalize', styles[status] ?? '')}>
      {status.replaceAll('_', ' ')}
    </Badge>
  );
}
