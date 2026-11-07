import {
  ButtonSkeleton,
  HeatmapSkeleton,
  IconButtonSkeleton,
  IssueListSkeleton,
  KeyValueGridSkeleton,
  PlanListSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <StatGridSkeleton count={5} columns={5} />

      <SectionSkeleton
        className="mt-4"
        titleWidth="w-36"
        descriptionWidth="w-96"
        actions={
          <>
            <ButtonSkeleton width="w-28" />
            <ButtonSkeleton width="w-28" />
            <ButtonSkeleton width="w-32" />
          </>
        }
      >
        <KeyValueGridSkeleton columns={4} items={8} />
      </SectionSkeleton>

      <SectionSkeleton className="mt-4" titleWidth="w-48" descriptionWidth="w-96">
        <HeatmapSkeleton rows={16} columns={28} />
      </SectionSkeleton>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionSkeleton titleWidth="w-28" descriptionWidth="w-80">
          <PlanListSkeleton rows={4} />
        </SectionSkeleton>

        <SectionSkeleton titleWidth="w-28" descriptionWidth="w-80">
          <IssueListSkeleton rows={3} />
        </SectionSkeleton>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionSkeleton titleWidth="w-28" descriptionWidth="w-80" actions={<IconButtonSkeleton />}>
          <TableSkeleton
            columns={[
              { header: 'w-10', width: 'w-16' },
              { header: 'w-16', width: 'w-20' },
              { header: 'w-16', width: 'w-28' },
              { header: 'w-12', width: 'w-16' },
              { header: 'w-14', badge: true, width: 'w-16' },
              { actions: true },
            ]}
            rows={6}
          />
        </SectionSkeleton>

        <SectionSkeleton
          titleWidth="w-48"
          descriptionWidth="w-96"
          actions={<ButtonSkeleton width="w-24" />}
        >
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </SectionSkeleton>
      </div>
    </div>
  );
}
