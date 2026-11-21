import { PaginationSkeleton, TablePageSkeleton } from '@/components/dashboard/skeletons';

export default function Loading() {
  return (
    <TablePageSkeleton
      summaryCount={3}
      columns={[
        { header: 'w-10', width: 'w-20', secondaryWidth: 'w-28', lines: 2 },
        { header: 'w-14', badge: true, width: 'w-16' },
        { header: 'w-24', badge: true, width: 'w-10', secondaryWidth: 'w-16', lines: 1 },
        { header: 'w-16', width: 'w-6' },
        { header: 'w-20', width: 'w-6' },
        { actions: true },
      ]}
      footer={<PaginationSkeleton mode="offset" />}
      rows={12}
    />
  );
}
