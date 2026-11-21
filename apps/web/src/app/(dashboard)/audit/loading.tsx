import { PaginationSkeleton, TablePageSkeleton } from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <TablePageSkeleton
      filters={<Skeleton className="h-8 w-32 rounded-md" />}
      footer={<PaginationSkeleton mode="offset" />}
      columns={[
        { header: 'w-12', width: 'w-24' },
        { header: 'w-12', width: 'w-24', secondaryWidth: 'w-16', lines: 2 },
        { header: 'w-16', badge: true, width: 'w-16', secondaryWidth: 'w-24', lines: 1 },
        { header: 'w-14', width: 'w-20', secondaryWidth: 'w-16', lines: 2 },
        { header: 'w-16', width: 'w-20' },
        { actions: true },
      ]}
      rows={12}
    />
  );
}
