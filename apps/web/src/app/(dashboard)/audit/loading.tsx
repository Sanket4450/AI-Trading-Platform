import { PageSkeleton } from '@/components/dashboard/skeletons';

export default function Loading() {
  return <PageSkeleton stats={4} sections={1} />;
}
