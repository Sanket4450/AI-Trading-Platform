import { apiFetch } from '@/lib/api';
import type { SystemIssue } from '@/lib/types';
import { backLinkFor, type DetailSearchParams } from '@/lib/navigation';
import { IssueDetailView } from '@/features/issues/components/issue-detail-view';

export default async function IssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ issueId: string }>;
  searchParams: DetailSearchParams;
}) {
  const { issueId } = await params;
  const { from: fromParam } = await searchParams;
  const back = backLinkFor(fromParam, '/issues');
  const issue = await apiFetch<SystemIssue>(`/issues/${issueId}`);

  return <IssueDetailView issue={issue} back={back} />;
}
