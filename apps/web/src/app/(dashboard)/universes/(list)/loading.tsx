import { TablePageSkeleton } from '@/components/dashboard/skeletons';

export default function Loading() {
  return (
    <TablePageSkeleton
      columns={[
        { header: 'w-10', width: 'w-20', secondaryWidth: 'w-28', lines: 2 },
        { header: 'w-16', width: 'w-24' },
        { header: 'w-16', width: 'w-20' },
        { header: 'w-16', width: 'w-24' },
        { header: 'w-24', badge: true, width: 'w-10' },
        { header: 'w-16', width: 'w-8' },
        { actions: true },
      ]}
      rows={12}
    />
  );
}
