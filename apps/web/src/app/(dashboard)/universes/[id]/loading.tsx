import {
  DetailHeaderSkeleton,
  IconButtonSkeleton,
  KeyValueGridSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={2} actions={1} metaWidth="w-56" />
      <StatGridSkeleton count={4} />

      <SectionSkeleton className="mt-4" titleWidth="w-40" descriptionWidth="w-80">
        <KeyValueGridSkeleton columns={4} items={4} />
      </SectionSkeleton>

      <div className="mt-4 space-y-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <SectionSkeleton
            key={index}
            titleWidth="w-24"
            descriptionWidth="w-96"
            actions={
              <>
                <Skeleton className="h-5 w-14 rounded-full" />
                <IconButtonSkeleton />
              </>
            }
          >
            <TableSkeleton
              columns={[
                { header: 'w-10', width: 'w-6' },
                { header: 'w-16', width: 'w-16' },
                { header: 'w-16', width: 'w-28' },
                { header: 'w-12', width: 'w-20' },
                { header: 'w-28', width: 'w-24' },
                { header: 'w-14', width: 'w-20' },
                { actions: true },
              ]}
              rows={6}
            />
          </SectionSkeleton>
        ))}
      </div>
    </div>
  );
}
