'use client'
import { Suspense } from 'react';
import { dynamicNamed } from '@/utils/lazyLoad';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { PageHeader } from '@/components/PageHeader';
import { TabNavigation } from '@/components/TabNavigation';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

const feedFallback = (
  <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#ffffff',
        backgroundColor: '#ffffff',
      }}
      aria-hidden
    >
      <PageHeader title="ໂພສຂອງຂ້ອຍ" centerTitle onBack={() => {}} showDivider={false} />
      <TabNavigation
        className="home-tab-navigation"
        tabs={[
          { value: 'recommend', label: 'ພ້ອມຂາຍ' },
          { value: 'sold', label: 'ຂາຍແລ້ວ' },
        ]}
        activeTab="recommend"
        onTabChange={() => {}}
      />
    </div>

    <div aria-hidden>
      <FeedSkeleton count={3} />
    </div>
  </main>
);

/** ปิด SSR เพื่อหลีกเลี่ยง React "Expected static flag was missing" ตอน hydrate กับ PostFeed */
const LazyMyPosts = dynamicNamed(() => import('./MyPostsContent'), 'MyPostsContent', {
  ssr: false,
  loading: () => feedFallback,
});

export default function MyPosts() {
  return (
    <Suspense fallback={feedFallback}>
      <LazyMyPosts />
    </Suspense>
  );
}
