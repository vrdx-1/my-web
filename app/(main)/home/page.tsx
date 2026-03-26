import { Suspense } from 'react';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { HomePageContent } from './HomePageContent';

export const dynamic = 'force-dynamic';

/** Fallback แค่ Skeleton — Header + แท็บ ພ້ອມຂາຍ/ຂາຍແລ້ວ มาจาก layout อยู่แล้ว */
const feedFallback = (
  <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
    <FeedSkeleton count={3} />
  </main>
);

export default function HomePage() {
  return (
    <Suspense fallback={feedFallback}>
      <HomePageContent />
    </Suspense>
  );
}
