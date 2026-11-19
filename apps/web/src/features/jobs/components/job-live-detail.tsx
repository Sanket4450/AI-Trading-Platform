'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isQuantifiedStage, stagesForJob } from '@ai-trading/domain';
import type { JobDetail, JobEvent, JobStage } from '@/lib/types';
import { formatDateTime, formatDuration } from '@/lib/format';
import { label } from '@/lib/labels';
import { connectJobs } from '@/lib/realtime';
import { apiRequest } from '@/lib/api-browser';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { JsonBlock } from '@/components/dashboard/json-block';
import { StageRail } from './stage-rail';
import { EventTimeline } from './event-timeline';
import { progressFromEvent } from '../progress';

const TERMINAL = new Set(['succeeded', 'failed', 'partially_failed', 'cancelled']);
const CLOSED = new Set(['completed', 'failed', 'skipped']);

function deriveStages(detail: JobDetail): JobStage[] {
  const { run, events } = detail;
  const terminal = TERMINAL.has(run.status);

  return stagesForJob(run.jobName).map((key) => {
    const forStage = events.filter((event) => event.stage === key);
    const entered = forStage.find((event) => event.type === 'entered') ?? null;
    const closed = [...forStage].reverse().find((event) => CLOSED.has(event.type)) ?? null;
    const progress = [...forStage].reverse().find((event) => event.type === 'progress') ?? null;

    let status = 'pending';
    if (closed) status = closed.type === 'completed' ? 'succeeded' : closed.type;
    else if (entered) status = run.status === 'failed' ? 'failed' : terminal ? 'skipped' : 'running';

    return {
      key,
      status,
      quantified: isQuantifiedStage(run.jobName, key),
      completed:
        progress && typeof progress.data.index === 'number' ? progress.data.index : null,
      total: progress && typeof progress.data.total === 'number' ? progress.data.total : null,
      enteredAt: entered?.occurredAt ?? null,
      completedAt: closed?.occurredAt ?? null,
      durationMs:
        closed && typeof closed.data.durationMs === 'number' ? closed.data.durationMs : null,
    };
  });
}

function durationOf(detail: JobDetail, now: number | null): number | null {
  if (detail.run.durationMs !== null) return detail.run.durationMs;
  if (!detail.run.startedAt || now === null) return null;
  return Math.max(0, now - Date.parse(detail.run.startedAt));
}

export function JobLiveDetail({ initial }: { initial: JobDetail }) {
  const [detail, setDetail] = useState(initial);
  const [now, setNow] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setDetail(initial);
  }, [initial]);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return connectJobs((message) => {
      if (message.type === 'run') {
        if (message.run.id !== initial.run.id) return;
        setDetail((current) => ({
          ...current,
          run: {
            ...current.run,
            status: message.run.status,
            attempt: message.run.attempt,
            result: message.run.result,
            error: message.run.error,
            startedAt: message.run.startedAt,
            finishedAt: message.run.finishedAt,
          },
        }));
        return;
      }

      const event = message.event;
      if (event.jobRunId !== initial.run.id) return;
      setDetail((current) => ({
        ...current,
        run: {
          ...current.run,
          latestEvent: event as JobEvent,
          progress: progressFromEvent(current.run.jobName, event),
        },
        events: [...current.events, event as JobEvent],
      }));
    });
  }, [initial.run.id]);

  const run = detail.run;
  const active = !TERMINAL.has(run.status);
  const stages = deriveStages(detail);

  async function cancel() {
    setCancelling(true);
    try {
      await apiRequest(`/jobs/${run.id}/cancel`, { method: 'POST' });
      router.refresh();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <div className="flex justify-end">
        {active ? (
          <button
            type="button"
            onClick={cancel}
            disabled={cancelling}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {cancelling ? 'Cancelling…' : 'Cancel job'}
          </button>
        ) : null}
      </div>

      <StatGrid columns={4}>
        <StatCard
          label="Duration"
          value={formatDuration(durationOf(detail, now))}
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
            detail.progress
              ? `${detail.progress.stageIndex}/${detail.progress.stageTotal}`
              : '—'
          }
          hint={detail.progress ? label(detail.progress.stage) : 'Waiting for the first stage'}
          tone="default"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Stages"
        description="Fixed stage order from the job catalog. Unreached stages stay visible."
      >
        <StageRail stages={stages} />
      </SectionCard>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          title="Timeline"
          description="Stage facts with the figures recorded for each unit of work."
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
              { label: 'Attempt', value: `${run.attempt}/${run.maxAttempts}` },
              {
                label: 'Group',
                value: <span className="font-mono text-xs">{run.groupId ?? '—'}</span>,
              },
              {
                label: 'Instrument',
                value: <span className="font-mono text-xs">{run.instrumentId ?? '—'}</span>,
              },
            ]}
          />
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wide">
                Error
              </p>
              {run.error ? (
                <JsonBlock value={run.error} />
              ) : (
                <p className="text-muted-foreground text-xs">No error recorded.</p>
              )}
            </div>
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
    </>
  );
}
