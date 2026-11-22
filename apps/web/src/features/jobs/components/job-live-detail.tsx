'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PAGINATION_MAX_LIMIT, isQuantifiedStage } from '@ai-trading/domain';
import type {
  ExternalApiCallPage,
  JobDetail,
  JobEvent,
  JobRun,
  JobStage,
  Paginated,
} from '@/lib/types';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import type { RouteSearchParams } from '@/lib/navigation';
import { connectJobs } from '@/lib/realtime';
import { apiRequest } from '@/lib/api-browser';
import { Button } from '@/components/ui/button';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { JsonBlock } from '@/components/dashboard/json-block';
import { TableRefreshButton } from '@/components/dashboard/table-actions';
import { MultiSelectFilter, TableFilters } from '@/components/dashboard/table-filters';
import { PageSizeSelect } from '@/components/dashboard/page-size-select';
import { Pagination } from '@/components/dashboard/pagination';
import { API_OUTCOME_OPTIONS, API_SERVICE_OPTIONS } from '../api-call-labels';
import {
  JOB_PANEL_MAX_HEIGHT_PX,
  JOB_PANEL_MIN_HEIGHT_PX,
  TIMELINE_EVENT_WINDOW,
} from '../constants';
import { StageRail } from './stage-rail';
import { EventTimeline } from './event-timeline';
import { ApiCallsSection } from './api-calls';
import { progressFromEvent } from '../progress';

const TERMINAL = new Set(['succeeded', 'failed', 'partially_failed', 'cancelled']);
const CLOSED = new Set(['completed', 'failed', 'skipped']);

const PANEL_HEIGHT = {
  minHeight: JOB_PANEL_MIN_HEIGHT_PX,
  maxHeight: JOB_PANEL_MAX_HEIGHT_PX,
};

function deriveStage(run: JobRun, key: string, events: JobEvent[]): JobStage | null {
  const forStage = events.filter((event) => event.stage === key);
  if (forStage.length === 0) return null;

  const terminal = TERMINAL.has(run.status);
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
    completed: progress && typeof progress.data.index === 'number' ? progress.data.index : null,
    total: progress && typeof progress.data.total === 'number' ? progress.data.total : null,
    enteredAt: entered?.occurredAt ?? null,
    completedAt: closed?.occurredAt ?? null,
    durationMs:
      closed && typeof closed.data.durationMs === 'number' ? closed.data.durationMs : null,
  };
}

/** Server stages cover unloaded pages; loaded events refine the stages they touch. */
function mergeStages(detail: JobDetail): JobStage[] {
  return detail.stages.map((stage) => {
    const derived = deriveStage(detail.run, stage.key, detail.events);
    if (!derived) return stage;
    // The server derives every stage from the full log, so a partial window must never take a
    // closed stage back to running or report less progress than the server already knows.
    if (stage.completedAt && !derived.completedAt) return stage;
    const completed =
      derived.completed === null
        ? stage.completed
        : stage.completed === null
          ? derived.completed
          : Math.max(derived.completed, stage.completed);
    return { ...derived, completed };
  });
}

function durationOf(detail: JobDetail, now: number | null): number | null {
  if (detail.run.durationMs !== null) return detail.run.durationMs;
  if (!detail.run.startedAt || now === null) return null;
  return Math.max(0, now - Date.parse(detail.run.startedAt));
}

