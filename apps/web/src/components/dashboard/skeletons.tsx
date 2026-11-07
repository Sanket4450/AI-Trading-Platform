import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { statGridColumnClasses, type StatGridColumns } from '@/components/dashboard/stat-card';
import { cn } from '@/lib/utils';

export interface SkeletonColumn {
  /** Width class for the header label. */
  header?: string;
  /** Width class for the first body line. */
  width?: string;
  /** Width class for the second body line. */
  secondaryWidth?: string;
  lines?: number;
  badge?: boolean;
  actions?: boolean;
}

/** Stat card placeholder with the same label/value/hint rhythm as StatCard. */
export function StatCardSkeleton() {
  return (
    <Card size="sm" className="border-border/70 bg-card/60">
      <CardContent>
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="mt-2 h-5 w-16" />
        <Skeleton className="mt-2 h-3 w-28" />
      </CardContent>
    </Card>
  );
}

export function StatGridSkeleton({
  count = 4,
  columns = 4,
}: {
  count?: number;
  columns?: StatGridColumns;
}) {
  return (
    <div className={cn('grid auto-rows-fr gap-3', statGridColumnClasses[columns])}>
      {Array.from({ length: count }).map((_, index) => (
        <StatCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Table placeholder that keeps real column widths, row padding and optional sticky header. */
export function TableSkeleton({
  columns,
  rows = 6,
  stickyHeader = false,
  containerClassName,
}: {
  columns: readonly SkeletonColumn[];
  rows?: number;
  stickyHeader?: boolean;
  containerClassName?: string;
}) {
  return (
    <Table containerClassName={containerClassName}>
      <TableHeader className={cn(stickyHeader && 'bg-card sticky top-0 z-10')}>
        <TableRow>
          {columns.map((column, index) => (
            <TableHead key={index} className={column.actions ? 'w-px' : undefined}>
              {column.actions ? null : (
                <Skeleton className={cn('h-2.5', column.header ?? 'w-14')} />
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, row) => (
          <TableRow key={row}>
            {columns.map((column, index) => (
              <TableCell
                key={index}
                className={cn(
                  column.actions && 'w-px py-1 text-right',
                  column.lines && column.lines > 1 && 'py-2.5',
                )}
              >
                <TableCellSkeleton column={column} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TableCellSkeleton({ column }: { column: SkeletonColumn }) {
  if (column.actions) {
    return (
      <div className="flex items-center justify-end">
        <Skeleton className="size-7 rounded-md" />
      </div>
    );
  }

  if (column.badge) {
    return (
      <div className={cn(column.lines ? 'space-y-1.5' : undefined)}>
        <Skeleton className={cn('h-5 rounded-full', column.width ?? 'w-14')} />
        {column.lines ? (
          <Skeleton className={cn('h-2.5', column.secondaryWidth ?? 'w-20')} />
        ) : null}
      </div>
    );
  }

  const lines = column.lines ?? 1;
  if (lines === 1) {
    return <Skeleton className={cn('h-5', column.width ?? 'w-20')} />;
  }

  return (
    <div className="space-y-1">
      <Skeleton className={cn('h-4', column.width ?? 'w-24')} />
      <Skeleton className={cn('h-3', column.secondaryWidth ?? 'w-16')} />
      {lines > 2 ? <Skeleton className="h-2.5 w-12" /> : null}
    </div>
  );
}

/** SectionCard placeholder with the same header, spacing and content area. */
export function SectionSkeleton({
  titleWidth = 'w-40',
  descriptionWidth = 'w-72',
  toolbar,
  actions,
  className,
  contentClassName,
  children,
}: {
  titleWidth?: string;
  descriptionWidth?: string | null;
  toolbar?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const hasHeaderControls = Boolean(toolbar || actions);

  return (
    <Card className={cn('border-border/70 bg-card/60', className)}>
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 space-y-1">
            <Skeleton className={cn('h-5', titleWidth)} />
            {descriptionWidth ? <Skeleton className={cn('h-4', descriptionWidth)} /> : null}
          </div>
          {hasHeaderControls ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
              {toolbar}
              {actions}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

/** DetailHeader placeholder: badges, metadata and right-aligned actions. */
export function DetailHeaderSkeleton({
  badges = 2,
  actions = 1,
  metaWidth = 'w-64',
}: {
  badges?: number;
  actions?: number;
  metaWidth?: string;
}) {
  return (
    <div className="border-border/70 bg-card/40 mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {Array.from({ length: badges }).map((_, index) => (
          <Skeleton key={index} className="h-5 w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className={cn('h-3.5', metaWidth)} />{' '}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {Array.from({ length: actions }).map((_, index) => (
          <Skeleton key={index} className="h-7 w-24 rounded-md" />
        ))}
      </div>
    </div>
  );
}

/** KeyValueGrid placeholder with matching column breakpoints. */
export function KeyValueGridSkeleton({
  columns = 2,
  items = 4,
}: {
  columns?: 2 | 3 | 4;
  items?: number;
}) {
  const columnClasses = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 xl:grid-cols-3',
    4: 'sm:grid-cols-2 xl:grid-cols-4',
  } as const;

  return (
    <dl className={cn('grid gap-3', columnClasses[columns])}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="min-w-0">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-1 h-5 w-3/4" />
        </div>
      ))}
    </dl>
  );
}

export function JsonBlockSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="border-border/70 bg-background/60 max-h-80 overflow-hidden rounded-lg border p-3">
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn('h-2.5', index % 3 === 0 ? 'w-2/3' : index % 3 === 1 ? 'w-1/2' : 'w-3/4')}
          />
        ))}
      </div>
    </div>
  );
}

/** List of bordered issue cards, used by overview, data health and instrument detail. */
export function IssueListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="border-border/70 bg-background/40 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-2.5 w-56" />
        </div>
      ))}
    </div>
  );
}

/** Backfill-plan cards with a mono ID, status badge and two metadata lines. */
export function PlanListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="border-border/70 bg-background/40 block rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-2.5 w-3/4" />
          <Skeleton className="mt-1.5 h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Compact grant/activation rows with a right-aligned badge. */
export function MiniRowListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="border-border/70 bg-background/40 flex items-center justify-between rounded-lg border px-3 py-2"
        >
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-36" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function StageRailSkeleton({ stages = 5 }: { stages?: number }) {
  return (
    <ol className="flex flex-col gap-2 lg:flex-row">
      {Array.from({ length: stages }).map((_, index) => (
        <li key={index} className="min-w-0 flex-1">
          <div className="border-border/70 bg-background/40 h-full rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Skeleton className="h-2 w-16" />
              <Skeleton className="h-2 w-10" />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TimelineSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <ol>
      {Array.from({ length: rows }).map((_, index) => (
        <li
          key={index}
          className="border-border/60 relative flex gap-3 border-l py-2.5 pl-4 last:border-l-transparent"
        >
          <span className="bg-muted ring-card absolute -left-[5px] top-4 size-2.5 rounded-full ring-4" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-2.5 w-14" />
            </div>
            <Skeleton className="mt-1.5 h-3 w-2/3" />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function MonthGridSkeleton({ months = 12 }: { months?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: months }).map((_, index) => (
        <div key={index} className="border-border/70 bg-background/40 rounded-lg border p-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="mt-2 h-2.5 w-full" />
          <Skeleton className="mt-1.5 h-2 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** Coverage heatmap placeholder: instrument labels plus a dense grid of day cells. */
export function HeatmapSkeleton({ rows = 16, columns = 28 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-x-auto">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Skeleton className="mr-1 h-2.5 w-20 shrink-0" />
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={index} className="h-2.5 w-4 shrink-0" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex items-center gap-1">
            <Skeleton className="mr-1 h-3 w-20 shrink-0" />
            {Array.from({ length: columns }).map((_, column) => (
              <Skeleton key={column} className="size-4 shrink-0 rounded-sm" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full-height list-page placeholder matching TableCard. */
export function TablePageSkeleton({
  summaryCount = 4,
  columns,
  rows = 12,
  filters,
}: {
  summaryCount?: number;
  columns: readonly SkeletonColumn[];
  rows?: number;
  filters?: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy="true" aria-live="polite">
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <div className="border-border/70 flex shrink-0 flex-col gap-2 border-b px-3 py-2.5 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 xl:flex-1">
            {Array.from({ length: summaryCount }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'flex min-w-0 flex-col',
                  index > 0 && 'border-border/60 border-l pl-4',
                )}
              >
                <Skeleton className="h-2 w-14" />
                <Skeleton className="mt-1.5 h-3.5 w-16" />
              </div>
            ))}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
            <Skeleton className="h-8 w-full sm:w-72 xl:w-80" />
            {filters}
            <Skeleton className="size-8 rounded-md" />
          </div>
        </div>
        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          <TableSkeleton
            columns={columns}
            rows={rows}
            stickyHeader
            containerClassName="h-full overflow-auto"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function ButtonSkeleton({ width = 'w-24' }: { width?: string }) {
  return <Skeleton className={cn('h-8 rounded-md', width)} />;
}

export function IconButtonSkeleton() {
  return <Skeleton className="size-8 rounded-md" />;
}
