import {
  DetailHeaderSkeleton,
  IconButtonSkeleton,
  IssueListSkeleton,
  MonthGridSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={3} actions={3} metaWidth="w-56" />
      <StatGridSkeleton count={4} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <SectionSkeleton titleWidth="w-24" descriptionWidth="w-96">
          <MonthGridSkeleton months={12} />
        </SectionSkeleton>

        <SectionSkeleton titleWidth="w-32" descriptionWidth="w-80" actions={<IconButtonSkeleton />}>
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

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionSkeleton titleWidth="w-24" descriptionWidth="w-96" actions={<IconButtonSkeleton />}>
          <TableSkeleton
            columns={[
              { header: 'w-10', width: 'w-16' },
              { header: 'w-14', width: 'w-28' },
              { header: 'w-10', width: 'w-16' },
              { header: 'w-14', badge: true, width: 'w-16' },
              { actions: true },
            ]}
            rows={5}
          />
        </SectionSkeleton>

        <SectionSkeleton titleWidth="w-24" descriptionWidth="w-80">
          <IssueListSkeleton rows={4} />
        </SectionSkeleton>
      </div>

      <SectionSkeleton
        className="mt-4"
        titleWidth="w-36"
        descriptionWidth="w-96"
        actions={<IconButtonSkeleton />}
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
