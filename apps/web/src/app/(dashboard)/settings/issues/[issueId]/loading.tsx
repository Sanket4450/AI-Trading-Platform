import {
  DetailHeaderSkeleton,
  JsonBlockSkeleton,
  KeyValueGridSkeleton,
  SectionSkeleton,
} from '@/components/dashboard/skeletons';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton badges={2} actions={3} metaWidth="w-80" />

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionSkeleton titleWidth="w-16" descriptionWidth="w-64">
          <KeyValueGridSkeleton columns={2} items={6} />
        </SectionSkeleton>

        <SectionSkeleton titleWidth="w-20" descriptionWidth="w-96">
          <KeyValueGridSkeleton columns={2} items={5} />
        </SectionSkeleton>
      </div>

      <SectionSkeleton className="mt-4" titleWidth="w-20" descriptionWidth="w-96">
        <JsonBlockSkeleton lines={8} />
      </SectionSkeleton>
    </div>
  );
}