export function JobLiveDetail({
  initial,
  apiCalls,
  apiCallsQuery,
  apiCallsLimit,
  services,
  outcomes,
  pathname,
  searchParams,
  originParam,
}: {
  initial: JobDetail;
  apiCalls: ExternalApiCallPage;
  /** Serialized filters and cursor the call table is showing; the socket refetch reuses it. */
  apiCallsQuery: string;
  apiCallsLimit: number;
  services: string[];
  outcomes: string[];
  pathname: string;
  searchParams: RouteSearchParams;
  /** Drill-down origin, carried as a hidden field so filtering the table keeps the back link. */
  originParam?: string;
}) {
  const [detail, setDetail] = useState(initial);
  const [now, setNow] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setDetail(initial);
    setShowAll(false);
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

      if (message.type !== 'event') return;
      const event = message.event;
      if (event.jobRunId !== initial.run.id) return;
      setDetail((current) => {
        if (current.events.some((existing) => existing.id === event.id)) return current;
        return {
          ...current,
          run: {
            ...current.run,
            latestEvent: event as JobEvent,
            progress: progressFromEvent(current.run.jobName, event),
          },
          events: [...current.events, event as JobEvent],
          eventsPage: {
            ...current.eventsPage,
            total: current.eventsPage.total + 1,
          },
        };
      });
    });
  }, [initial.run.id]);

  const run = detail.run;
  const active = !TERMINAL.has(run.status);
  const stages = mergeStages(detail);
  const visibleEvents = showAll ? detail.events : detail.events.slice(0, TIMELINE_EVENT_WINDOW);
  const canShowAll = !showAll && detail.eventsPage.total > visibleEvents.length;

  async function showAllEvents() {
    if (loadingAll) return;
    setLoadingAll(true);
    try {
      const older = new Map<number, JobEvent>();
      let cursor = detail.eventsPage.nextCursor;
      while (cursor) {
        const response = await apiRequest<Paginated<JobEvent>>(
          `/jobs/${run.id}/events?limit=${PAGINATION_MAX_LIMIT}&after=${encodeURIComponent(cursor)}`,
        );
        for (const event of response.items) older.set(event.id, event);
        cursor = response.page.nextCursor;
      }
      // Merge into the live list so events that arrived during the walk are kept.
      setDetail((current) => {
        const merged = new Map<number, JobEvent>(
          current.events.map((event) => [event.id, event]),
        );
        for (const [id, event] of older) merged.set(id, event);
        return { ...current, events: [...merged.values()].sort((a, b) => a.id - b.id) };
      });
      setShowAll(true);
    } catch {
      // Keep the windowed view; the control stays available for a retry.
    } finally {
      setLoadingAll(false);
    }
  }

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
            detail.progress ? `${detail.progress.stageIndex}/${detail.progress.stageTotal}` : '—'
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
          actions={
            <>
              {canShowAll ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={showAllEvents}
                  disabled={loadingAll}
                >
                  {loadingAll ? 'Loading…' : 'Show all events'}
                </Button>
              ) : null}
              <TableRefreshButton label="Refresh timeline" />
            </>
          }
          style={PANEL_HEIGHT}
          contentClassName="flex min-h-0 flex-1 flex-col"
        >
          <p className="text-muted-foreground text-xs">
            Showing {formatNumber(visibleEvents.length)} of {formatNumber(detail.eventsPage.total)}{' '}
            events
          </p>
          <div className="mt-2 min-h-0 flex-1 overflow-auto">
            <EventTimeline events={visibleEvents} />
          </div>
        </SectionCard>

        <SectionCard
          title="Run context"
          description="Inputs, correlation and terminal detail."
          style={PANEL_HEIGHT}
          contentClassName="min-h-0 flex-1 overflow-auto"
        >
          <KeyValueGrid
            columns={2}
            items={[
              { label: 'Queue', value: label(run.queueName) },
              { label: 'Type', value: label(run.jobType) },
              { label: 'Created', value: formatDateTime(run.createdAt) },
              { label: 'Attempt', value: `${run.attempt}/${run.maxAttempts}` },
              ...(run.instrumentId
                ? [
                    {
                      label: 'Instrument',
                      value: (
                        <span>
                          <span className="font-medium">
                            {detail.instrument?.symbol ?? run.instrumentId}
                          </span>
                          {detail.instrument?.name ? (
                            <span className="text-muted-foreground block text-xs">
                              {detail.instrument.name}
                            </span>
                          ) : null}
                        </span>
                      ),
                    },
                  ]
                : []),
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

      <SectionCard
        className="mt-4"
        title="External API calls"
        description="Every outbound request this run made, with its exact failure and request URL."
        toolbar={
          <TableFilters>
            {originParam ? <input type="hidden" name="from" value={originParam} readOnly /> : null}
            <MultiSelectFilter
              id="service"
              name="service"
              defaultValue={services}
              options={API_SERVICE_OPTIONS}
              placeholder="All services"
            />
            <MultiSelectFilter
              id="outcome"
              name="outcome"
              defaultValue={outcomes}
              options={API_OUTCOME_OPTIONS}
              placeholder="All outcomes"
            />
          </TableFilters>
        }
        actions={<TableRefreshButton />}
        footer={
          <Pagination
            pageSizeControl={<PageSizeSelect value={apiCallsLimit} />}
            page={apiCalls.page}
            itemsCount={apiCalls.items.length}
            pathname={pathname}
            searchParams={searchParams}
            itemLabel="calls"
          />
        }
      >
        <ApiCallsSection jobRunId={run.id} initial={apiCalls} query={apiCallsQuery} />
      </SectionCard>
    </>
  );
}
