import {
  DetailHeaderSkeleton,
  IssueListSkeleton,
  JsonBlockSkeleton,
  KeyValueGridSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
} from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={2} actions={2} metaWidth="w-48" />
      <StatGridSkeleton count={5} columns={5} />

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionSkeleton titleWidth="w-32" descriptionWidth="w-96">
          <KeyValueGridSkeleton columns={2} items={8} />
        </SectionSkeleton>

        <SectionSkeleton titleWidth="w-24" descriptionWidth="w-64">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <KeyValueGridSkeleton columns={2} items={3} />
          </div>
        </SectionSkeleton>
      </div>

      <SectionSkeleton
        className="mt-4"
        titleWidth="w-20"
        descriptionWidth="w-80"
        contentClassName="space-y-4"
      >
        <JsonBlockSkeleton lines={6} />
        <div>
          <Skeleton className="mb-2 h-4 w-32" />
          <IssueListSkeleton rows={2} />
        </div>
      </SectionSkeleton>
    </div>
  );
}
