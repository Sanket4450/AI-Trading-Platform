'use client';

import { useEffect, useState } from 'react';
import type { JobRun } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { label } from '@/lib/labels';
import { detailHref } from '@/lib/navigation';
import { connectJobs } from '@/lib/realtime';
import { SectionCard } from '@/components/dashboard/section-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { TableActionLink, TableActions } from '@/components/dashboard/table-actions';
import { progressFromEvent } from '../progress';

const TERMINAL = new Set(['succeeded', 'failed', 'partially_failed', 'cancelled']);

/** Latest fetch/backfill run for one instrument, patched live from the job stream. */
export function InstrumentJobProgress({
  initial,
  returnTo,
}: {
  initial: JobRun | null;
  returnTo: string;
}) {
  const [job, setJob] = useState(initial);

  useEffect(() => {
    if (!initial) return;
    return connectJobs((message) => {
      if (message.type === 'run') {
        if (message.run.id !== initial.id) return;
        setJob((current) =>
          current
            ? {
                ...current,
                status: message.run.status,
                attempt: message.run.attempt,
                error: message.run.error,
                startedAt: message.run.startedAt,
                finishedAt: message.run.finishedAt,
              }
            : current,
        );
        return;
      }
      if (message.type !== 'event') return;
      if (message.event.jobRunId !== initial.id) return;
      setJob((current) =>
        current
          ? {
              ...current,
              latestEvent: message.event,
              progress: progressFromEvent(current.jobName, message.event),
            }
          : current,
      );
    });
  }, [initial]);

  if (!job) {
    return (
      <SectionCard
        className="mt-4"
        title="Latest run"
        description="No backfill has run for this instrument yet."
      >
        <p className="text-muted-foreground text-sm">Nothing queued.</p>
      </SectionCard>
    );
  }

  const active = !TERMINAL.has(job.status);
  const progress = job.progress;

  return (
    <SectionCard
      className="mt-4"
      title="Latest run"
      description="Live progress while the job is running."
      actions={
        <TableActions>
          <TableActionLink href={detailHref(`/jobs/${job.id}`, returnTo)} label="View job" />
        </TableActions>
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge status={job.status} />
        <span className="font-medium">{label(job.jobName)}</span>
        <span className="text-muted-foreground text-xs">
          {progress
            ? progress.completed !== null && progress.total !== null
              ? `${label(progress.stage)} · ${progress.completed}/${progress.total}`
              : `${label(progress.stage)} · ${progress.stageIndex}/${progress.stageTotal}`
            : 'Waiting for the first stage'}
        </span>
        <span className="text-muted-foreground text-xs">
          {job.startedAt ? formatDateTime(job.startedAt) : 'Queued'}
        </span>
        {active ? <span className="text-info text-xs">● live</span> : null}
      </div>
    </SectionCard>
  );
}
