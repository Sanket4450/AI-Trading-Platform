import { EmptyState } from '@/components/dashboard/empty-state';
import { cn } from '@/lib/utils';
import { IssueSummary } from './issue-summary';
import type { IssueSummaryRow } from '../issue-format';

export function IssueList({
  issues,
  from,
  currentInstrumentId,
  emptyTitle = 'No issues',
  emptyDescription = 'No active problem is recorded.',
  className,
}: {
  issues: IssueSummaryRow[];
  from: string;
  currentInstrumentId?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  if (issues.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={cn('grid gap-2 sm:grid-cols-2', className)}>
      {issues.map((issue) => (
        <IssueSummary
          key={issue.id}
          issue={issue}
          from={from}
          currentInstrumentId={currentInstrumentId}
        />
      ))}
    </div>
  );
}
