import { apiFetch } from '@/lib/api';
import type { JobDetail } from '@/lib/types';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { backLinkFor, detailHref, type DetailSearchParams } from '@/lib/navigation';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { JsonBlock } from '@/components/dashboard/json-block';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import { SubmitButton } from '@/components/dashboard/submit-button';
import {
  TableActionLink,
  TableActions,
  TableRefreshButton,
} from '@/components/dashboard/table-actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StageRail } from '@/features/jobs/components/stage-rail';
import { EventTimeline } from '@/features/jobs/components/event-timeline';
import { cancelPlanAction } from '../actions';

const ACTIVE_STATUSES = new Set(['queued', 'running', 'retrying']);

function durationOf(run: JobDetail['run']): number | null {
  if (run.durationMs !== null) return run.durationMs;
  if (!run.startedAt) return null;
  return Date.now() - new Date(run.startedAt).getTime();
}

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
  const detail = await apiFetch<JobDetail>(`/jobs/${id}`);
  const run = detail.run;
  const active = ACTIVE_STATUSES.has(run.status);
  const parentJobRunId =
    typeof run.payload?.parentJobRunId === 'string' ? run.payload.parentJobRunId : null;
  const isPlan = run.jobName === 'backfill-plan';
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
        back={back}
        badges={<StatusBadge status={run.status} />}
        meta={`${label(run.jobName)} · ${label(run.queueName)} · attempt ${run.attempt}/${run.maxAttempts}`}
        links={
          parentJobRunId
            ? [
                {
                  href: detailHref(`/jobs/${parentJobRunId}`, back.href),
                  label: 'Backfill plan',
                },
              ]
            : []
        }
        actions={
          isPlan && active ? (
            <form action={cancelPlanAction}>
              <input type="hidden" name="jobId" value={run.id} />
              <input type="hidden" name="returnTo" value={`/jobs/${run.id}`} />
              <SubmitButton size="sm" variant="outline" pendingLabel="Cancelling…">
                Cancel plan
              </SubmitButton>
            </form>
          ) : null
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

      {isPlan ? (
        <SectionCard
          className="mt-4"
          title="Chunks"
          description="One parent plan, one child job per instrument, one run per month. A succeeded chunk is not a complete day."
          actions={<TableRefreshButton />}
        >
          {detail.planProgress ? (
            <StatGrid columns={5}>
              <StatCard
                label="Succeeded"
                value={formatNumber(detail.planProgress.succeeded)}
                hint="Chunks"
                tone="success"
              />
              <StatCard
                label="Running"
                value={formatNumber(detail.planProgress.running)}
                hint="In-flight chunks"
                tone="info"
              />
              <StatCard
                label="Failed"
                value={formatNumber(detail.planProgress.failed)}
                hint="Chunks"
                tone="danger"
              />
              <StatCard
                label="Rows written"
                value={formatNumber(detail.planProgress.rowsWritten)}
                hint="Inserted + updated"
                tone="highlight"
              />
              <StatCard
                label="Rows rejected"
                value={formatNumber(detail.planProgress.rowsRejected)}
                hint="Evidence retained"
                tone="warning"
              />
            </StatGrid>
          ) : null}

          {detail.chunks.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No chunks"
              description="The plan has not queued any instrument yet."
            />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Chunk</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.chunks.map((chunk) => (
                    <TableRow key={chunk.id}>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {chunk.rank ?? '—'}
                      </TableCell>
                      <TableCell>{chunk.symbol ?? chunk.instrumentId ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {(chunk.chunkIndex ?? 0) + 1}/{chunk.chunkCount ?? '—'} · attempt{' '}
                        {chunk.attempt}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {chunk.requestedFrom ?? '—'} → {chunk.requestedTo ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {chunk.rowsFetched}/{chunk.rowsWritten}/{chunk.rowsRejected}
                        <span className="block text-[10px]">
                          {chunk.rowsSkipped} skipped · {chunk.rowsUpdated} updated
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {chunk.httpStatus ?? '—'}
                        {chunk.providerErrorCode ? (
                          <span className="block text-[10px]">{chunk.providerErrorCode}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={chunk.status} />
                        {chunk.errorMessage ? (
                          <p className="text-destructive mt-1 max-w-56 truncate text-[10px]">
                            {chunk.errorMessage}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableActions>
                        <TableActionLink
                          href={detailHref(`/instruments/runs/${chunk.id}`, back.href)}
                          label="View run"
                        />
                      </TableActions>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      ) : null}

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
