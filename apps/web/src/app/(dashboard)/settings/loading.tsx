import {
  ButtonSkeleton,
  IconButtonSkeleton,
  KeyValueGridSkeleton,
  SectionSkeleton,
  TableSkeleton,
} from '@/components/dashboard/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <SectionSkeleton titleWidth="w-48" descriptionWidth="w-80">
        <KeyValueGridSkeleton columns={4} items={8} />
      </SectionSkeleton>

      <SectionSkeleton
        className="mt-4"
        titleWidth="w-44"
        descriptionWidth="w-96"
        toolbar={
          <>
            <Skeleton className="h-8 w-72 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </>
        }
        actions={
          <>
            <IconButtonSkeleton />
            <ButtonSkeleton width="w-28" />
          </>
        }
      >
        <TableSkeleton
          columns={[
            { header: 'w-10', badge: true, width: 'w-14' },
            { header: 'w-12', width: 'w-20' },
            { header: 'w-14', width: 'w-8' },
            { header: 'w-10', width: 'w-32' },
            { header: 'w-24', width: 'w-20' },
            { header: 'w-24', width: 'w-20' },
            { actions: true },
          ]}
          rows={8}
        />
      </SectionSkeleton>

      <div className="mt-6 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>

      <div className="mt-3 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SectionSkeleton
            key={index}
            titleWidth="w-40"
            descriptionWidth="w-80"
            actions={<ButtonSkeleton width="w-20" />}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Skeleton className="h-7 w-40 rounded-md" />
              <Skeleton className="h-5 w-32 rounded-full" />
            </div>
          </SectionSkeleton>
        ))}
      </div>
    </div>
  );
}
