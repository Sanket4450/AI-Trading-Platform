import type { ProcessEvent } from '@/lib/types';
import { formatClock, formatDateTime, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import { cn } from '@/lib/utils';

const levelDot: Record<string, string> = {
  error: 'bg-destructive',
  warn: 'bg-warning',
  info: 'bg-info',
  debug: 'bg-muted-foreground',
};

const levelText: Record<string, string> = {
  error: 'text-destructive',
  warn: 'text-warning-strong',
  info: 'text-info',
  debug: 'text-muted-foreground',
};

/** Timestamped, append-only event list. Lifecycle and stage events stay visible but quiet. */
export function EventTimeline({ events }: { events: ProcessEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="No events yet"
        description="Steps appear here as soon as the process starts reporting."
      />
    );
  }

  return (
    <ol>
      {events.map((event) => (
        <li
          key={event.id}
          className="border-border/60 relative flex gap-3 border-l py-2.5 pl-4 last:border-l-transparent"
        >
          <span
            className={cn(
              'ring-card absolute -left-[5px] top-4 size-2.5 rounded-full ring-4',
              levelDot[event.level] ?? 'bg-muted-foreground',
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="text-muted-foreground font-mono text-[11px]"
                title={formatDateTime(event.occurredAt)}
              >
                {formatClock(event.occurredAt)}
              </span>
              {event.stageKey ? (
                <Badge variant="outline" className="text-[10px]">
                  {label(event.stageKey)}
                </Badge>
              ) : null}
              {event.kind !== 'step' ? (
                <Badge variant="outline" className="text-[10px]">
                  {label(event.kind)}
                </Badge>
              ) : null}
              {event.metricKey ? (
                <span className={cn('font-mono text-[10px]', levelText[event.level])}>
                  {label(event.metricKey)} · {formatNumber(event.metricValue)}
                  {event.metricUnit ? ` ${event.metricUnit}` : ''}
                </span>
              ) : null}
            </div>
            <p
              className={cn(
                'mt-0.5 text-sm',
                event.level === 'error'
                  ? 'text-destructive'
                  : event.level === 'warn'
                    ? 'text-warning-strong'
                    : '',
              )}
            >
              {event.message ?? label(event.kind)}
            </p>
            {event.kind !== 'stage' && Object.keys(event.data).length > 0 ? (
              <details className="mt-1">
                <summary className="text-muted-foreground cursor-pointer text-[11px]">
                  Details
                </summary>
                <div className="mt-1">
                  <JsonBlock value={event.data} />
                </div>
              </details>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
