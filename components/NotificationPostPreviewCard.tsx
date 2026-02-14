'use client'

import React from 'react';
import { AvatarGroup } from './AvatarGroup';

export interface NotificationPostPreviewItem {
  id: string;
  post_id: string;
  post_images?: string[];
  notification_count?: number;
  interaction_total?: number;
  likes?: number;
  saves?: number;
  interaction_avatars?: (string | null)[];
  boost_status?: 'pending' | 'reject' | 'success' | string | null;
  boost_expires_at?: string | null;
}

// Mini PostCard Image Component - Layout เหมือน PhotoGrid แต่ขนาดเล็ก
const MiniPostImage = ({ images }: { images: string[] }) => {
  const imageSize = '72px'; // ขนาดเล็กเท่าเดิม

  if (!images || images.length === 0) {
    return (
      <div
        style={{
          width: imageSize,
          height: imageSize,
          borderRadius: '10px',
          background: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#5c5c5c">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
        </svg>
      </div>
    );
  }

  const count = images.length;
  const gap = '2px';

  // Single image
  if (count === 1) {
    return (
      <div
        style={{
          position: 'relative',
          width: imageSize,
          height: imageSize,
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <img
          src={images[0]}
          alt="Post"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          loading="lazy"
        />
      </div>
    );
  }

  // Two images
  if (count === 2) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: gap,
          width: imageSize,
          height: imageSize,
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        {images.slice(0, 2).map((img, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              height: '100%',
            }}
          >
            <img
              src={img}
              alt={`Post ${i + 1}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    );
  }

  // Three images - Layout: รูปแรกใหญ่ซ้าย, 2 รูปเล็กขวา (เหมือน PhotoGrid)
  if (count === 3) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: gap,
          width: imageSize,
          height: imageSize,
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            gridRow: 'span 2',
            borderTopLeftRadius: '10px',
            borderBottomLeftRadius: '10px',
          }}
        >
          <img
            src={images[0]}
            alt="Post 1"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            loading="lazy"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: gap }}>
          {images.slice(1, 3).map((img, i) => (
            <div
              key={i + 1}
              style={{
                position: 'relative',
                overflow: 'hidden',
                aspectRatio: '1',
                borderTopRightRadius: i === 0 ? '10px' : '0',
                borderBottomRightRadius: i === 1 ? '10px' : '0',
              }}
            >
              <img
                src={img}
                alt={`Post ${i + 2}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Four images - 2x2 grid (เหมือน PhotoGrid)
  if (count === 4) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: gap,
          width: imageSize,
          height: imageSize,
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        {images.map((img, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              overflow: 'hidden',
              aspectRatio: '1',
              borderTopLeftRadius: i === 0 ? '10px' : '0',
              borderTopRightRadius: i === 1 ? '10px' : '0',
              borderBottomLeftRadius: i === 2 ? '10px' : '0',
              borderBottomRightRadius: i === 3 ? '10px' : '0',
            }}
          >
            <img
              src={img}
              alt={`Post ${i + 1}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    );
  }

  // Five or more images - Layout: 2 รูปบน, 3 รูปล่าง (เหมือน PhotoGrid)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: gap,
        width: imageSize,
        height: imageSize,
        borderRadius: '10px',
        overflow: 'hidden',
      }}
    >
      {/* Top row: 2 images */}
      {images.slice(0, 2).map((img, i) => (
        <div
          key={i}
          style={{
            position: 'relative',
            overflow: 'hidden',
            aspectRatio: '1',
            borderTopLeftRadius: i === 0 ? '10px' : '0',
            borderTopRightRadius: i === 1 ? '10px' : '0',
          }}
        >
          <img
            src={img}
            alt={`Post ${i + 1}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            loading="lazy"
          />
        </div>
      ))}
      {/* Bottom row: 3 images */}
      <div
        style={{
          gridColumn: 'span 2',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: gap,
        }}
      >
        {images.slice(2, 5).map((img, i) => {
          const idx = i + 2;
          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                overflow: 'hidden',
                aspectRatio: '1',
                borderBottomLeftRadius: i === 0 ? '10px' : '0',
                borderBottomRightRadius: i === 2 ? '10px' : '0',
              }}
            >
              <img
                src={img}
                alt={`Post ${idx + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                loading="lazy"
              />
              {idx === 4 && count > 5 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    borderBottomRightRadius: '10px',
                  }}
                >
                  +{count - 5}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const NotificationPostPreviewCard = React.memo<{
  notification: NotificationPostPreviewItem;
  isReadStyle: boolean;
  timeAgoText: string;
  onNavigateToPost: (postId: string) => void;
}>(({ notification, isReadStyle, timeAgoText, onNavigateToPost }) => {
  const interactionTotal =
    typeof notification.interaction_total === 'number'
      ? notification.interaction_total
      : (notification.likes || 0) + (notification.saves || 0);

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
        alignItems: 'flex-start',
        padding: '16px 20px',
        cursor: 'pointer',
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: isReadStyle ? '#fff' : '#e7f3ff',
        transition: 'background-color 0.2s',
        gap: '16px',
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
      {/* Post Image */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <MiniPostImage images={notification.post_images || []} />
      </div>

      {/* Notification Content */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
        {/* แถวบนสุด: x ຄົນມັກໂພສຂອງທ່ານ + Avatar */}
        <div
          style={{
            fontSize: '14px',
            lineHeight: '1.4',
            color: '#050505',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '6px',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#4a4d52' }}>{interactionTotal}</span>
          <span style={{ color: '#050505' }}>ຄົນມັກໂພສຂອງທ່ານ</span>
          <AvatarGroup avatars={notification.interaction_avatars || []} totalCount={interactionTotal} />
        </div>

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

