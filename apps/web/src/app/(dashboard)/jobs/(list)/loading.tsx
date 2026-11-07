import { TablePageSkeleton } from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <TablePageSkeleton
      filters={<Skeleton className="h-8 w-32 rounded-md" />}
      columns={[
        { header: 'w-10', width: 'w-24', secondaryWidth: 'w-16', lines: 2 },
        { header: 'w-12', width: 'w-20' },
        { header: 'w-14', width: 'w-24' },
        { header: 'w-16', width: 'w-28' },
        { header: 'w-16', width: 'w-16' },
        { header: 'w-14', badge: true, width: 'w-16' },
        { actions: true },
      ]}
      rows={12}
    />
  );
}
