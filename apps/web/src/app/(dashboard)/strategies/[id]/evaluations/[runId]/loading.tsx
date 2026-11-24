import {
  DetailHeaderSkeleton,
  JsonBlockSkeleton,
  KeyValueGridSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={2} links={1} actions={2} metaWidth="w-40" />
      <Skeleton className="mb-4 h-12 w-full rounded-lg" />
      <StatGridSkeleton count={8} />
      <SectionSkeleton className="mt-4" titleWidth="w-28" descriptionWidth="w-80">
        <KeyValueGridSkeleton columns={3} items={9} />
      </SectionSkeleton>
      <SectionSkeleton className="mt-4" titleWidth="w-24" descriptionWidth={null}>
        <TableSkeleton
          columns={[
            { header: 'w-16', width: 'w-20' },
            { header: 'w-20', lines: 2, width: 'w-24', secondaryWidth: 'w-28' },
            { header: 'w-14', badge: true, width: 'w-14' },
            { header: 'w-16', width: 'w-16' },
            { header: 'w-12', width: 'w-12' },
            { header: 'w-12', width: 'w-12' },
            { header: 'w-12', width: 'w-12' },
            { header: 'w-10', width: 'w-10' },
            { header: 'w-14', badge: true, width: 'w-14' },
            { actions: true },
          ]}
          rows={6}
        />
      </SectionSkeleton>
      <SectionSkeleton className="mt-4" titleWidth="w-32" descriptionWidth={null}>
        <TableSkeleton
          columns={[
            { header: 'w-16', width: 'w-16' },
            { header: 'w-20', lines: 2, width: 'w-20', secondaryWidth: 'w-24' },
            { header: 'w-14', badge: true, width: 'w-14' },
            { header: 'w-16', width: 'w-20' },
            { header: 'w-10', width: 'w-8' },
            { actions: true },
          ]}
          rows={6}
        />
      </SectionSkeleton>
      <Skeleton className="mt-4 h-16 w-full rounded-lg" />
      <JsonBlockSkeleton lines={4} />
    </div>
  );
}
