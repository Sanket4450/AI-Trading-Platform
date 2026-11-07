import {
  DetailHeaderSkeleton,
  IconButtonSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/dashboard/skeletons';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={1} actions={2} metaWidth="w-80" />
      <StatGridSkeleton count={5} columns={5} />

      <SectionSkeleton
        className="mt-4"
        titleWidth="w-28"
        descriptionWidth="w-96"
        actions={<IconButtonSkeleton />}
      >
        <TableSkeleton
          columns={[
            { header: 'w-10', width: 'w-6' },
            { header: 'w-16', width: 'w-16' },
            { header: 'w-12', width: 'w-24' },
            { header: 'w-14', width: 'w-28' },
            { header: 'w-12', width: 'w-20', secondaryWidth: 'w-24', lines: 2 },
            { header: 'w-10', width: 'w-10', secondaryWidth: 'w-14', lines: 2 },
            { header: 'w-14', badge: true, width: 'w-16' },
            { actions: true },
          ]}
          rows={8}
        />
      </SectionSkeleton>
    </div>
  );
}
