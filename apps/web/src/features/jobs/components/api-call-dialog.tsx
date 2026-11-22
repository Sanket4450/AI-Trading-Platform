'use client';

import type { ExternalApiCall } from '@/lib/types';
import { formatDateTime, formatDuration } from '@/lib/format';
import { DetailDialog } from '@/components/dashboard/detail-dialog';
import { JsonBlock } from '@/components/dashboard/json-block';
import { TableActionButton } from '@/components/dashboard/table-actions';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  API_SCOPE_GROUP_HINTS,
  API_SCOPE_GROUP_LABELS,
  apiOperationHint,
  apiOperationLabel,
  apiOutcomeMeta,
  apiParamLabel,
  apiServiceLabel,
} from '../api-call-labels';

function scopeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function ScopeTable({ entries }: { entries: [string, unknown][] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-xs">None sent.</p>;
  }

  return (
    <dl className="divide-border/60 border-border/70 divide-y overflow-hidden rounded-lg border text-xs">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] items-start gap-3 px-3 py-2"
        >
          <dt className="text-muted-foreground">{apiParamLabel(key)}</dt>
          <dd className="text-foreground/90 break-all font-mono">{scopeValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ScopeGroup({
  part,
  entries,
}: {
  part: 'path' | 'query' | 'body';
  entries: [string, unknown][];
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {API_SCOPE_GROUP_LABELS[part]}
        </p>
        <p className="text-muted-foreground text-[11px]">{API_SCOPE_GROUP_HINTS[part]}</p>
      </div>
      <ScopeTable entries={entries} />
    </div>
  );
}

function errorPreview(errorBody: string | null): {
  parsed: boolean;
  value: unknown;
  text: string | null;
} {
  if (!errorBody) return { parsed: false, value: null, text: null };
  try {
    return { parsed: true, value: JSON.parse(errorBody) as unknown, text: null };
  } catch {
    return { parsed: false, value: null, text: errorBody };
  }
}

/** Full record of one provider call: what was asked, what came back, and the error verbatim. */
export function ApiCallDialog({ call }: { call: ExternalApiCall }) {
  const outcome = apiOutcomeMeta(call.outcome);
  const hint = apiOperationHint(call.operation);
  const failure = errorPreview(call.errorBody);

  const scope: [('path' | 'query' | 'body'), [string, unknown][]][] = [
    ['path', Object.entries(call.requestScope.path)],
    ['query', Object.entries(call.requestScope.query)],
    ['body', Object.entries(call.requestScope.body)],
  ];

  return (
    <DetailDialog
      trigger={<TableActionButton label="View call" className="shrink-0" />}
      title={apiOperationLabel(call.operation)}
      description={`${apiServiceLabel(call.service)} · ${formatDateTime(call.startedAt)}`}
      className="sm:max-w-3xl"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="font-mono">
          {call.method}
        </Badge>
        <Badge variant="outline" className={cn(outcome.badgeClass)}>
          {outcome.label}
        </Badge>
        <Badge variant="outline" className="font-mono">
          {call.statusCode ?? 'no response'}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {formatDuration(call.latencyMs)} · {outcome.hint}
        </span>
      </div>

      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}

      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Request URL</p>
        <p className="border-border/70 bg-background/60 break-all rounded-lg border p-3 font-mono text-xs">
          {call.url || '—'}
        </p>
        <p className="text-muted-foreground text-[11px]">
          Template <span className="font-mono">{call.endpoint || '—'}</span>
          {call.instrumentSymbol ? (
            <>
              {' · '}
              {call.instrumentSymbol}
            </>
          ) : null}
        </p>
      </div>

      {scope.map(([part, entries]) => (
        <ScopeGroup key={part} part={part} entries={entries} />
      ))}

      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Error response
        </p>
        {failure.parsed ? (
          <JsonBlock value={failure.value} />
        ) : failure.text ? (
          <pre className="border-border/70 bg-background/60 text-muted-foreground max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-3 text-xs">
            {failure.text}
          </pre>
        ) : (
          <p className="text-muted-foreground text-xs">
            No error payload recorded. Successful calls never store a response body.
          </p>
        )}
      </div>
    </DetailDialog>
  );
}
