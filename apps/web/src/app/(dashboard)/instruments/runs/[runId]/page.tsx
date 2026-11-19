import { apiFetch } from '@/lib/api';
import type { IngestionRun } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { backLinkFor, detailHref, type DetailSearchParams } from '@/lib/navigation';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { JsonBlock } from '@/components/dashboard/json-block';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';

type RunDetail = IngestionRun & {
  rawPayload: {
    id: string;
    endpoint: string;
    httpStatus: number;
    payloadBytes: number;
    payloadSha256: string;
    fetchedAt: string;
    retentionClass: string;
    expiresAt: string | null;
  } | null;
};

export default async function IngestionRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: DetailSearchParams;
}) {
  const { runId } = await params;
  const { from: fromParam } = await searchParams;
  const back = backLinkFor(fromParam, '/instruments');
  const run = await apiFetch<RunDetail>(`/instruments/runs/${runId}`);

  return (
    <div>
      <PageMeta
        title={`Ingestion run · ${run.symbol ?? label(run.runType)}`}
        description="Counts, timing and the archived provider payload for this download."
      />

      <DetailHeader
        back={back}
        badges={<StatusBadge status={run.status} />}
        meta={`${label(run.runType)} · ${run.symbol ?? 'No instrument'} · ${formatDateTime(run.createdAt)}`}
        links={[
          ...(run.parentJobRunId
            ? [
                {
                  href: detailHref(`/jobs/${run.parentJobRunId}`, back.href),
                  label: 'Backfill plan',
                },
              ]
            : []),
          ...(run.instrumentId
            ? [
                {
                  href: detailHref(`/instruments/${run.instrumentId}`, back.href),
                  label: 'Instrument',
                },
              ]
            : []),
        ]}
      />

      <StatGrid columns={5}>
        <StatCard
          label="Fetched"
          value={formatNumber(run.rowsFetched)}
          hint="Provider tuples"
          tone="info"
        />
        <StatCard
          label="Written"
          value={formatNumber(run.rowsWritten)}
          hint="Inserted + updated"
          tone="success"
        />
        <StatCard
          label="Rejected"
          value={formatNumber(run.rowsRejected)}
          hint="Evidence retained"
          tone="danger"
        />
        <StatCard
          label="Skipped"
          value={formatNumber(run.rowsSkipped)}
          hint="Idempotent repeats"
          tone="warning"
        />
        <StatCard
          label="Duration"
          value={run.durationMs ? `${formatNumber(run.durationMs)} ms` : '—'}
          hint="Fetch + parse + write"
          tone="highlight"
        />
      </StatGrid>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Request"
          description="Exact inclusive dates and chunk position."
          contentClassName="space-y-3"
        >
          <KeyValueGrid
            columns={2}
            items={[
              { label: 'Window', value: `${run.requestedFrom ?? '—'} → ${run.requestedTo ?? '—'}` },
              {
                label: 'Chunk',
                value: `${(run.chunkIndex ?? 0) + 1}/${run.chunkCount ?? '—'} · attempt ${run.attempt}`,
              },
              {
                label: 'HTTP',
                value: `${run.httpStatus ?? '—'}${run.providerErrorCode ? ` · ${run.providerErrorCode}` : ''}`,
              },
              {
                label: 'Started',
                value: run.startedAt ? formatDateTime(run.startedAt) : '—',
              },
              {
                label: 'Finished',
                value: run.finishedAt ? formatDateTime(run.finishedAt) : '—',
              },
              {
                label: 'Fingerprint',
                value: (
                  <span className="break-all font-mono text-xs">
                    {run.requestFingerprint ?? '—'}
                  </span>
                ),
              },
            ]}
          />
          {run.errorMessage ? <p className="text-destructive text-sm">{run.errorMessage}</p> : null}
        </SectionCard>

        <SectionCard
          title="Raw payload"
          description="Archived before parsing; a parser fix becomes a replay."
        >
          {run.rawPayload ? (
            <KeyValueGrid
              columns={2}
              items={[
                {
                  label: 'Endpoint',
                  value: (
                    <span className="break-all font-mono text-xs">{run.rawPayload.endpoint}</span>
                  ),
                },
                {
                  label: 'Bytes',
                  value: formatNumber(run.rawPayload.payloadBytes),
                },
                {
                  label: 'SHA-256',
                  value: (
                    <span className="break-all font-mono text-xs">
                      {run.rawPayload.payloadSha256}
                    </span>
                  ),
                },
                {
                  label: 'Fetched',
                  value: formatDateTime(run.rawPayload.fetchedAt),
                },
                {
                  label: 'Retention',
                  value: `${label(run.rawPayload.retentionClass)} · expires ${
                    run.rawPayload.expiresAt ? formatDateTime(run.rawPayload.expiresAt) : 'never'
                  }`,
                },
              ]}
            />
          ) : (
            <p className="text-muted-foreground text-sm">No raw payload linked to this run.</p>
          )}
        </SectionCard>
      </div>

      <details className="mt-4">
        <summary className="text-muted-foreground cursor-pointer text-xs">Run JSON</summary>
        <div className="mt-2">
          <JsonBlock value={run} />
        </div>
      </details>
    </div>
  );
}
