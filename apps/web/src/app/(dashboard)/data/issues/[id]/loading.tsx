import { PageSkeleton } from '@/components/dashboard/skeletons';

export default function Loading() {
  return <PageSkeleton stats={0} sections={2} />;
}
