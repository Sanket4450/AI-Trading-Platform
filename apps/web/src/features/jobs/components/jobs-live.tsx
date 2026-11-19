'use client';

import { useEffect, useState } from 'react';
import { jobTypeOf, type JobRunBroadcast } from '@ai-trading/domain';
import type { JobRun } from '@/lib/types';
import { formatDateTime, formatDuration } from '@/lib/format';
import { label } from '@/lib/labels';
import { detailHref } from '@/lib/navigation';
import { connectJobs } from '@/lib/realtime';
import { StatusBadge } from '@/components/dashboard/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TableActionLink,
  TableActions,
} from '@/components/dashboard/table-actions';
import { progressFromEvent } from '../progress';

const TERMINAL = new Set(['succeeded', 'failed', 'partially_failed', 'cancelled']);

function mergeRun(items: JobRun[], run: JobRunBroadcast): JobRun[] {
  const existing = items.find((item) => item.id === run.id);
  if (!existing) {
    return [
      {
        ...run,
        jobType: jobTypeOf(run.jobName) ?? 'ingestion',
        durationMs:
          run.startedAt && run.finishedAt
            ? Math.max(0, Date.parse(run.finishedAt) - Date.parse(run.startedAt))
            : null,
        payload: {},
        latestEvent: null,
        progress: null,
      },
      ...items,
    ];
  }
  return items.map((item) =>
    item.id === run.id
      ? {
          ...item,
          ...run,
          payload: item.payload,
          latestEvent: item.latestEvent,
          progress: item.progress,
        }
      : item,
  );
}

function progressText(run: JobRun): string {
  if (!run.progress) return '—';
  const { stage, stageIndex, stageTotal, completed, total } = run.progress;
  if (completed !== null && total !== null) return `${label(stage)} · ${completed}/${total}`;
  return `${label(stage)} · ${stageIndex}/${stageTotal}`;
}

function durationOf(run: JobRun, now: number | null): number | null {
  if (run.durationMs !== null) return run.durationMs;
  if (!run.startedAt || now === null) return null;
  return Math.max(0, now - Date.parse(run.startedAt));
}

export function JobsLive({ items: initial, back }: { items: JobRun[]; back: string }) {
  const [items, setItems] = useState(initial);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return connectJobs((message) => {
      if (message.type === 'run') {
        setItems((current) => mergeRun(current, message.run));
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.id === message.event.jobRunId
            ? {
                ...item,
                latestEvent: message.event,
                progress: progressFromEvent(item.jobName, message.event),
              }
            : item,
        ),
      );
    });
  }, []);

  return (
    <Table containerClassName="h-full overflow-auto">
      <TableHeader className="bg-card sticky top-0 z-10">
        <TableRow>
          <TableHead>Job</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((run) => (
          <TableRow key={run.id}>
            <TableCell>
              <p className="font-medium">{label(run.jobName)}</p>
              <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                {run.id.slice(0, 8)}
              </p>
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {label(run.jobType)}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {progressText(run)}
            </TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
              {run.startedAt ? formatDateTime(run.startedAt) : 'Queued'}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {formatDuration(durationOf(run, now))}
            </TableCell>
            <TableCell>
              <StatusBadge status={run.status} />
            </TableCell>
            <TableActions>
              <TableActionLink href={detailHref(`/jobs/${run.id}`, back)} label="View job" />
            </TableActions>
          </TableRow>
        ))}
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-muted-foreground py-8 text-center text-sm">
              No jobs match these filters.
            </TableCell>
          </TableRow>
        ) : null}
        {items.some((run) => !TERMINAL.has(run.status)) ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={7} className="text-muted-foreground py-2 text-[11px]">
              Live · updates stream in while jobs are active
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
