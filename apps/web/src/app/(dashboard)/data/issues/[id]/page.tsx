import Link from 'next/link';
import { PencilLine } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { QualityIssue } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { label } from '@/lib/labels';
import { PageMeta } from '@/components/shell/page-meta';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { JsonBlock } from '@/components/dashboard/json-block';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField, FormSelect } from '@/components/dashboard/form-field';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { acknowledgeIssueAction } from '../../actions';

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = await apiFetch<QualityIssue>(`/data/quality-issues/${id}`);

  return (
    <div>
      <PageMeta
        title={`${issue.symbol ?? 'Provider-wide'} · Data issue`}
        description="What was detected, the affected dates and the resolution history."
      />

      <DetailHeader
        badges={
          <>
            <StatusBadge status={issue.severity} />
            <StatusBadge status={issue.status} />
          </>
        }
        meta={`${issue.symbol ?? 'Provider-wide'} · ${issue.tradingDate ?? 'No date'} · seen ${issue.occurrenceCount}×`}
        actions={
          <>
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
            <FormDialog
              trigger={
                <Button type="button" size="sm" variant="outline">
                  <PencilLine className="size-4" />
                  Update issue
                </Button>
              }
              title="Update issue lifecycle"
              description="Acknowledgement records ownership. Resolving or ignoring requires a note and is audited."
              submitLabel="Update issue"
              action={acknowledgeIssueAction}
            >
              <input type="hidden" name="issueId" value={issue.id} />
              <input type="hidden" name="returnTo" value={`/data/issues/${issue.id}`} />
              <FormField label="Status" htmlFor="status">
                <FormSelect
                  id="status"
                  name="status"
                  defaultValue="acknowledged"
                  options={[
                    { value: 'acknowledged', label: 'Acknowledge' },
                    { value: 'resolved', label: 'Resolve' },
                    { value: 'ignored', label: 'Ignore' },
                  ]}
                />
              </FormField>
              <FormField label="Note" htmlFor="note" hint="Required when resolving or ignoring.">
                <Input id="note" name="note" placeholder="What changed?" />
              </FormField>
            </FormDialog>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Finding"
          description={`${label(issue.issueType)} · detected by ${label(issue.detectedBy)}`}
        >
          <KeyValueGrid
            columns={2}
            items={[
              { label: 'Rule', value: issue.ruleId ?? '—' },
              { label: 'Issue type', value: label(issue.issueType) },
              {
                label: 'Window',
                value: `${issue.windowStart ? formatDateTime(issue.windowStart) : '—'} → ${
                  issue.windowEnd ? formatDateTime(issue.windowEnd) : '—'
                }`,
              },
              { label: 'First seen', value: formatDateTime(issue.detectedAt) },
              { label: 'Last seen', value: formatDateTime(issue.lastSeenAt) },
              {
                label: 'Dedupe key',
                value: (
                  <span className="break-all font-mono text-xs">{issue.dedupeKey ?? '—'}</span>
                ),
              },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Lifecycle"
          description="Acknowledgement records ownership. Resolving or ignoring requires a note and is audited."
        >
          <KeyValueGrid
            columns={2}
            items={[
              {
                label: 'Acknowledged by',
                value: issue.acknowledgedBy ?? 'Not acknowledged',
              },
              {
                label: 'Acknowledged at',
                value: issue.acknowledgedAt ? formatDateTime(issue.acknowledgedAt) : '—',
              },
              { label: 'Resolved by', value: issue.resolvedBy ?? 'Not resolved' },
              {
                label: 'Resolved at',
                value: issue.resolvedAt ? formatDateTime(issue.resolvedAt) : '—',
              },
              {
                label: 'Resolution note',
                value: issue.resolutionNote ?? '—',
              },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard
        className="mt-4"
        title="Evidence"
        description="Raw payload and run lineage are retained; the issue never edits a candle."
      >
        <JsonBlock value={issue.details} />
      </SectionCard>
    </div>
  );
}
