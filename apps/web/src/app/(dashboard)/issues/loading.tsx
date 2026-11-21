import { PaginationSkeleton, TablePageSkeleton } from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <TablePageSkeleton
      showSearch={false}
      filters={
        <>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-36 rounded-md" />
          ))}
        </>
      }
      footer={<PaginationSkeleton mode="cursor" />}
      columns={[
        { header: 'w-14', badge: true, width: 'w-16' },
        { header: 'w-10', width: 'w-28' },
        { header: 'w-12', width: 'w-20' },
        { header: 'w-10', width: 'w-24' },
        { header: 'w-14', width: 'w-28' },
        { header: 'w-10', width: 'w-8' },
        { header: 'w-16', width: 'w-28' },
        { actions: true },
      ]}
      rows={12}
    />
  );
}
