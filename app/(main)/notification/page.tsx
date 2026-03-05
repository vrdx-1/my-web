'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { NotificationSkeleton } from '@/components/NotificationSkeleton';
import { LAO_FONT } from '@/utils/constants';
import { NotificationPostPreviewCard } from '@/components/NotificationPostPreviewCard';
import { useNotificationPage } from '@/hooks/useNotificationPage';
import { useNotificationRefreshContext } from '@/contexts/NotificationRefreshContext';
import type { NotificationItemWithTime } from '@/hooks/useNotificationPage';

/** การ์ดเดียว — ไม่สร้าง IntersectionObserver เอง เพื่อลดงานตอนสลับออก (observer เดียวที่ parent) */
function NotificationCard({
  item,
  index,
  shouldLoadImage,
  onNavigateToPost,
}: {
  item: NotificationItemWithTime;
  index: number;
  shouldLoadImage: boolean;
  onNavigateToPost: (postId: string) => void;
}) {
  const isReadStyle =
    typeof item.notification_count !== 'number' || item.notification_count <= 0;
  return (
    <NotificationPostPreviewCard
      notification={item}
      isReadStyle={isReadStyle}
      timeAgoText={item.timeAgoText}
      onNavigateToPost={onNavigateToPost}
      priority={index === 0 && shouldLoadImage}
      shouldLoadImage={shouldLoadImage}
    />
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

/** Observer เดียวสำหรับทุกการ์ด — สลับออกเร็ว (unmount แค่ disconnect ครั้งเดียว) */
function useNotificationListLazyImages(
  scrollRootRef: React.RefObject<HTMLDivElement | null>,
  listLength: number
) {
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(() => new Set([0]));
  const cardRefsRef = useRef<(HTMLDivElement | null)[]>([]);

  const setCardRef = useCallback((index: number, el: HTMLDivElement | null) => {
    const arr = cardRefsRef.current;
    while (arr.length <= index) arr.push(null);
    arr[index] = el;
  }, []);

  useEffect(() => {
    if (listLength === 0) return;
    const root = scrollRootRef.current;
    if (!root) return;
    setVisibleIndices((prev) => (prev.has(0) ? prev : new Set([0, ...prev])));
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const idx = e.target.getAttribute('data-notification-index');
          if (idx === null) continue;
          const i = parseInt(idx, 10);
          if (Number.isNaN(i)) continue;
          setVisibleIndices((prev) => (prev.has(i) ? prev : new Set([...prev, i])));
        }
      },
      { root, rootMargin: '200px', threshold: 0 }
    );
    const id = requestAnimationFrame(() => {
      const arr = cardRefsRef.current;
      for (let i = 0; i < listLength; i++) {
        const el = arr[i];
        if (el) obs.observe(el);
      }
    });
    return () => {
      cancelAnimationFrame(id);
      obs.disconnect();
    };
  }, [listLength, scrollRootRef]);

  return { visibleIndices, setCardRef };
}

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
  const { visibleIndices, setCardRef } = useNotificationListLazyImages(
    scrollContainerRef,
    visibleItemsWithTime.length
  );

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
              <div
                key={uniqueKey}
                ref={(el) => setCardRef(index, el)}
                data-notification-index={index}
              >
                <NotificationCard
                  item={item}
                  index={index}
                  shouldLoadImage={visibleIndices.has(index) || index === 0}
                  onNavigateToPost={onNavigateToPost}
                />
              </div>
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
