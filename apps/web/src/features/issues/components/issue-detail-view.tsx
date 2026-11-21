import type { SystemIssue } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { label } from '@/lib/labels';
import { detailHref, type BackLink } from '@/lib/navigation';
import { PageMeta } from '@/components/shell/page-meta';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { JsonBlock } from '@/components/dashboard/json-block';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { Badge } from '@/components/ui/badge';
import { asRecord, formatPayloadValue, issueError, issueWindow } from '../issue-format';

function ValueList({ value }: { value: Record<string, unknown> }) {
  return (
    <KeyValueGrid
      columns={2}
      items={Object.entries(value).map(([key, entry]) => ({
        label: label(key),
        value: formatPayloadValue(entry),
      }))}
    />
  );
}

/**
 * Read-only issue surface. The payload is the type-specific body, so the page
 * renders the shared keys it understands and falls back to raw JSON.
 */
export function IssueDetailView({ issue, back }: { issue: SystemIssue; back: BackLink }) {
  const window = issueWindow(issue.payload);
  const error = issueError(issue.payload);
  const expected = asRecord(issue.payload.expected);
  const observed = asRecord(issue.payload.observed);
  const unknown = Array.isArray(issue.payload.unknown)
    ? issue.payload.unknown.filter((value): value is string => typeof value === 'string')
    : [];

  return (
    <div>
      <PageMeta
        title={`${label(issue.kind)} · Issue`}
        description="What the mechanism raised, the data state it could not determine, and the evidence it kept."
      />

      <DetailHeader
        back={back}
        badges={
          <>
            <StatusBadge status={issue.severity} />
            <Badge variant="outline">{label(issue.source)}</Badge>
          </>
        }
        meta={`${issue.symbol ?? 'System-wide'} · ${window ?? 'No window'} · seen ${issue.occurrenceCount}×`}
        links={
          issue.instrumentId
            ? [
                {
                  href: detailHref(`/instruments/${issue.instrumentId}`, back.href),
                  label: 'Instrument',
                },
              ]
            : []
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Finding"
          description={`${label(issue.kind)} raised by ${label(issue.source)}`}
        >
          <KeyValueGrid
            columns={2}
            items={[
              { label: 'Kind', value: label(issue.kind) },
              { label: 'Source', value: label(issue.source) },
              { label: 'Severity', value: label(issue.severity) },
              { label: 'Scope', value: label(issue.scope) },
              { label: 'Window', value: window ?? '—' },
              { label: 'Occurrences', value: String(issue.occurrenceCount) },
              { label: 'First seen', value: formatDateTime(issue.firstSeenAt) },
              { label: 'Last seen', value: formatDateTime(issue.lastSeenAt) },
              {
                label: 'Dedupe key',
                value: (
                  <span className="break-all font-mono text-xs">{issue.dedupeKey}</span>
                ),
              },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Undetermined state"
          description="What was expected, what was observed, and what could not be decided."
        >
          <div className="space-y-4">
            {expected ? (
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                  Expected
                </p>
                <ValueList value={expected} />
              </div>
            ) : null}
            {observed ? (
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                  Observed
                </p>
                <ValueList value={observed} />
              </div>
            ) : null}
            {unknown.length > 0 ? (
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                  Unknown
                </p>
                <div className="flex flex-wrap gap-1">
                  {unknown.map((entry) => (
                    <Badge key={entry} variant="outline">
                      {label(entry)}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {!expected && !observed && unknown.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No state recorded for this issue.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>

      {error ? (
        <SectionCard
          className="mt-4"
          title="Error"
          description="Provider or processing failure that produced this row."
        >
          <p className="text-sm">{error}</p>
        </SectionCard>
      ) : null}

      <SectionCard
        className="mt-4"
        title="Payload"
        description="The mechanism owns this shape; it is kept as-is so new detectors need no schema change."
      >
        <JsonBlock value={issue.payload} />
      </SectionCard>
    </div>
  );
}
