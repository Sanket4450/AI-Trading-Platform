import type { SystemIssue } from '@/lib/types';
import { EmptyState } from '@/components/dashboard/empty-state';
import { IssueSummary } from './issue-summary';

export function IssueList({
  issues,
  from,
  emptyTitle = 'No issues',
  emptyDescription = 'No active problem is recorded.',
}: {
  issues: SystemIssue[];
  from: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (issues.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {issues.map((issue) => (
        <IssueSummary key={issue.id} issue={issue} from={from} />
      ))}
    </div>
  );
}
