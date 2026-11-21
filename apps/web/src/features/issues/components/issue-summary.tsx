import Link from 'next/link';
import type { SystemIssue } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { label } from '@/lib/labels';
import { detailHref } from '@/lib/navigation';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { issueWindow } from '../issue-format';

type IssueSummaryRow = Pick<
  SystemIssue,
  'id' | 'source' | 'kind' | 'severity' | 'symbol' | 'occurrenceCount' | 'lastSeenAt' | 'payload'
>;

/** Compact row used on the overview, instrument detail and coverage-day surfaces. */
export function IssueSummary({ issue, from }: { issue: IssueSummaryRow; from: string }) {
  const window = issueWindow(issue.payload);

  return (
    <Link
      href={detailHref(`/issues/${issue.id}`, from)}
      className="border-border/70 bg-background/40 block rounded-lg border p-3 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{label(issue.kind)}</span>
        <StatusBadge status={issue.severity} />
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {issue.symbol ?? label(issue.source)} · {window ?? 'No window'} · seen{' '}
        {issue.occurrenceCount}× · last {formatDateTime(issue.lastSeenAt)}
      </p>
    </Link>
  );
}
