import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import {
  isQuantifiedStage,
  jobTypeOf,
  QUEUES,
  queueNameOf,
  stagesForJob,
} from '@ai-trading/domain';
import {
  getAllJobRunEvents,
  getJobRun,
  getJobRunEventsPage,
  getJobRunSummary,
  getLatestJobRunEvent,
  listJobApiCalls,
  listTrackedJobRuns,
  recordAudit,
  summarizeExternalApiCalls,
  updateJobRun,
} from '@ai-trading/database';
import {
  PAGINATION_DEFAULT_LIMIT,
  type JobRunBroadcast,
} from '@ai-trading/domain';
import {
  filterFingerprint,
  parseTimestampCursor,
  readDirectionalCursor,
  readCursor,
} from '../../common/pagination/cursor.js';
import { backwardPage, forwardPage, olderPage } from '../../common/pagination/page.js';
import type { RequestMeta } from '../../common/http/request-meta.js';
import type { CursorQueryDto } from '../../common/pagination/pagination.dto.js';
import type { JobQueryDto } from './dto/job-query.dto.js';
import type { JobApiCallQueryDto } from './dto/job-api-call-query.dto.js';
import { createApiCallMapper } from '../api-calls/api-call.mapper.js';
import { JobEventsPublisher } from './jobs-events.publisher.js';

type RunRow = NonNullable<Awaited<ReturnType<typeof getJobRun>>>;
type EventRow = Awaited<ReturnType<typeof getAllJobRunEvents>>[number];
type ListRow = Awaited<ReturnType<typeof listTrackedJobRuns>>['items'][number];

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
    queueName: queueNameOf(row.jobName) ?? 'unknown',
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
    queueName: queueNameOf(row.jobName) ?? 'unknown',
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
    queueName: queueNameOf(row.jobName) ?? 'unknown',
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
  private readonly mapApiCall: ReturnType<typeof createApiCallMapper>;

  constructor(
    @InjectQueue(QUEUES.historicalData) private readonly historicalQueue: Queue,
    @InjectQueue(QUEUES.maintenance) private readonly maintenanceQueue: Queue,
    private readonly events: JobEventsPublisher,
    config: ConfigService,
  ) {
    this.mapApiCall = createApiCallMapper(config);
  }

  async list(query: JobQueryDto) {
    const fingerprint = filterFingerprint({
      scope: 'jobs',
      status: query.status ?? [],
      instrumentId: query.instrumentId ?? null,
      search: query.search ?? null,
    });
    const { after, before } = readDirectionalCursor(query, fingerprint);
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;

    const result = await listTrackedJobRuns({
      limit,
      status: query.status,
      instrumentId: query.instrumentId,
      search: query.search,
      after: after ? parseTimestampCursor(after) : undefined,
      before: before ? parseTimestampCursor(before) : undefined,
    });

    const items = result.items.map(mapListRun);
    const keyOf = (item: (typeof items)[number]) => item.createdAt;
    const idOf = (item: (typeof items)[number]) => item.id;

    if (before) {
      return backwardPage({
        items: items.reverse(),
        total: result.total,
        limit,
        hasExtra: result.hasExtra,
        fingerprint,
        keyOf,
        idOf,
      });
    }

    return forwardPage({
      items,
      total: result.total,
      limit,
      hasExtra: result.hasExtra,
      fingerprint,
      keyOf,
      idOf,
      hadAfter: Boolean(after),
    });
  }

  summary() {
    return getJobRunSummary();
  }

  async listEvents(id: string, query: CursorQueryDto) {
    if (query.after) throw new BadRequestException('Use before for event history');
    const run = await getJobRun(id);
    if (!run) throw new NotFoundException('Job not found');

    const fingerprint = filterFingerprint({ scope: 'job-events', jobRunId: id });
    const cursor = readCursor(query.before, fingerprint);
    const beforeId = cursor ? Number(cursor.key) : undefined;
    if (beforeId !== undefined && !Number.isInteger(beforeId)) {
      throw new BadRequestException('Pagination cursor has an invalid event id');
    }
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;

    const result = await getJobRunEventsPage(id, { limit, beforeId });
    const items = result.items.map(mapEvent);

    return olderPage({
      items,
      total: result.total,
      limit,
      hasExtra: result.hasExtra,
      fingerprint,
      keyOf: (item) => String(item.id),
      idOf: (item) => String(item.id),
    });
  }

  /**
   * One run's outbound calls, newest first. Method and URL are projected from the catalogue so
   * the browser never needs the endpoint templates.
   */
  async listApiCalls(id: string, query: JobApiCallQueryDto) {
    if (query.after) throw new BadRequestException('Use before for API call history');
    const run = await getJobRun(id);
    if (!run) throw new NotFoundException('Job not found');

    const fingerprint = filterFingerprint({
      scope: 'job-api-calls',
      jobRunId: id,
      outcome: query.outcome ?? null,
      service: query.service ?? null,
    });
    const cursor = readCursor(query.before, fingerprint);
    const beforeId = cursor ? Number(cursor.key) : undefined;
    if (beforeId !== undefined && !Number.isInteger(beforeId)) {
      throw new BadRequestException('Pagination cursor has an invalid call id');
    }
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;

    const [result, summary] = await Promise.all([
      listJobApiCalls({
        jobRunId: id,
        limit,
        beforeId,
        outcome: query.outcome,
        service: query.service,
      }),
      summarizeExternalApiCalls({ jobRunId: id }),
    ]);
    const items = result.items.map((row) => this.mapApiCall(row));

    return {
      ...olderPage({
        items,
        total: result.total,
        limit,
        hasExtra: result.hasExtra,
        fingerprint,
        keyOf: (item) => String(item.id),
        idOf: (item) => String(item.id),
      }),
      summary,
    };
  }

  async detail(id: string) {
    const run = await getJobRun(id);
    if (!run) throw new NotFoundException('Job not found');
    const fingerprint = filterFingerprint({ scope: 'job-events', jobRunId: id });
    const [allEvents, latest, eventPage] = await Promise.all([
      getAllJobRunEvents(id),
      getLatestJobRunEvent(id),
      getJobRunEventsPage(id, { limit: PAGINATION_DEFAULT_LIMIT }),
    ]);
    const events = eventPage.items.map(mapEvent);

    return {
      run: mapRun(run, latest),
      stages: deriveStages(run, allEvents),
      events,
      eventsPage: olderPage({
        items: events,
        total: eventPage.total,
        limit: PAGINATION_DEFAULT_LIMIT,
        hasExtra: eventPage.hasExtra,
        fingerprint,
        keyOf: (item) => String(item.id),
        idOf: (item) => String(item.id),
      }).page,
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
      queueNameOf(run.jobName) === QUEUES.maintenance
        ? this.maintenanceQueue
        : this.historicalQueue;
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
