import {
  DetailHeaderSkeleton,
  JsonBlockSkeleton,
  KeyValueGridSkeleton,
  SectionSkeleton,
  StageRailSkeleton,
  StatGridSkeleton,
  TimelineSkeleton,
} from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={1} actions={2} metaWidth="w-72" />
      <StatGridSkeleton count={4} />

      <SectionSkeleton className="mt-4" titleWidth="w-16" descriptionWidth="w-96">
        <StageRailSkeleton stages={5} />
      </SectionSkeleton>

      <SectionSkeleton className="mt-4" titleWidth="w-36" descriptionWidth="w-56">
        <StatGridSkeleton count={4} />
      </SectionSkeleton>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionSkeleton titleWidth="w-20" descriptionWidth="w-80">
          <TimelineSkeleton rows={7} />
        </SectionSkeleton>

        <SectionSkeleton titleWidth="w-28" descriptionWidth="w-64">
          <KeyValueGridSkeleton columns={2} items={6} />
          <div className="mt-4 space-y-3">
            <div>
              <Skeleton className="mb-1 h-2.5 w-16" />
              <JsonBlockSkeleton lines={4} />
            </div>
            <div>
              <Skeleton className="mb-1 h-2.5 w-14" />
              <JsonBlockSkeleton lines={3} />
            </div>
          </div>
        </SectionSkeleton>
      </div>
    </div>
  );
}
