import { Skeleton } from '@/components/ui/skeleton';
import { statGridColumnClasses, type StatGridColumns } from '@/components/dashboard/stat-card';
import { cn } from '@/lib/utils';

/** Suspense fallback for a selection-dependent detail panel. */
export function DetailSkeleton({ blocks = 2, className }: { blocks?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 xl:grid-cols-2', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: blocks }).map((_, block) => (
        <div key={block} className="border-border/70 bg-card/40 rounded-xl border p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-64" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((__, row) => (
              <Skeleton key={row} className="h-6 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Route-level loading UI shared by every dashboard segment. */
export function PageSkeleton({
  stats = 4,
  columns = 4,
  sections = 2,
}: {
  stats?: number;
  columns?: StatGridColumns;
  sections?: number;
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      {stats > 0 ? (
        <div className={cn('grid auto-rows-fr gap-3', statGridColumnClasses[columns])}>
          {Array.from({ length: stats }).map((_, index) => (
            <div key={index} className="border-border/70 bg-card/40 rounded-xl border p-3">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="mt-2 h-5 w-16" />
              <Skeleton className="mt-2 h-2.5 w-28" />
            </div>
          ))}
        </div>
      ) : null}
      <div className={cn('space-y-4', stats > 0 && 'mt-4')}>
        {Array.from({ length: sections }).map((_, index) => (
          <div key={index} className="border-border/70 bg-card/40 rounded-xl border p-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="mt-2 h-3 w-72" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }).map((__, row) => (
                <Skeleton key={row} className="h-7 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
