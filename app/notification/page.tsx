'use client';

import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';
import { LAO_FONT } from '@/utils/constants';
import { PageSpinner } from '@/components/LoadingSpinner';
import { NotificationPostPreviewCard } from '@/components/NotificationPostPreviewCard';
import { useNotificationPage } from '@/hooks/useNotificationPage';

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

const BACK_BUTTON_STYLE = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px',
  touchAction: 'manipulation' as const,
  position: 'absolute' as const,
  left: '15px',
};

export default function NotificationPage() {
  const router = useRouter();
  const { loading, notifications, visibleItemsWithTime, lastElementRef, onNavigateToPost } =
    useNotificationPage();

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
        <button type="button" onClick={() => router.back()} style={BACK_BUTTON_STYLE} aria-label="Back">
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
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visibleItemsWithTime.map((item, index) => {
            const isReadStyle =
              typeof item.notification_count !== 'number' || item.notification_count <= 0;
            const isLast = index === visibleItemsWithTime.length - 1;
            const card = (
              <NotificationPostPreviewCard
                key={item.id}
                notification={item}
                isReadStyle={isReadStyle}
                timeAgoText={item.timeAgoText}
                onNavigateToPost={onNavigateToPost}
              />
            );
            return isLast ? (
              <div key={item.id} ref={lastElementRef}>
                {card}
              </div>
            ) : (
              card
            );
          })}
        </div>
      )}
    </main>
  );
}
