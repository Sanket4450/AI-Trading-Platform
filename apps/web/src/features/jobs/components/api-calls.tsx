'use client';

import { useEffect, useState } from 'react';
import type { ApiCallSummary, ExternalApiCall, ExternalApiCallPage } from '@/lib/types';
import { formatDuration, formatNumber } from '@/lib/format';
import { connectJobs } from '@/lib/realtime';
import { apiRequest } from '@/lib/api-browser';
import { Badge } from '@/components/ui/badge';
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
      {ordered.map((outcome) => {
        const meta = apiOutcomeMeta(outcome);
        return (
          <Badge key={outcome} variant="outline" className={cn(meta.badgeClass)}>
            {meta.label} · {formatNumber(counts.get(outcome) ?? 0)}
          </Badge>
        );
      })}
      <Badge variant="outline" className="border-border/70 bg-muted/30 text-muted-foreground">
        p95 {formatDuration(summary.p95LatencyMs)}
      </Badge>
    </div>
  );
}

/**
 * Provider call ledger of one run. The page renders the filtered page on the server; this
 * component keeps the visible rows live, so a new call lands at the top between renders.
 */
export function ApiCallsSection({
  jobRunId,
  initial,
  query,
}: {
  jobRunId: string;
  initial: ExternalApiCallPage;
  /** Serialized filters, page size and cursor of the current view. */
  query: string;
}) {
  const [items, setItems] = useState<ExternalApiCall[]>(initial.items);
  const [summary, setSummary] = useState(initial.summary);

  useEffect(() => {
    setItems(initial.items);
    setSummary(initial.summary);
  }, [initial]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const disconnect = connectJobs((message) => {
      if (message.type !== 'calls') return;
      if (!message.calls.some((call) => call.jobRunId === jobRunId)) return;
      if (timer) return;

      // The socket is only a hint: refetch the same view so every row keeps the API projection
      // (method, URL, symbol) and the active filters. New rows arrive at the top.
      timer = setTimeout(() => {
        timer = null;
        void apiRequest<ExternalApiCallPage>(`/jobs/${jobRunId}/api-calls?${query}`)
          .then((response) => {
            setItems(response.items);
            setSummary(response.summary);
          })
          .catch(() => undefined);
      }, LIVE_REFRESH_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      disconnect();
    };
  }, [jobRunId, query]);

  return (
    <>
      <OutcomeChips summary={summary} />

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
    </>
  );
}
