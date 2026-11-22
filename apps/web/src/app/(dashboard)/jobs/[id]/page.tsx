import { apiFetch } from '@/lib/api';
import { PAGINATION_DEFAULT_LIMIT } from '@ai-trading/domain';
import type { ExternalApiCallPage, JobDetail } from '@/lib/types';
import { label } from '@/lib/labels';
import { backLinkFor, type DetailSearchParams } from '@/lib/navigation';
import { PageMeta } from '@/components/shell/page-meta';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { JobLiveDetail } from '@/features/jobs/components/job-live-detail';

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: DetailSearchParams;
}) {
  const { id } = await params;
  const { from: fromParam } = await searchParams;
  const back = backLinkFor(fromParam, '/jobs');
  const [detail, apiCalls] = await Promise.all([
    apiFetch<JobDetail>(`/jobs/${id}`),
    apiFetch<ExternalApiCallPage>(`/jobs/${id}/api-calls?limit=${PAGINATION_DEFAULT_LIMIT}`),
  ]);
  const run = detail.run;

  return (
    <div>
      <PageMeta
        title={`Job · ${label(run.jobName)}`}
        description="Live progress, stage facts and final outcome for this job run."
      />

      <DetailHeader
        back={back}
        badges={<StatusBadge status={run.status} />}
        meta={`${label(run.jobName)} · ${label(run.queueName)} · attempt ${run.attempt}/${run.maxAttempts}`}
      />

      <SectionCard
        className="mt-4"
        title="Live run"
        description="The page updates from the event stream while the job is active."
      >
        <JobLiveDetail initial={detail} apiCalls={apiCalls} />
      </SectionCard>
    </div>
  );
}
