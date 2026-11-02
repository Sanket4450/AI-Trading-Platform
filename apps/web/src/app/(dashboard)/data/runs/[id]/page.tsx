import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { IngestionRun } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { JsonBlock } from '@/components/dashboard/json-block';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
      <PageHeader
        title={`Run ${run.id.slice(0, 8)}`}
        description="Request, HTTP status, counts, duration and the raw payload link. The access token is never exposed."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={run.status} />
        <span className="text-muted-foreground text-xs">
          {run.runType} · {run.symbol ?? 'no instrument'} · {formatDateTime(run.createdAt)}
        </span>
        <div className="ml-auto flex gap-2">
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
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Request</CardTitle>
            <CardDescription>Exact inclusive dates and chunk position.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Window:</span> {run.requestedFrom ?? '—'} →{' '}
              {run.requestedTo ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Chunk:</span> {(run.chunkIndex ?? 0) + 1}/
              {run.chunkCount ?? '—'} · attempt {run.attempt}
            </p>
            <p>
              <span className="text-muted-foreground">HTTP:</span> {run.httpStatus ?? '—'}{' '}
              {run.providerErrorCode ? `· ${run.providerErrorCode}` : ''}
            </p>
            <p>
              <span className="text-muted-foreground">Started:</span>{' '}
              {run.startedAt ? formatDateTime(run.startedAt) : '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Finished:</span>{' '}
              {run.finishedAt ? formatDateTime(run.finishedAt) : '—'}
            </p>
            <p className="break-all font-mono text-xs">
              <span className="text-muted-foreground">Fingerprint:</span>{' '}
              {run.requestFingerprint ?? '—'}
            </p>
            {run.errorMessage ? (
              <p className="text-destructive text-sm">{run.errorMessage}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Raw payload</CardTitle>
            <CardDescription>
              Archived before parsing; a parser fix becomes a replay.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {run.rawPayload ? (
              <div className="space-y-2 text-sm">
                <p className="break-all font-mono text-xs">{run.rawPayload.endpoint}</p>
                <p>
                  <span className="text-muted-foreground">Bytes:</span>{' '}
                  {formatNumber(run.rawPayload.payloadBytes)}
                </p>
                <p>
                  <span className="text-muted-foreground">SHA-256:</span>{' '}
                  <span className="break-all font-mono text-xs">
                    {run.rawPayload.payloadSha256}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Fetched:</span>{' '}
                  {formatDateTime(run.rawPayload.fetchedAt)}
                </p>
                <p>
                  <span className="text-muted-foreground">Retention:</span>{' '}
                  {run.rawPayload.retentionClass} · expires{' '}
                  {run.rawPayload.expiresAt ? formatDateTime(run.rawPayload.expiresAt) : 'never'}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No raw payload linked to this run.</p>
            )}
          </CardContent>
        </Card>
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
