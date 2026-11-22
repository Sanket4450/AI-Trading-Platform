import { apiFetch } from '@/lib/api';
import type { ExternalApiCallPage, JobDetail } from '@/lib/types';
import { label } from '@/lib/labels';
import { backLinkFor } from '@/lib/navigation';
import { readCursorValue, readLimit } from '@/lib/pagination';
import { PageMeta } from '@/components/shell/page-meta';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { JobLiveDetail } from '@/features/jobs/components/job-live-detail';

type JobDetailSearchParams = Promise<{
  from?: string | string[];
  service?: string | string[];
  outcome?: string | string[];
  limit?: string | string[];
  after?: string | string[];
  before?: string | string[];
}>;

function readList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: JobDetailSearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;
  const back = backLinkFor(query.from, '/jobs');

  const services = readList(query.service);
  const outcomes = readList(query.outcome);
  const limit = readLimit(query.limit);
  const after = readCursorValue(query.after);
  const before = readCursorValue(query.before);

  const apiCallQuery = new URLSearchParams();
  for (const service of services) apiCallQuery.append('service', service);
  for (const outcome of outcomes) apiCallQuery.append('outcome', outcome);
  apiCallQuery.set('limit', String(limit));
  if (after) apiCallQuery.set('after', after);
  if (before) apiCallQuery.set('before', before);

  const [detail, apiCalls] = await Promise.all([
    apiFetch<JobDetail>(`/jobs/${id}`),
    apiFetch<ExternalApiCallPage>(`/jobs/${id}/api-calls?${apiCallQuery.toString()}`),
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
        <JobLiveDetail
          initial={detail}
          apiCalls={apiCalls}
          apiCallsQuery={apiCallQuery.toString()}
          apiCallsLimit={limit}
          services={services}
          outcomes={outcomes}
          pathname={`/jobs/${id}`}
          searchParams={query}
          originParam={typeof query.from === 'string' ? query.from : undefined}
        />
      </SectionCard>
    </div>
  );
}
