import {
  DetailHeaderSkeleton,
  IconButtonSkeleton,
  IssueListSkeleton,
  MonthGridSkeleton,
  PaginationSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={3} actions={2} metaWidth="w-56" />
      <StatGridSkeleton count={4} />

      <SectionSkeleton
        className="mt-4"
        titleWidth="w-20"
        descriptionWidth="w-64"
        actions={<IconButtonSkeleton />}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-28" />
        </div>
      </SectionSkeleton>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <SectionSkeleton titleWidth="w-24" descriptionWidth="w-96">
          <MonthGridSkeleton months={12} />
        </SectionSkeleton>

        <SectionSkeleton
          titleWidth="w-32"
          descriptionWidth="w-80"
          actions={<IconButtonSkeleton />}
          footer={<PaginationSkeleton />}
        >
          <TableSkeleton
            columns={[
              { header: 'w-16', width: 'w-16' },
              { header: 'w-20', width: 'w-24' },
              { header: 'w-12', width: 'w-10' },
              { header: 'w-16', width: 'w-20' },
              { actions: true },
            ]}
            rows={3}
          />
        </SectionSkeleton>
      </div>

      <SectionSkeleton
        className="mt-4"
        titleWidth="w-24"
        descriptionWidth="w-96"
        footer={<PaginationSkeleton />}
      >
        <IssueListSkeleton rows={4} columns={2} />
      </SectionSkeleton>

      <SectionSkeleton
        className="mt-4"
        titleWidth="w-36"
        descriptionWidth="w-96"
        actions={<IconButtonSkeleton />}
        footer={<PaginationSkeleton />}
      >
        <TableSkeleton
          columns={[
            { header: 'w-14', width: 'w-20' },
            { header: 'w-14', width: 'w-14' },
            { header: 'w-14', badge: true, width: 'w-16' },
            { header: 'w-16', width: 'w-14' },
            { header: 'w-20', width: 'w-14' },
            { actions: true },
          ]}
          rows={4}
        />
      </SectionSkeleton>

      <div className="mt-4">
        <Skeleton className="h-2.5 w-28" />
      </div>
    </div>
  );
}
