import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { isQuantifiedStage, jobTypeOf, QUEUES, stagesForJob } from '@ai-trading/domain';
import {
  getJobRun,
  getJobRunEvents,
  getJobRunSummary,
  getLatestJobRunEvent,
  listTrackedJobRuns,
  recordAudit,
  updateJobRun,
} from '@ai-trading/database';
import type { JobRunBroadcast } from '@ai-trading/domain';
import type { RequestMeta } from '../../common/http/request-meta.js';
import type { JobQueryDto } from './dto/job-query.dto.js';
import { JobEventsPublisher } from './jobs-events.publisher.js';

type RunRow = NonNullable<Awaited<ReturnType<typeof getJobRun>>>;
type EventRow = Awaited<ReturnType<typeof getJobRunEvents>>[number];
type ListRow = Awaited<ReturnType<typeof listTrackedJobRuns>>[number];

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'partially_failed', 'cancelled']);
const CLOSED_TYPES = new Set(['completed', 'failed', 'skipped']);

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function durationOf(startedAt: Date | null, finishedAt: Date | null): number | null {
  if (!startedAt || !finishedAt) return null;
  return Math.max(0, finishedAt.getTime() - startedAt.getTime());
}

function mapEvent(event: EventRow) {
  return {
    id: event.id,
    occurredAt: event.occurredAt.toISOString(),
    stage: event.stage,
    type: event.type,
    data: recordOf(event.data),
  };
}

function progressOf(jobName: string, latest: EventRow | null) {
  if (!latest) return null;
  const stages = stagesForJob(jobName);
  const stageIndex = stages.indexOf(latest.stage);
  if (stageIndex < 0) return null;

  const data = recordOf(latest.data);
  const completed = latest.type === 'progress' ? Number(data.index ?? 0) : null;
  const total = latest.type === 'progress' ? Number(data.total ?? 0) : null;

  return {
    stage: latest.stage,
    stageIndex: stageIndex + 1,
    stageTotal: stages.length,
    completed: Number.isFinite(completed) ? completed : null,
    total: Number.isFinite(total) ? total : null,
  };
}

function mapRun(
  row: RunRow,
  latest: EventRow | null,
) {
  return {
    id: row.id,
    jobName: row.jobName,
    queueName: row.queueName,
    jobType: jobTypeOf(row.jobName) ?? 'ingestion',
    status: row.status,
    groupId: row.groupId,
    instrumentId: row.instrumentId,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    payload: recordOf(row.payload),
    result: row.result === null ? null : recordOf(row.result),
    error: row.error === null ? null : recordOf(row.error),
    durationMs: durationOf(row.startedAt, row.finishedAt),
    latestEvent: latest ? mapEvent(latest) : null,
    progress: progressOf(row.jobName, latest),
    createdAt: row.createdAt.toISOString(),
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
  };
}

function mapListRun(row: ListRow) {
  const latest: EventRow | null =
    row.latestEventId === null
      ? null
      : {
          id: row.latestEventId,
          jobRunId: row.id,
          stage: row.latestStage ?? 'prepare',
          type: row.latestType ?? 'entered',
          occurredAt: row.latestOccurredAt ?? row.createdAt,
          data: row.latestData ?? {},
        };

  return {
    id: row.id,
    jobName: row.jobName,
    queueName: row.queueName,
    jobType: jobTypeOf(row.jobName) ?? 'ingestion',
    status: row.status,
    groupId: row.groupId,
    instrumentId: row.instrumentId,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    payload: {},
    result: row.result === null ? null : recordOf(row.result),
    error: row.error === null ? null : recordOf(row.error),
    durationMs: durationOf(row.startedAt, row.finishedAt),
    latestEvent: latest ? mapEvent(latest) : null,
    progress: progressOf(row.jobName, latest),
    createdAt: row.createdAt.toISOString(),
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
  };
}

function broadcastOf(row: RunRow): JobRunBroadcast {
  return {
    id: row.id,
    jobName: row.jobName,
    queueName: row.queueName,
    status: row.status,
    groupId: row.groupId,
    instrumentId: row.instrumentId,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    createdAt: row.createdAt.toISOString(),
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
    result: row.result === null ? null : recordOf(row.result),
    error: row.error === null ? null : recordOf(row.error),
  };
}

/** Derives the fixed stage rail from the catalog plus the recorded facts. */
function deriveStages(run: RunRow, events: EventRow[]) {
  const terminal = TERMINAL_STATUSES.has(run.status);

  return stagesForJob(run.jobName).map((key) => {
    const stageEvents = events.filter((event) => event.stage === key);
    const entered = stageEvents.find((event) => event.type === 'entered') ?? null;
    const closed = [...stageEvents].reverse().find((event) => CLOSED_TYPES.has(event.type)) ?? null;
    const progress = [...stageEvents].reverse().find((event) => event.type === 'progress') ?? null;

    let status = 'pending';
    if (closed) {
      status = closed.type === 'completed' ? 'succeeded' : closed.type;
    } else if (entered) {
      status = run.status === 'failed' ? 'failed' : terminal ? 'skipped' : 'running';
    }

    const data = recordOf(closed?.data);
    const progressData = recordOf(progress?.data);

    return {
      key,
      status,
      quantified: isQuantifiedStage(run.jobName, key),
      completed:
        progressData.index === undefined ? null : Number(progressData.index),
      total: progressData.total === undefined ? null : Number(progressData.total),
      enteredAt: iso(entered?.occurredAt),
      completedAt: iso(closed?.occurredAt),
      durationMs: typeof data.durationMs === 'number' ? data.durationMs : null,
    };
  });
}

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(QUEUES.historicalData) private readonly historicalQueue: Queue,
    @InjectQueue(QUEUES.maintenance) private readonly maintenanceQueue: Queue,
    private readonly events: JobEventsPublisher,
  ) {}

  async list(query: JobQueryDto) {
    const [summary, runs] = await Promise.all([
      getJobRunSummary(),
      listTrackedJobRuns({
        limit: query.limit ?? 50,
        status: query.status,
        instrumentId: query.instrumentId,
        search: query.search,
      }),
    ]);

    return {
      summary: summary ?? {
        running: 0,
        failed24h: 0,
        succeeded24h: 0,
        p95DurationMs: 0,
      },
      items: runs.map(mapListRun),
    };
  }

  async detail(id: string) {
    const run = await getJobRun(id);
    if (!run) throw new NotFoundException('Job not found');

    const [events, latest] = await Promise.all([
      getJobRunEvents(id, 500),
      getLatestJobRunEvent(id),
    ]);

    return {
      run: mapRun(run, latest),
      stages: deriveStages(run, events),
      events: events.map(mapEvent),
      progress: progressOf(run.jobName, latest),
    };
  }

  async cancel(id: string, actorUserId: string, meta: RequestMeta) {
    const run = await getJobRun(id);
    if (!run) throw new NotFoundException('Job not found');
    if (TERMINAL_STATUSES.has(run.status)) return run;

    const updated = await updateJobRun(id, {
      status: 'cancelled',
      finishedAt: new Date(),
    });
    if (updated) {
      this.events.publish({ type: 'run', run: broadcastOf(updated) });
    }

    const queue =
      run.queueName === QUEUES.maintenance ? this.maintenanceQueue : this.historicalQueue;
    await queue.remove(id).catch(() => undefined);

    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'data.job_cancelled',
      entityType: 'job_run',
      entityId: id,
      beforeState: { status: run.status },
      afterState: { status: 'cancelled', jobName: run.jobName },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return updated;
  }
}
