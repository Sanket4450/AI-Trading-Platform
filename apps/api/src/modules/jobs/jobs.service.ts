import { Injectable, NotFoundException } from '@nestjs/common';
import {
  getJobRun,
  getJobRunEvents,
  getJobRunMetrics,
  getJobRunSummary,
  listTrackedJobRuns,
} from '@ai-trading/database';
import type { JobQueryDto } from './dto/job-query.dto.js';

type RunRow = NonNullable<Awaited<ReturnType<typeof getJobRun>>>;
type EventRow = Awaited<ReturnType<typeof getJobRunEvents>>[number];
type MetricRow = Awaited<ReturnType<typeof getJobRunMetrics>>[number];

const TERMINAL_STATUSES = new Set([
  'succeeded',
  'failed',
  'cancelled',
  'partially_failed',
]);

function stageKeysOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numericValue(value: string | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapListRun(
  run: Awaited<ReturnType<typeof listTrackedJobRuns>>[number],
) {
  return {
    ...run,
    stageKeys: stageKeysOf(run.stageKeys),
  };
}

function mapRun(run: RunRow) {
  return {
    ...run,
    payload: recordOf(run.payload),
    result: run.result === null ? null : recordOf(run.result),
    stageKeys: stageKeysOf(run.stageKeys),
  };
}

function mapEvent(event: EventRow) {
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    kind: event.kind,
    level: event.level,
    stageKey: event.stageKey,
    message: event.message,
    data: recordOf(event.data),
    metricKey: event.metricKey,
    metricValue: numericValue(event.metricValue),
    metricUnit: event.metricUnit,
  };
}

/**
 * Derives the rail from recorded stage events. A stage that was entered but
 * never closed is reported as running, skipped or failed based on the run.
 */
function deriveStages(run: RunRow, events: EventRow[]) {
  return stageKeysOf(run.stageKeys).map((key) => {
    const stageEvents = events.filter(
      (event) => event.kind === 'stage' && event.stageKey === key,
    );
    const entered = stageEvents.find(
      (event) => recordOf(event.data).phase === 'entered',
    );
    const completed = [...stageEvents]
      .reverse()
      .find((event) => recordOf(event.data).phase === 'completed');
    const completedData = completed ? recordOf(completed.data) : {};

    let status = 'pending';
    if (completed) {
      status =
        typeof completedData.status === 'string'
          ? completedData.status
          : 'succeeded';
    } else if (entered) {
      status =
        run.status === 'failed'
          ? 'failed'
          : TERMINAL_STATUSES.has(run.status)
            ? 'skipped'
            : 'running';
    }

    const recordedDuration = completedData.durationMs;
    const enteredAt = entered?.occurredAt ?? null;
    const completedAt = completed?.occurredAt ?? null;
    const durationMs =
      typeof recordedDuration === 'number'
        ? recordedDuration
        : enteredAt && completedAt
          ? completedAt.getTime() - enteredAt.getTime()
          : null;

    return { key, status, enteredAt, completedAt, durationMs };
  });
}

function deriveMetrics(rows: MetricRow[]) {
  const latest = new Map<string, MetricRow>();
  for (const row of rows) {
    if (row.metricKey) latest.set(row.metricKey, row);
  }
  return [...latest.values()].map((row) => ({
    key: row.metricKey,
    value: numericValue(row.metricValue),
    unit: row.metricUnit,
    at: row.recordedAt,
  }));
}

@Injectable()
export class JobsService {
  async list(query: JobQueryDto) {
    const [summary, runs] = await Promise.all([
      getJobRunSummary(),
      listTrackedJobRuns({
        limit: query.limit ?? 50,
        status: query.status,
        jobType: query.jobType,
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

    const [events, metrics] = await Promise.all([
      getJobRunEvents(id, 500),
      getJobRunMetrics(id),
    ]);

    return {
      run: mapRun(run),
      stages: deriveStages(run, events),
      metrics: deriveMetrics(metrics),
      events: events.map(mapEvent),
    };
  }
}
