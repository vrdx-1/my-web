'use client'

import React from 'react';
import { AvatarGroup } from './AvatarGroup';

export interface NotificationPostPreviewItem {
  id: string;
  post_images?: string[];
  notification_count?: number;
  interaction_total?: number;
  likes?: number;
  saves?: number;
  interaction_avatars?: (string | null)[];
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
  onClick: () => void;
}>(({ notification, isReadStyle, timeAgoText, onClick }) => {
  const interactionTotal =
    typeof notification.interaction_total === 'number'
      ? notification.interaction_total
      : (notification.likes || 0) + (notification.saves || 0);

  return (
    <div
      onClick={onClick}
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
      {/* Post Image + per-post notification count badge */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <MiniPostImage images={notification.post_images || []} />
        {typeof notification.notification_count === 'number' && notification.notification_count > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '16px',
              height: '16px',
              padding: '0 4px',
              borderRadius: '999px',
              background: '#e0245e',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '16px',
            }}
          >
            {notification.notification_count > 99 ? '99+' : notification.notification_count}
          </div>
        )}
      </div>

      {/* Notification Content */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
        <div
          style={{
            fontSize: '17px',
            lineHeight: '1.4',
            color: '#050505',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '17px', fontWeight: '600', color: '#4a4d52' }}>{interactionTotal}</span>
          <span>ຄົນມັກໂພສຂອງທ່ານ</span>
          <AvatarGroup avatars={notification.interaction_avatars || []} totalCount={interactionTotal} />
        </div>
        <div style={{ fontSize: '15px', color: '#4a4d52', marginTop: '6px' }}>{timeAgoText}</div>
      </div>
    </div>
  );
});

NotificationPostPreviewCard.displayName = 'NotificationPostPreviewCard';

