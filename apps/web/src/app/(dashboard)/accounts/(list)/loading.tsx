import { TablePageSkeleton } from '@/components/dashboard/skeletons';

export default function Loading() {
  return (
    <TablePageSkeleton
      columns={[
        { header: 'w-10', width: 'w-20', secondaryWidth: 'w-28', lines: 2 },
        { header: 'w-10', badge: true, width: 'w-14' },
        { header: 'w-16', width: 'w-8' },
        { header: 'w-14', width: 'w-20' },
        { header: 'w-20', width: 'w-8' },
        { header: 'w-24', width: 'w-24' },
        { actions: true },
      ]}
      rows={12}
    />
  );
}
