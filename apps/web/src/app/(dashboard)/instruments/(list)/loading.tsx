import { TablePageSkeleton } from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <TablePageSkeleton
      filters={<Skeleton className="h-8 w-36 rounded-md" />}
      columns={[
        { header: 'w-8', width: 'w-6' },
        { header: 'w-20', width: 'w-24', secondaryWidth: 'w-32', lines: 3 },
        { header: 'w-14', badge: true, width: 'w-16', secondaryWidth: 'w-24', lines: 1 },
        { header: 'w-24', width: 'w-28' },
        { header: 'w-10', width: 'w-12', secondaryWidth: 'w-20', lines: 2 },
        { header: 'w-12', width: 'w-14' },
        { header: 'w-20', width: 'w-24' },
        { actions: true },
      ]}
      rows={12}
    />
  );
}
