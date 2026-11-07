import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Full-height table shell for list pages. The summary sits top-left, filters and actions sit
 * top-right, and only the rows scroll — the header stays visible.
 */
export function TableCard({
  summary,
  filters,
  actions,
  children,
  className,
}: {
  summary: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex min-h-0 flex-col gap-0 overflow-hidden py-0', className)}>
      <div className="border-border/70 flex shrink-0 flex-col gap-2 border-b px-3 py-2.5 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
        <div className="min-w-0 xl:flex-1">{summary}</div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
          {filters}
          {actions}
        </div>
      </div>
      <CardContent className="min-h-0 flex-1 overflow-hidden p-0">{children}</CardContent>
    </Card>
  );
}
