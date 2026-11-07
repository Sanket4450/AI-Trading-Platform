import {
  DetailHeaderSkeleton,
  KeyValueGridSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
} from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={1} actions={3} metaWidth="w-80" />
      <StatGridSkeleton count={5} columns={5} />

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionSkeleton titleWidth="w-16" descriptionWidth="w-56" contentClassName="space-y-3">
          <KeyValueGridSkeleton columns={2} items={6} />
        </SectionSkeleton>

        <SectionSkeleton titleWidth="w-24" descriptionWidth="w-80">
          <KeyValueGridSkeleton columns={2} items={5} />
        </SectionSkeleton>
      </div>

      <div className="mt-4">
        <Skeleton className="h-2.5 w-20" />
      </div>
    </div>
  );
}
