import { apiFetch } from '@/lib/api';
import type { QualityIssue } from '@/lib/types';
import { backLinkFor, type DetailSearchParams } from '@/lib/navigation';
import { IssueDetailView } from '@/features/data-quality/components/issue-detail-view';
import { acknowledgeIssueAction } from '../actions';

export default async function InstrumentIssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ issueId: string }>;
  searchParams: DetailSearchParams;
}) {
  const { issueId } = await params;
  const { from: fromParam } = await searchParams;
  const back = backLinkFor(fromParam, '/instruments');
  const issue = await apiFetch<QualityIssue>(`/instruments/issues/${issueId}`);

  return (
    <IssueDetailView
      issue={issue}
      back={back}
      returnTo={`/instruments/issues/${issueId}`}
      action={acknowledgeIssueAction}
    />
  );
}
