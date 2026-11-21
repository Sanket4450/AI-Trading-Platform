import {
  DetailHeaderSkeleton,
  IssueListSkeleton,
  PaginationSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
} from '@/components/dashboard/skeletons';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={1} links={1} actions={0} metaWidth="w-48" />
      <StatGridSkeleton count={3} columns={3} />

      <SectionSkeleton
        className="mt-4"
        titleWidth="w-36"
        descriptionWidth="w-80"
        footer={<PaginationSkeleton />}
      >
        <IssueListSkeleton rows={4} columns={2} />
      </SectionSkeleton>
    </div>
  );
}
