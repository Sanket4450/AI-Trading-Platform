import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { JobDetail } from '@/lib/types';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { JsonBlock } from '@/components/dashboard/json-block';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import { buttonVariants } from '@/components/ui/button';
import { StageRail } from '@/features/jobs/components/stage-rail';
import { EventTimeline } from '@/features/jobs/components/event-timeline';

const ACTIVE_STATUSES = new Set(['queued', 'running', 'retrying']);

function durationOf(run: JobDetail['run']): number | null {
  if (run.durationMs !== null) return run.durationMs;
  if (!run.startedAt) return null;
  return Date.now() - new Date(run.startedAt).getTime();
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await apiFetch<JobDetail>(`/jobs/${id}`);
  const run = detail.run;
  const active = ACTIVE_STATUSES.has(run.status);
  const parentJobRunId =
    typeof run.payload?.parentJobRunId === 'string' ? run.payload.parentJobRunId : null;
  const stageIndex = run.currentStage ? run.stageKeys.indexOf(run.currentStage) : -1;
  const stageTotal = run.stageTotal ?? run.stageKeys.length;

  return (
    <div>
      <AutoRefresh active={active} />
      <PageMeta
        title={`Job · ${label(run.jobName)}`}
        description="Progress, timing and details for this job run."
      />

      <DetailHeader
        badges={<StatusBadge status={run.status} />}
        meta={`${label(run.jobName)} · ${label(run.queueName)} · attempt ${run.attempt}/${run.maxAttempts}`}
        actions={
          <>
            <Link href="/jobs" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              All jobs
            </Link>
            {parentJobRunId ? (
              <Link
                href={`/data/backfills/${parentJobRunId}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Parent plan
              </Link>
            ) : null}
          </>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Duration"
          value={formatDuration(durationOf(run))}
          hint={active ? 'Still running' : 'Start to finish'}
          tone={active ? 'info' : 'highlight'}
        />
        <StatCard
          label="Started"
          value={run.startedAt ? formatDateTime(run.startedAt) : '—'}
          hint={run.startedAt ? 'IST' : 'Not started'}
          tone="info"
        />
        <StatCard
          label="Finished"
          value={run.finishedAt ? formatDateTime(run.finishedAt) : '—'}
          hint={active ? 'In flight' : 'Terminal'}
          tone={run.status === 'failed' ? 'danger' : 'success'}
        />
        <StatCard
          label="Stage"
          value={
            run.currentStage && stageIndex >= 0
              ? `${stageIndex + 1}/${stageTotal}`
              : label(run.currentStage)
          }
          hint={run.currentStage ? label(run.currentStage) : 'Waiting for the first stage'}
          tone="default"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Stages"
        description="Ordered stages from the run definition. Unreached stages stay visible."
      >
        <StageRail stages={detail.stages} />
      </SectionCard>

      <SectionCard
        className="mt-4"
        title="Important figures"
        description="Latest recorded value per metric."
      >
        {detail.metrics.length === 0 ? (
          <EmptyState
            title="No metrics recorded"
            description="Metrics appear when the job reports counts or durations."
          />
        ) : (
          <StatGrid columns={4}>
            {detail.metrics.slice(0, 8).map((metric) => (
              <StatCard
                key={metric.key}
                label={label(metric.key)}
                value={formatNumber(metric.value)}
                hint={
                  metric.unit
                    ? `${metric.unit} · ${formatDateTime(metric.at)}`
                    : formatDateTime(metric.at)
                }
                tone="highlight"
              />
            ))}
          </StatGrid>
        )}
      </SectionCard>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          title="Timeline"
          description="Timestamped steps, stage transitions, warnings and failures."
        >
          <EventTimeline events={detail.events} />
        </SectionCard>

        <SectionCard title="Run context" description="Inputs, correlation and terminal detail.">
          <KeyValueGrid
            columns={2}
            items={[
              { label: 'Queue', value: label(run.queueName) },
              { label: 'Type', value: label(run.jobType) },
              { label: 'Created', value: formatDateTime(run.createdAt) },
              {
                label: 'Scheduled',
                value: run.scheduledFor ? formatDateTime(run.scheduledFor) : '—',
              },
              {
                label: 'Correlation',
                value: <span className="font-mono text-xs">{run.correlationId ?? '—'}</span>,
              },
              {
                label: 'Error',
                value: run.errorMessage ? (
                  <span className="text-destructive text-xs">{run.errorMessage}</span>
                ) : (
                  '—'
                ),
              },
            ]}
          />
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wide">
                Payload
              </p>
              <JsonBlock value={run.payload ?? {}} />
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wide">
                Result
              </p>
              {run.result ? (
                <JsonBlock value={run.result} />
              ) : (
                <p className="text-muted-foreground text-xs">No result recorded yet.</p>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
