import Link from 'next/link';
import type { SystemIssue } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { label } from '@/lib/labels';
import { detailHref } from '@/lib/navigation';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { JsonBlock } from '@/components/dashboard/json-block';
import { asRecord, formatPayloadValue, issueError, issueWindow } from '../issue-format';

/** Payload keys that get their own grouped presentation above the evidence list. */
const GROUPED_KEYS = new Set([
  'expected',
  'observed',
  'unknown',
  'error',
  'window',
  'from',
  'to',
  'tradingDate',
]);

function StateValue({ value }: { value: unknown }) {
  const record = asRecord(value);
  if (!record) {
    return <p className="break-words text-sm">{formatPayloadValue(value)}</p>;
  }

  return (
    <KeyValueGrid
      items={Object.entries(record).map(([key, entry]) => ({
        label: label(key),
        value: formatPayloadValue(entry),
      }))}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
      {children}
    </p>
  );
}

/**
 * The one issue detail layout: dialog surfaces and any future issue view render this so the
 * grouped evidence, error and payload always look the same.
 */
export function IssueDetailContent({
  issue,
  from,
  currentInstrumentId,
}: {
  issue: SystemIssue;
  from: string;
  currentInstrumentId?: string | null;
}) {
  const window = issueWindow(issue.payload);
  const error = issueError(issue.payload);
  const expected = issue.payload.expected;
  const observed = issue.payload.observed;
  const unknown = Array.isArray(issue.payload.unknown)
    ? issue.payload.unknown.filter((value): value is string => typeof value === 'string')
    : [];
  const evidence = Object.entries(issue.payload).filter(([key]) => !GROUPED_KEYS.has(key));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={issue.severity} />
        <Badge variant="outline">{label(issue.source)}</Badge>
        <Badge variant="outline">{label(issue.scope)} scope</Badge>
        {issue.instrumentId ? (
          issue.instrumentId === currentInstrumentId ? (
            <Badge variant="outline">{issue.symbol ?? 'Instrument'}</Badge>
          ) : (
            <Badge asChild variant="outline">
              <Link href={detailHref(`/instruments/${issue.instrumentId}`, from)}>
                {issue.symbol ?? 'Instrument'}
              </Link>
            </Badge>
          )
        ) : null}
      </div>

      <KeyValueGrid
        items={[
          { label: 'Window', value: window ?? '—' },
          { label: 'Occurrences', value: `${issue.occurrenceCount}×` },
          { label: 'First seen', value: formatDateTime(issue.firstSeenAt) },
          { label: 'Last seen', value: formatDateTime(issue.lastSeenAt) },
          ...(issue.providerCode
            ? [{ label: 'Provider', value: label(issue.providerCode) }]
            : []),
        ]}
      />

      {expected !== undefined || observed !== undefined || unknown.length > 0 ? (
        <section className="border-border/70 border-t pt-3">
          <SectionLabel>Undetermined state</SectionLabel>
          <div className="space-y-3">
            {expected !== undefined ? (
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Expected</p>
                <StateValue value={expected} />
              </div>
            ) : null}
            {observed !== undefined ? (
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Observed</p>
                <StateValue value={observed} />
              </div>
            ) : null}
            {unknown.length > 0 ? (
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Unknown</p>
                <div className="flex flex-wrap gap-1">
                  {unknown.map((entry) => (
                    <Badge key={entry} variant="outline">
                      {label(entry)}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {evidence.length > 0 ? (
        <section className="border-border/70 border-t pt-3">
          <SectionLabel>Evidence</SectionLabel>
          <KeyValueGrid
            items={evidence.map(([key, value]) => ({
              label: label(key),
              value: formatPayloadValue(value),
            }))}
          />
        </section>
      ) : null}

      {error ? (
        <section className="border-border/70 border-t pt-3">
          <SectionLabel>Error</SectionLabel>
          <p className="break-words text-sm">{error}</p>
        </section>
      ) : null}

      <details className="border-border/70 border-t pt-3">
        <summary className="text-muted-foreground w-fit cursor-pointer text-xs font-medium transition-colors hover:text-foreground">
          Raw payload
        </summary>
        <JsonBlock className="mt-2" value={issue.payload} />
      </details>
    </div>
  );
}
