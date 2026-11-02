import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { QualityIssue } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { JsonBlock } from '@/components/dashboard/json-block';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { acknowledgeIssueAction } from '../../actions';

export default async function IssueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ack?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const issue = await apiFetch<QualityIssue>(`/data/quality-issues/${id}`);

  return (
    <div>
      <PageHeader
        title={`${issue.ruleId ?? issue.issueType} · issue detail`}
        description="Rule, severity, evidence and lifecycle. A critical issue blocks the backtest preflight until it is resolved or waived."
      />

      {query.error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm">
          {query.error}
        </div>
      ) : null}
      {query.ack ? (
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 rounded-lg border px-4 py-3 text-sm">
          Issue updated and audited.
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={issue.severity} />
        <StatusBadge status={issue.status} />
        <span className="text-muted-foreground text-xs">
          {issue.symbol ?? 'provider-wide'} · {issue.tradingDate ?? 'no date'} · seen{' '}
          {issue.occurrenceCount}×
        </span>
        <div className="ml-auto flex gap-2">
          <Link href="/data" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Data health
          </Link>
          {issue.instrumentId ? (
            <Link
              href={`/instruments/${issue.instrumentId}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Instrument
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Finding</CardTitle>
            <CardDescription>
              {issue.issueType.replaceAll('_', ' ')} · detected by {issue.detectedBy}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Rule:</span> {issue.ruleId ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Window:</span>{' '}
              {issue.windowStart ? formatDateTime(issue.windowStart) : '—'} →{' '}
              {issue.windowEnd ? formatDateTime(issue.windowEnd) : '—'}
            </p>
            <p>
              <span className="text-muted-foreground">First seen:</span>{' '}
              {formatDateTime(issue.detectedAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Last seen:</span>{' '}
              {formatDateTime(issue.lastSeenAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Dedupe key:</span>{' '}
              <span className="break-all font-mono text-xs">{issue.dedupeKey ?? '—'}</span>
            </p>
            {issue.resolutionNote ? (
              <p>
                <span className="text-muted-foreground">Resolution:</span> {issue.resolutionNote}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>Lifecycle</CardTitle>
            <CardDescription>
              Acknowledgement records ownership. Resolving or ignoring requires a note and is
              audited.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={acknowledgeIssueAction} className="space-y-3">
              <input type="hidden" name="issueId" value={issue.id} />
              <input type="hidden" name="returnTo" value={`/data/issues/${issue.id}`} />
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue="acknowledged"
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="acknowledged">acknowledge</option>
                  <option value="resolved">resolve</option>
                  <option value="ignored">ignore</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note">Note</Label>
                <Input id="note" name="note" placeholder="Required for resolved or ignored" />
              </div>
              <Button type="submit" variant="outline">
                Update issue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
          <CardDescription>
            Raw payload and run lineage are retained; the issue never edits a candle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JsonBlock value={issue.details} />
        </CardContent>
      </Card>
    </div>
  );
}
