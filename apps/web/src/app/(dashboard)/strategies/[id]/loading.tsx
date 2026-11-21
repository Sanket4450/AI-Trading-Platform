import {
  DetailHeaderSkeleton,
  IconButtonSkeleton,
  JsonBlockSkeleton,
  MiniRowListSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={2} actions={1} metaWidth="w-64" />
      <StatGridSkeleton count={3} />

      <SectionSkeleton className="mt-4" titleWidth="w-40" descriptionWidth="w-64">
        <Skeleton className="h-4 w-96 max-w-full" />
      </SectionSkeleton>

      <div className="mt-4 space-y-4">
        <SectionSkeleton
          titleWidth="w-24"
          descriptionWidth="w-96"
          actions={
            <>
              <Skeleton className="h-5 w-14 rounded-full" />
              <IconButtonSkeleton />
            </>
          }
          contentClassName="space-y-5"
        >
          <div>
            <Skeleton className="mb-2 h-4 w-40" />
            <TableSkeleton
              columns={[
                { header: 'w-12', badge: true, width: 'w-14' },
                { header: 'w-24', width: 'w-28' },
                { header: 'w-14', width: 'w-8' },
                { header: 'w-16', width: 'w-32' },
                { header: 'w-16', width: 'w-20' },
                { actions: true },
              ]}
              rows={4}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Skeleton className="mb-2 h-4 w-24" />
              <MiniRowListSkeleton rows={2} />
            </div>
            <div>
              <Skeleton className="mb-2 h-4 w-32" />
              <JsonBlockSkeleton lines={8} />
            </div>
          </div>
        </SectionSkeleton>
      </div>
    </div>
  );
}
