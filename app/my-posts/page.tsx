'use client'
import { Suspense } from 'react';
import { dynamicNamed } from '@/utils/lazyLoad';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { PageHeader } from '@/components/PageHeader';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

const feedFallback = (
  <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
    <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff' }} aria-hidden>
      <PageHeader title="ໂພສຂອງຂ້ອຍ" centerTitle onBack={() => {}} />
    </div>
    {/* Profile skeleton (ไม่แสดงตัวหนังสือ) */}
    <div style={{ padding: '20px', borderBottom: 'none' }} aria-hidden>
      <style>{`
        @keyframes my-posts-profile-skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '20px' }}>
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: '50%',
            flexShrink: 0,
            background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
            backgroundSize: '200% 100%',
            animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, paddingTop: 10 }}>
          <div
            style={{
              height: 18,
              width: '70%',
              maxWidth: 160,
              borderRadius: 8,
              background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
              backgroundSize: '200% 100%',
              animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
            }}
          />
          <div
            style={{
              height: 44,
              width: '100%',
              borderRadius: 10,
              background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
              backgroundSize: '200% 100%',
              animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </div>

    {/* Tabs skeleton (ไม่แสดงตัวหนังสือ) */}
    <div
      style={{
        position: 'sticky',
        top: 60,
        zIndex: 99,
        background: '#ffffff',
        backgroundColor: '#ffffff',
        display: 'flex',
        minHeight: 32,
        height: 32,
      }}
      aria-hidden
    >
      <div style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 32, width: '100%' }}>
        <div
          style={{
            flex: 1,
            minHeight: 32,
            padding: '0px 15px 0px 15px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
          }}
        >
          <div
            style={{
              height: 14,
              width: '70%',
              maxWidth: 140,
              borderRadius: 8,
              background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
              backgroundSize: '200% 100%',
              animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
              marginTop: 4,
            }}
          />
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 32,
            padding: '0px 15px 0px 15px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
          }}
        >
          <div
            style={{
              height: 14,
              width: '60%',
              maxWidth: 140,
              borderRadius: 8,
              background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
              backgroundSize: '200% 100%',
              animation: 'my-posts-profile-skeleton-shimmer 1.2s ease-in-out infinite',
              marginTop: 4,
            }}
          />
        </div>

      </div>
    </div>

    <FeedSkeleton count={3} />
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
