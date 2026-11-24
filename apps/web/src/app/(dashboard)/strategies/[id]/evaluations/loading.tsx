import {
  DetailHeaderSkeleton,
  TablePageSkeleton,
} from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={2} actions={2} metaWidth="w-24" />
      <TablePageSkeleton
        summaryCount={3}
        showSearch={false}
        filters={
          <>
            <Skeleton className="h-8 w-32 rounded-md" />
            <Skeleton className="h-8 w-36 rounded-md" />
          </>
        }
        columns={[
          { header: 'w-20', width: 'w-28' },
          { header: 'w-16', width: 'w-24' },
          { header: 'w-14', badge: true, width: 'w-16' },
          { header: 'w-20', width: 'w-28' },
          { header: 'w-14', width: 'w-20' },
          { header: 'w-20', width: 'w-16' },
          { header: 'w-20', width: 'w-12' },
          { actions: true },
        ]}
        rows={8}
      />
    </div>
  );
}
