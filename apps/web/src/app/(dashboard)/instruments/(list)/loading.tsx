import { PaginationSkeleton, TablePageSkeleton } from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <TablePageSkeleton
      filters={<Skeleton className="h-8 w-36 rounded-md" />}
      footer={<PaginationSkeleton mode="offset" />}
      columns={[
        { header: 'w-20', width: 'w-20', secondaryWidth: 'w-32', lines: 3 },
        { header: 'w-14', badge: true, width: 'w-20', secondaryWidth: 'w-32', lines: 1 },
        { header: 'w-24', width: 'w-32' },
        { header: 'w-10', width: 'w-14', secondaryWidth: 'w-28', lines: 2 },
        { header: 'w-16', width: 'w-16' },
        { header: 'w-20', width: 'w-28' },
        { actions: true },
      ]}
      rows={12}
    />
  );
}
