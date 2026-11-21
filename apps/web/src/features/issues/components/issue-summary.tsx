import { formatDateTime } from '@/lib/format';
import { label } from '@/lib/labels';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { IssueDialog } from './issue-dialog';
import { issuePreview, issueWindow, type IssueSummaryRow } from '../issue-format';

/** Compact row used on the overview, instrument detail and coverage-day surfaces. */
export function IssueSummary({
  issue,
  from,
  currentInstrumentId,
}: {
  issue: IssueSummaryRow;
  from: string;
  currentInstrumentId?: string | null;
}) {
  const window = issueWindow(issue.payload);

  return (
    <div className="border-border/70 bg-background/40 flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{label(issue.kind)}</span>
          <StatusBadge status={issue.severity} />
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {issue.symbol ?? label(issue.source)} · {window ?? 'No window'}
          {issue.occurrenceCount !== undefined ? ` · seen ${issue.occurrenceCount}×` : null} · last{' '}
          {formatDateTime(issue.lastSeenAt)}
        </p>
      </div>
      <IssueDialog
        issue={issuePreview(issue)}
        from={from}
        currentInstrumentId={currentInstrumentId}
      />
    </div>
  );
}
