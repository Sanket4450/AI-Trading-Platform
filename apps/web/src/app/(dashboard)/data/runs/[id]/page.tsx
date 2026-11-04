import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { IngestionRun } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { JsonBlock } from '@/components/dashboard/json-block';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { buttonVariants } from '@/components/ui/button';

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

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await apiFetch<RunDetail>(`/data/ingestion-runs/${id}`);

  return (
    <div>
      <PageMeta title={`Run ${run.id.slice(0, 8)}`} />

      <DetailHeader
        badges={<StatusBadge status={run.status} />}
        meta={`${label(run.runType)} · ${run.symbol ?? 'No instrument'} · ${formatDateTime(run.createdAt)}`}
        actions={
          <>
            <Link href="/data" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Data health
            </Link>
            {run.parentJobRunId ? (
              <Link
                href={`/data/backfills/${run.parentJobRunId}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Parent plan
              </Link>
            ) : null}
            {run.instrumentId ? (
              <Link
                href={`/instruments/${run.instrumentId}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Instrument
              </Link>
            ) : null}
          </>
        }
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
