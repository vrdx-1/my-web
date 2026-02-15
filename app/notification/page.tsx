'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';
import { LAO_FONT } from '@/utils/constants';
import { PageSpinner } from '@/components/LoadingSpinner';
import { NotificationPostPreviewCard } from '@/components/NotificationPostPreviewCard';
import { useNotificationPage } from '@/hooks/useNotificationPage';

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

const BACK_BUTTON_STYLE: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px',
  touchAction: 'manipulation',
  position: 'absolute',
  left: '15px',
  zIndex: 1001,
};

export default function NotificationPage() {
  const router = useRouter();
  const { loading, notifications, visibleItemsWithTime, lastElementRef, onNavigateToPost, loadingMore, hasMore, scrollContainerRef } =
    useNotificationPage();

  const handleBack = useCallback(() => {
    if (typeof window === 'undefined') {
      router.back();
      return;
    }
    if (window.history.length <= 1) {
      router.push('/');
      return;
    }
    const before = window.location.href;
    router.back();
    window.setTimeout(() => {
      if (window.location.href === before) router.push('/');
    }, 150);
  }, [router]);

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
        <button type="button" onClick={handleBack} style={BACK_BUTTON_STYLE} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center', color: '#111111' }}>
          ການແຈ້ງເຕືອນ
        </h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', flex: 1 }}>
          <PageSpinner />
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
              />
            );
          })}
          <div ref={lastElementRef} style={{ minHeight: 8, pointerEvents: 'none' }} aria-hidden="true" />
          <div style={BOTTOM_SLOT_STYLE} className="notification-bottom-slot">
            <span style={{ visibility: loadingMore ? 'visible' : 'hidden', display: 'inline-block' }}>
              <PageSpinner />
            </span>
            {!hasMore && !loadingMore && visibleItemsWithTime.length > 0 && (
              <span style={{ fontSize: 13, color: '#888' }}>ບໍ່ມີລາຍການເພີ່ມເຕີມ</span>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
