import { PageSkeleton } from '@/components/dashboard/skeletons';

export default function Loading() {
  return <PageSkeleton stats={5} columns={5} sections={2} />;
}
