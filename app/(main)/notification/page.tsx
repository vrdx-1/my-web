'use client';

import React, { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { NotificationSkeleton } from '@/components/NotificationSkeleton';
import { LAO_FONT } from '@/utils/constants';
import { NotificationPostPreviewCard } from '@/components/NotificationPostPreviewCard';
import { useNotificationPage } from '@/hooks/useNotificationPage';
import { useNotificationRefreshContext } from '@/contexts/NotificationRefreshContext';
import type { NotificationItemWithTime } from '@/hooks/useNotificationPage';

function NotificationCardWithLazyImage({
  item,
  index,
  rootRef,
  onNavigateToPost,
}: {
  item: NotificationItemWithTime;
  index: number;
  rootRef: React.RefObject<HTMLDivElement | null>;
  onNavigateToPost: (postId: string) => void;
}) {
  const [shouldLoadImage, setShouldLoadImage] = useState(index === 0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (index === 0) return;
    const root = rootRef.current;
    const el = cardRef.current;
    if (!root || !el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setShouldLoadImage(true);
      },
      { root, rootMargin: '200px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index, rootRef]);

  const isReadStyle =
    typeof item.notification_count !== 'number' || item.notification_count <= 0;
  return (
    <div ref={cardRef}>
      <NotificationPostPreviewCard
        notification={item}
        isReadStyle={isReadStyle}
        timeAgoText={item.timeAgoText}
        onNavigateToPost={onNavigateToPost}
        priority={index === 0 && shouldLoadImage}
        shouldLoadImage={shouldLoadImage}
      />
    </div>
  );
}

const BOTTOM_SLOT_STYLE = {
  minHeight: 88,
  height: 88,
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  flexShrink: 0,
};

const HEADER_STYLE = {
  padding: '15px',
  borderBottom: '1px solid #f0f0f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'sticky' as const,
  top: 0,
  background: '#ffffff',
  backgroundColor: '#ffffff',
  zIndex: 1000,
  flexShrink: 0,
};

export default function NotificationPage() {
  const {
    loading,
    notifications,
    visibleItemsWithTime,
    lastElementRef,
    onNavigateToPost,
    loadingMore,
    hasMore,
    scrollContainerRef,
    refresh,
  } = useNotificationPage();
  const notificationRefreshContext = useNotificationRefreshContext();
  const didScrollToTopRef = useRef(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (loading || notifications.length === 0) return;
    if (didScrollToTopRef.current) return;
    didScrollToTopRef.current = true;
    requestAnimationFrame(() => scrollContainerRef.current?.scrollTo(0, 0));
  }, [loading, notifications.length, scrollContainerRef]);

  useEffect(() => {
    notificationRefreshContext?.register(refresh);
    return () => notificationRefreshContext?.register(null);
  }, [notificationRefreshContext, refresh]);

  return (
    <main
      style={{
        background: '#ffffff',
        backgroundColor: '#ffffff',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: LAO_FONT,
      }}
    >
      <div style={HEADER_STYLE}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center', color: '#111111' }}>
          ການແຈ້ງເຕືອນ
        </h1>
      </div>

      {loading ? (
        <div style={{ flex: 1 }}>
          <NotificationSkeleton count={5} />
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center', flex: 1 }}>
          <EmptyState message="ບໍ່ມີການແຈ້ງເຕືອນ" variant="minimal" />
        </div>
      ) : (
        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto' }}>
          {visibleItemsWithTime.map((item, index) => {
            const uniqueKey = `${item.post_id}-${item.created_at}-${index}`;
            return (
              <NotificationCardWithLazyImage
                key={uniqueKey}
                item={item}
                index={index}
                rootRef={scrollContainerRef}
                onNavigateToPost={onNavigateToPost}
              />
            );
          })}
          <div ref={lastElementRef} style={{ minHeight: 8, pointerEvents: 'none' }} aria-hidden="true" />
          {loadingMore && <NotificationSkeleton count={2} />}
          <div style={BOTTOM_SLOT_STYLE} className="notification-bottom-slot">
            {!hasMore && !loadingMore && visibleItemsWithTime.length > 0 && (
              <span style={{ fontSize: 13, color: '#888' }}>ບໍ່ມີລາຍການເພີ່ມເຕີມ</span>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
