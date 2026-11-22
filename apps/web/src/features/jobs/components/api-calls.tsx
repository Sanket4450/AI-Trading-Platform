'use client';

import { useEffect, useState } from 'react';
import { PAGINATION_DEFAULT_LIMIT } from '@ai-trading/domain';
import type { ApiCallSummary, ExternalApiCall, ExternalApiCallPage, Paginated } from '@/lib/types';
import { formatDuration, formatNumber } from '@/lib/format';
import { connectJobs } from '@/lib/realtime';
import { apiRequest } from '@/lib/api-browser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/dashboard/empty-state';
import { cn } from '@/lib/utils';
import { API_OUTCOME_ORDER, apiOutcomeMeta } from '../api-call-labels';
import { ApiCallTable } from './api-call-table';

/** A burst is coalesced into one refetch, so the table always shows server-shaped rows. */
const LIVE_REFRESH_MS = 800;

function OutcomeChips({ summary }: { summary: ApiCallSummary }) {
  const counts = new Map(summary.outcomes.map((row) => [row.outcome, row.count]));
  const ordered = API_OUTCOME_ORDER.filter((outcome) => (counts.get(outcome) ?? 0) > 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="border-info/30 bg-info/10 text-info">
        {formatNumber(summary.total)} calls
      </Badge>
      <Badge variant="outline" className="border-border/70 bg-muted/30 text-muted-foreground">
        p95 {formatDuration(summary.p95LatencyMs)}
      </Badge>
      {ordered.map((outcome) => {
        const meta = apiOutcomeMeta(outcome);
        return (
          <Badge key={outcome} variant="outline" className={cn(meta.badgeClass)}>
            {meta.label} · {formatNumber(counts.get(outcome) ?? 0)}
          </Badge>
        );
      })}
    </div>
  );
}

/**
 * Provider call ledger of one run. The page renders the first page on the server; this component
 * keeps it live from the socket and pages toward older calls on demand.
 */
export function ApiCallsSection({
  jobRunId,
  initial,
}: {
  jobRunId: string;
  initial: ExternalApiCallPage;
}) {
  const [items, setItems] = useState(initial.items);
  const [summary, setSummary] = useState(initial.summary);
  const [page, setPage] = useState(initial.page);
  const [loading, setLoading] = useState<'older' | 'refresh' | null>(null);

  useEffect(() => {
    setItems(initial.items);
    setSummary(initial.summary);
    setPage(initial.page);
  }, [initial]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const disconnect = connectJobs((message) => {
      if (message.type !== 'calls') return;
      if (!message.calls.some((call) => call.jobRunId === jobRunId)) return;
      if (timer) return;

      // The socket is only a hint: refetch so every row keeps the API projection (method,
      // URL, symbol). While a run is active this resets the view to the newest page.
      timer = setTimeout(() => {
        timer = null;
        void apiRequest<ExternalApiCallPage>(
          `/jobs/${jobRunId}/api-calls?limit=${PAGINATION_DEFAULT_LIMIT}`,
        )
          .then((response) => {
            setItems(response.items);
            setSummary(response.summary);
            setPage(response.page);
          })
          .catch(() => undefined);
      }, LIVE_REFRESH_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      disconnect();
    };
  }, [jobRunId]);

  async function loadOlder() {
    if (!page.nextCursor || loading) return;
    setLoading('older');
    try {
      const response = await apiRequest<Paginated<ExternalApiCall>>(
        `/jobs/${jobRunId}/api-calls?limit=${PAGINATION_DEFAULT_LIMIT}&before=${encodeURIComponent(page.nextCursor)}`,
      );
      setItems((current) => [...current, ...response.items]);
      setPage(response.page);
    } catch {
      // Leave the loaded rows in place; the control stays available for a retry.
    } finally {
      setLoading(null);
    }
  }

  async function refresh() {
    if (loading) return;
    setLoading('refresh');
    try {
      const response = await apiRequest<ExternalApiCallPage>(
        `/jobs/${jobRunId}/api-calls?limit=${PAGINATION_DEFAULT_LIMIT}`,
      );
      setItems(response.items);
      setSummary(response.summary);
      setPage(response.page);
    } catch {
      // Keep the current view; the next socket batch still lands.
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OutcomeChips summary={summary} />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {formatNumber(items.length)} shown of {formatNumber(page.total)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading !== null}
          >
            {loading === 'refresh' ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {items.length === 0 ? (
          <EmptyState
            title="No provider calls yet"
            description="Calls appear here as soon as this run sends its first request."
          />
        ) : (
          <ApiCallTable calls={items} containerClassName="max-h-[420px] overflow-auto" />
        )}
      </div>

      {page.nextCursor ? (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadOlder}
            disabled={loading !== null}
          >
            {loading === 'older' ? 'Loading…' : 'Load older calls'}
          </Button>
        </div>
      ) : null}
    </>
  );
}
