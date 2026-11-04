import { PageSkeleton } from '@/components/dashboard/skeletons';

export default function Loading() {
  return <PageSkeleton stats={8} sections={2} />;
}
