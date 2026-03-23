'use client'

import React from 'react';

export interface NotificationPostPreviewItem {
  id: string;
  post_id: string;
  post_images?: string[];
  notification_count?: number;
  sender_name?: string;
  sender_avatar?: string | null;
  boost_status?: 'pending' | 'reject' | 'success' | string | null;
  boost_expires_at?: string | null;
  /** ตัวอย่างแคปชั่นของโพสต์ (ให้ผู้ใช้รู้ว่าเป็นโพสต์ไหน) */
  post_caption?: string;
}

export const NotificationPostPreviewCard = React.memo<{
  notification: NotificationPostPreviewItem;
  isReadStyle: boolean;
  timeAgoText: string;
  onNavigateToPost: (postId: string) => void;
  /** รายการแรกในลิสต์ — โหลดรูปแบบ eager สำหรับ LCP */
  priority?: boolean;
  /** เมื่อ false ไม่โหลดรูปจนกว่าจะใกล้เห็น (ลดการโหลดพร้อมกัน) */
  shouldLoadImage?: boolean;
}>(({ notification, isReadStyle, timeAgoText, onNavigateToPost, priority = false, shouldLoadImage = true }) => {
  const firstPostImage = notification.post_images?.[0] ?? null;
  const latestName = notification.sender_name ?? 'User';

  const captionPreview =
    notification.post_caption && notification.post_caption.trim() !== ''
      ? notification.post_caption.trim()
      : '';

  const isBoostExpired =
    notification.boost_status === 'success' &&
    notification.boost_expires_at &&
    new Date(notification.boost_expires_at).getTime() <= Date.now();
  const boostBadgeConfig =
    notification.boost_status === 'pending'
      ? { text: 'ກຳລັງກວດສອບ', bg: '#fffbeb', border: '#fcd34d', color: '#92400e' }
      : notification.boost_status === 'reject'
        ? { text: 'ຖືກປະຕິເສດ', bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c' }
        : notification.boost_status === 'success'
          ? isBoostExpired
            ? { text: 'ໂຄສະນາຫມົດອາຍຸແລ້ວ', bg: '#f3f4f6', border: '#d1d5db', color: '#4b5563' }
            : { text: 'ກຳລັງໂຄສະນາ', bg: '#ecfdf5', border: '#86efac', color: '#166534' }
          : null;

  return (
    <div
      onClick={() => onNavigateToPost(notification.post_id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 14px',
        cursor: 'pointer',
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: isReadStyle ? '#fff' : '#e7f3ff',
        transition: 'background-color 0.2s',
        gap: '10px',
      }}
      onMouseEnter={(e) => {
        if (isReadStyle) {
          e.currentTarget.style.backgroundColor = '#f5f5f5';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isReadStyle ? '#fff' : '#e7f3ff';
      }}
    >
      {/* รูปรถ: ใช้รูปแรกของโพสต์ */}
      <div style={{ flexShrink: 0 }}>
        {firstPostImage && shouldLoadImage ? (
          <img
            src={firstPostImage}
            alt="Post thumbnail"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '12px', background: '#f1f3f5' }}
          />
        ) : (
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '12px',
              background: '#f1f3f5',
              border: '1px solid #e5e7eb',
            }}
          />
        )}
      </div>

      {/* Notification Content */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
        {/* แถวบนสุด: ข้อความแจ้งเตือน boost */}
        <div
          style={{
            fontSize: '14px',
            lineHeight: '1.4',
            color: '#050505',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '6px',
            minWidth: 0,
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#4a4d52', flexShrink: 0 }}>{latestName}</span>
          <span style={{ color: '#050505', flexShrink: 0 }}>
            ອັບເດດສະຖານະ Boost ໂພສຂອງທ່ານ{captionPreview ? ':' : ''}
          </span>
        </div>

        {/* แถวที่สอง: ตัวอย่างแคปชั่นของโพสต์ */}
        {captionPreview && (
          <div
            style={{
              fontSize: '13px',
              lineHeight: '1.4',
              color: '#6b6b6b',
              marginBottom: '6px',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
            title={notification.post_caption?.trim() || undefined}
          >
            &quot;{captionPreview}&quot;
          </div>
        )}

        {/* กลาง: ສະຖານະໂຄສະນາ (เฉพาะโพสต์ที่มี boost) */}
        {boostBadgeConfig && (
          <div style={{ marginTop: '2px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#6b6b6b', fontWeight: 600 }}>ສະຖານະໂຄສະນາ:</span>
            <div
              style={{
                display: 'inline-block',
                fontSize: '10px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '999px',
                background: boostBadgeConfig.bg,
                border: `1px solid ${boostBadgeConfig.border}`,
                color: boostBadgeConfig.color,
                lineHeight: 1.2,
              }}
            >
              {boostBadgeConfig.text}
            </div>
          </div>
        )}

        {/* ล่างสุด: เวลาแจ้งเตือน (ใช้รูปแบบเดียวกับ postcard) */}
        <div style={{ fontSize: '11px', color: '#6b6b6b', fontWeight: 600, marginTop: boostBadgeConfig ? '4px' : '0' }}>
          {timeAgoText}
        </div>
      </div>
    </div>
  );
});

NotificationPostPreviewCard.displayName = 'NotificationPostPreviewCard';

