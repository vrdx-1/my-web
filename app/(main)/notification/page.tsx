'use client';

import React, { useEffect, useRef } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { NotificationSkeleton } from '@/components/NotificationSkeleton';
import { LAO_FONT } from '@/utils/constants';
import { NotificationPostPreviewCard } from '@/components/NotificationPostPreviewCard';
import { useNotificationPage } from '@/hooks/useNotificationPage';
import { useNotificationRefreshContext } from '@/contexts/NotificationRefreshContext';

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
  background: '#fff',
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
        background: '#fff',
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
            const isReadStyle =
              typeof item.notification_count !== 'number' || item.notification_count <= 0;
            const uniqueKey = `${item.post_id}-${item.created_at}-${index}`;
            return (
              <NotificationPostPreviewCard
                key={uniqueKey}
                notification={item}
                isReadStyle={isReadStyle}
                timeAgoText={item.timeAgoText}
                onNavigateToPost={onNavigateToPost}
                priority={index === 0}
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
