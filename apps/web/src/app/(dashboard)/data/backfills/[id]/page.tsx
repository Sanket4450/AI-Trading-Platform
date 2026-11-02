import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { BackfillPlanDetail } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cancelPlanAction, retryPlanAction } from '../../actions';

export default async function BackfillDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; cancelled?: string; retried?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const plan = await apiFetch<BackfillPlanDetail>(`/data/backfill-plans/${id}`);
  const active = plan.status === 'queued' || plan.status === 'running';

  return (
    <div>
      <AutoRefresh active={active} />
      <PageHeader
        title={`Backfill plan ${plan.id.slice(0, 8)}`}
        description="One parent plan, one child job per instrument and one ingestion run per month chunk."
      />

      {query.error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm">
          {query.error}
        </div>
      ) : null}
      {query.cancelled || query.retried ? (
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 rounded-lg border px-4 py-3 text-sm">
          {query.cancelled ? 'Cancellation recorded. ' : ''}
          {query.retried ? 'Failed instruments requeued.' : ''}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={plan.status} />
        <span className="text-muted-foreground text-xs">
          created {formatDateTime(plan.createdAt)} · {plan.progress.instruments} instruments ·{' '}
          {plan.progress.chunks} chunks
        </span>
        <div className="ml-auto flex gap-2">
          <Link href="/data" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Data health
          </Link>
          {active ? (
            <form action={cancelPlanAction}>
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="returnTo" value={`/data/backfills/${plan.id}`} />
              <Button type="submit" size="sm" variant="outline">
                Cancel plan
              </Button>
            </form>
          ) : (
            <form action={retryPlanAction}>
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="returnTo" value={`/data/backfills/${plan.id}`} />
              <Button type="submit" size="sm" variant="outline">
                Retry failed
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Succeeded"
          value={formatNumber(plan.progress.succeeded)}
          hint="Chunks"
          tone="green"
        />
        <StatCard
          label="Running"
          value={formatNumber(plan.progress.running)}
          hint="In-flight chunks"
          tone="cyan"
        />
        <StatCard
          label="Failed"
          value={formatNumber(plan.progress.failed)}
          hint="Retryable"
          tone="red"
        />
        <StatCard
          label="Rows written"
          value={formatNumber(plan.progress.rowsWritten)}
          hint="Inserted + updated"
          tone="violet"
        />
        <StatCard
          label="Rows rejected"
          value={formatNumber(plan.progress.rowsRejected)}
          hint="Evidence retained"
          tone="amber"
        />
      </div>

      <Card className="border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>Chunk ledger</CardTitle>
          <CardDescription>
            A succeeded chunk is not a complete day. Coverage and the daily oracle decide usability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plan.chunks.length === 0 ? (
            <EmptyState
              title="No chunks"
              description="The plan has not queued any instrument yet."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Chunk</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.chunks.map((chunk) => (
                    <TableRow key={chunk.id}>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {chunk.rank ?? '—'}
                      </TableCell>
                      <TableCell>
                        {chunk.instrumentId ? (
                          <Link
                            href={`/instruments/${chunk.instrumentId}`}
                            className="hover:underline"
                          >
                            {chunk.symbol ?? chunk.instrumentId}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {(chunk.chunkIndex ?? 0) + 1}/{chunk.chunkCount ?? '—'} · attempt{' '}
                        {chunk.attempt}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {chunk.requestedFrom ?? '—'} → {chunk.requestedTo ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {chunk.rowsFetched}/{chunk.rowsWritten}/{chunk.rowsRejected}
                        <span className="block text-[10px]">
                          {chunk.rowsSkipped} skipped · {chunk.rowsUpdated} updated
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {chunk.httpStatus ?? '—'}
                        {chunk.providerErrorCode ? (
                          <span className="block text-[10px]">{chunk.providerErrorCode}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Link href={`/data/runs/${chunk.id}`}>
                          <StatusBadge status={chunk.status} />
                        </Link>
                        {chunk.errorMessage ? (
                          <p className="text-destructive mt-1 max-w-56 truncate text-[10px]">
                            {chunk.errorMessage}
                          </p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
