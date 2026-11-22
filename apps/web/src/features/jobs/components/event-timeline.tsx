import type { JobEvent } from '@/lib/types';
import { formatClock, formatDateTime } from '@/lib/format';
import { label } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { JsonBlock } from '@/components/dashboard/json-block';
import { cn } from '@/lib/utils';
import { eventFigures } from '../progress';

const typeDot: Record<string, string> = {
  failed: 'bg-destructive',
  warning: 'bg-warning',
  completed: 'bg-success',
  skipped: 'bg-muted-foreground',
  entered: 'bg-info',
  progress: 'bg-info',
};

const typeText: Record<string, string> = {
  failed: 'text-destructive',
  warning: 'text-warning-strong',
};

/** Builds the operator-facing line from objective facts; the database stores no prose. */
function eventTitle(event: JobEvent): string {
  const stage = label(event.stage);
  const code = typeof event.data.code === 'string' ? label(event.data.code) : null;
  const reason = typeof event.data.reason === 'string' ? label(event.data.reason) : null;
  const message = typeof event.data.message === 'string' ? event.data.message : null;

  switch (event.type) {
    case 'entered':
      return `Started ${stage}`;
    case 'progress': {
      const figures = eventFigures(event);
      return figures ? `${stage} · ${figures}` : `Progress in ${stage}`;
    }
    case 'completed':
      return `Finished ${stage}`;
    case 'failed':
      return message ? `${stage} failed: ${message}` : `${stage} failed`;
    case 'skipped':
      return reason ? `Skipped ${stage} · ${reason}` : `Skipped ${stage}`;
    case 'warning':
      return code ? `Warning in ${stage} · ${code}` : `Warning in ${stage}`;
    default:
      return `${event.type} · ${stage}`;
  }
}

/** Timestamped, append-only event list. */
export function EventTimeline({ events }: { events: JobEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="No events yet"
        description="Stage facts appear here as soon as the job starts reporting."
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
              typeDot[event.type] ?? 'bg-muted-foreground',
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
              <Badge variant="outline" className="text-[10px]">
                {label(event.stage)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {label(event.type)}
              </Badge>
            </div>
            <p className={cn('mt-0.5 text-sm', typeText[event.type] ?? '')}>
              {eventTitle(event)}
            </p>
            {event.type !== 'entered' && Object.keys(event.data).length > 0 ? (
              <details className="mt-1">
                <summary className="text-muted-foreground w-fit cursor-pointer text-[11px] transition-colors hover:text-foreground">
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
