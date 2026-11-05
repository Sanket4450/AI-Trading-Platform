import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { BackfillPlanDetail } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';
import { SubmitButton } from '@/components/dashboard/submit-button';
import { buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cancelPlanAction, retryPlanAction } from '../../actions';

export default async function BackfillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await apiFetch<BackfillPlanDetail>(`/data/backfill-plans/${id}`);
  const active = plan.status === 'queued' || plan.status === 'running';

  return (
    <div>
      <AutoRefresh active={active} />
      <PageMeta title={`Backfill plan ${plan.id.slice(0, 8)}`} />

      <DetailHeader
        badges={<StatusBadge status={plan.status} />}
        meta={`Created ${formatDateTime(plan.createdAt)} · ${plan.progress.instruments} instruments · ${plan.progress.chunks} chunks`}
        actions={
          <>
            <Link href="/data" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Data health
            </Link>
            {active ? (
              <form action={cancelPlanAction}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="returnTo" value={`/data/backfills/${plan.id}`} />
                <SubmitButton size="sm" variant="outline" pendingLabel="Cancelling…">
                  Cancel plan
                </SubmitButton>
              </form>
            ) : (
              <form action={retryPlanAction}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="returnTo" value={`/data/backfills/${plan.id}`} />
                <SubmitButton size="sm" variant="outline" pendingLabel="Retrying…">
                  Retry failed
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      <StatGrid columns={5}>
        <StatCard
          label="Succeeded"
          value={formatNumber(plan.progress.succeeded)}
          hint="Chunks"
          tone="success"
        />
        <StatCard
          label="Running"
          value={formatNumber(plan.progress.running)}
          hint="In-flight chunks"
          tone="info"
        />
        <StatCard
          label="Failed"
          value={formatNumber(plan.progress.failed)}
          hint="Retryable"
          tone="danger"
        />
        <StatCard
          label="Rows written"
          value={formatNumber(plan.progress.rowsWritten)}
          hint="Inserted + updated"
          tone="highlight"
        />
        <StatCard
          label="Rows rejected"
          value={formatNumber(plan.progress.rowsRejected)}
          hint="Evidence retained"
          tone="warning"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Chunk ledger"
        description="A succeeded chunk is not a complete day. Coverage and the daily oracle decide usability."
      >
        {plan.chunks.length === 0 ? (
          <EmptyState title="No chunks" description="The plan has not queued any instrument yet." />
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
      </SectionCard>
    </div>
  );
}
