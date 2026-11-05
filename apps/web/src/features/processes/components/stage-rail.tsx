import type { ProcessStage } from '@/lib/types';
import { formatClock, formatDuration } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';

const stageTones: Record<string, string> = {
  succeeded: 'border-success/40 bg-success/10 text-success',
  running: 'border-info/50 bg-info/10 text-info',
  failed: 'border-destructive/50 bg-destructive/10 text-destructive',
  skipped: 'border-border/70 bg-muted/10 text-muted-foreground',
  pending: 'border-border/60 bg-background/40 text-muted-foreground',
};

/** Ordered rail of a run's stages, including stages not reached yet. */
export function StageRail({ stages }: { stages: ProcessStage[] }) {
  if (stages.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No stages recorded for this run. The timeline below still shows every event.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2 lg:flex-row">
      {stages.map((stage, index) => {
        const tone = stageTones[stage.status] ?? stageTones.pending;
        const reached = stage.status !== 'pending';

        return (
          <li key={stage.key} className="min-w-0 flex-1">
            <div className={cn('h-full rounded-lg border p-3', tone)}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                    reached ? 'border-current' : 'border-border text-muted-foreground',
                  )}
                >
                  {index + 1}
                </span>
                <span className="truncate text-xs font-medium">{label(stage.key)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-[0.14em]">
                  {label(stage.status)}
                </span>
                <span className="font-mono text-[10px] opacity-80">
                  {stage.durationMs === null ? '—' : formatDuration(stage.durationMs)}
                </span>
              </div>
              {stage.enteredAt ? (
                <p className="mt-1 font-mono text-[10px] opacity-70">
                  {formatClock(stage.enteredAt)} → {formatClock(stage.completedAt)}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
