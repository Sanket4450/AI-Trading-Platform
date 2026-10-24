import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  healthy: 'border-primary/30 bg-primary/10 text-primary',
  ok: 'border-primary/30 bg-primary/10 text-primary',
  complete: 'border-primary/30 bg-primary/10 text-primary',
  succeeded: 'border-primary/30 bg-primary/10 text-primary',
  active: 'border-primary/30 bg-primary/10 text-primary',
  open: 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]',
  partial: 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]',
  degraded: 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]',
  running: 'border-[#38d9f5]/30 bg-[#38d9f5]/10 text-[#38d9f5]',
  queued: 'border-[#38d9f5]/30 bg-[#38d9f5]/10 text-[#38d9f5]',
  missing: 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]',
  failed: 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]',
  unhealthy: 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]',
  critical: 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]',
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
