import {
  ButtonSkeleton,
  IconButtonSkeleton,
  IssueListSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/dashboard/skeletons';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <StatGridSkeleton count={8} columns={4} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <SectionSkeleton
          titleWidth="w-28"
          descriptionWidth="w-80"
          toolbar={<ButtonSkeleton width="w-28" />}
          actions={<IconButtonSkeleton />}
        >
          <TableSkeleton
            columns={[
              { header: 'w-10', width: 'w-24', secondaryWidth: 'w-16', lines: 2 },
              { header: 'w-14', badge: true, width: 'w-16' },
              { header: 'w-16', width: 'w-28' },
              { header: 'w-16', width: 'w-28' },
              { actions: true },
            ]}
            rows={6}
          />
        </SectionSkeleton>

        <SectionSkeleton titleWidth="w-36" descriptionWidth="w-64">
          <IssueListSkeleton rows={4} />
        </SectionSkeleton>
      </div>
    </div>
  );
}
