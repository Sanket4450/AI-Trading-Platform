import {
  DetailHeaderSkeleton,
  IconButtonSkeleton,
  MiniRowListSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/dashboard/skeletons';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={2} actions={2} metaWidth="w-72" />
      <StatGridSkeleton count={4} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <SectionSkeleton titleWidth="w-28" descriptionWidth="w-96" actions={<IconButtonSkeleton />}>
          <TableSkeleton
            columns={[
              { header: 'w-14', width: 'w-20', secondaryWidth: 'w-28', lines: 2 },
              { header: 'w-16', badge: true, width: 'w-14' },
              { header: 'w-16', width: 'w-24' },
              { header: 'w-16', width: 'w-28' },
              { actions: true },
            ]}
            rows={8}
          />
        </SectionSkeleton>

        <div className="space-y-4">
          <SectionSkeleton
            titleWidth="w-32"
            descriptionWidth="w-64"
            actions={<IconButtonSkeleton />}
          >
            <TableSkeleton
              columns={[
                { header: 'w-16', width: 'w-28' },
                { header: 'w-10', width: 'w-16' },
                { header: 'w-16', width: 'w-20' },
                { actions: true },
              ]}
              rows={6}
            />
          </SectionSkeleton>

          <SectionSkeleton titleWidth="w-16" descriptionWidth="w-48">
            <MiniRowListSkeleton rows={2} />
          </SectionSkeleton>
        </div>
      </div>

      <SectionSkeleton
        className="mt-4"
        titleWidth="w-32"
        descriptionWidth="w-96"
        actions={<IconButtonSkeleton />}
      >
        <TableSkeleton
          columns={[
            { header: 'w-10', width: 'w-20' },
            { header: 'w-10', width: 'w-16' },
            { header: 'w-14', badge: true, width: 'w-16' },
            { header: 'w-20', width: 'w-16' },
            { actions: true },
          ]}
          rows={5}
        />
      </SectionSkeleton>
    </div>
  );
}
