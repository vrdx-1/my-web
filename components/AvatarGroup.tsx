'use client'

import React from 'react';
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon';

const AVATAR_SIZE = 28;
const OVERLAP = 8;
const MAX_VISIBLE_AVATARS = 5; // แสดงรูปสูงสุด 5 ตัว
const MIN_COUNT_FOR_PLUS_N = 6; // แสดง "+N" ก็ต่อเมื่อมี 6 อันขึ้นไป
const BORDER = '2px solid #fff';

export const AvatarGroup = React.memo<{
  avatars: (string | null)[];
  totalCount: number;
}>(({ avatars, totalCount }) => {
  const shown = (avatars || []).filter((v) => v !== undefined && v !== null);

  if (shown.length === 0 && (totalCount || 0) <= 0) return null;

  const showPlusN = (totalCount || 0) >= MIN_COUNT_FOR_PLUS_N;
  const toDisplay = showPlusN ? shown.slice(0, MAX_VISIBLE_AVATARS) : shown;
  const remaining = showPlusN ? Math.max(0, (totalCount || 0) - toDisplay.length) : 0;

  // พื้นที่คงที่: ไม่ให้กินพื้นที่ส่วนอื่น (เมื่อมี "+N" = สูงสุด 5 รูป + 1 วง "+N", ไม่มี "+N" = ตามจำนวนที่แสดง)
  const fixedWidth = showPlusN
    ? AVATAR_SIZE + MAX_VISIBLE_AVATARS * (AVATAR_SIZE - OVERLAP)
    : AVATAR_SIZE + Math.max(0, toDisplay.length - 1) * (AVATAR_SIZE - OVERLAP);

  const noCalloutStyle: React.CSSProperties = {
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        marginLeft: '6px',
        justifyContent: 'flex-start',
        minWidth: 0,
        flexShrink: 0,
        width: `${fixedWidth}px`,
        maxWidth: `${fixedWidth}px`,
        overflow: 'hidden',
        ...noCalloutStyle,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {toDisplay.map((src, idx) => (
          <div
            key={`${src}-${idx}`}
            style={{
              width: `${AVATAR_SIZE}px`,
              height: `${AVATAR_SIZE}px`,
              borderRadius: '50%',
              overflow: 'hidden',
              background: src ? '#e6e6e6' : '#e4e6eb',
              border: BORDER,
              marginLeft: idx === 0 ? 0 : `-${OVERLAP}px`,
              position: 'relative',
              zIndex: 100 - idx,
              flexShrink: 0,
              ...noCalloutStyle,
            }}
          >
            {src ? (
              <img
                src={src}
                alt="Profile"
                style={{ width: '100%', height: '100%', objectFit: 'cover', ...noCalloutStyle }}
                loading="lazy"
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <GuestAvatarIcon size={14} />
              </div>
            )}
          </div>
        ))}
        {remaining > 0 && (
          <div
            style={{
              width: `${AVATAR_SIZE}px`,
              height: `${AVATAR_SIZE}px`,
              borderRadius: '50%',
              overflow: 'hidden',
              background: '#e4e6eb',
              border: BORDER,
              marginLeft: `-${OVERLAP}px`,
              position: 'relative',
              zIndex: 100 - MAX_VISIBLE_AVATARS,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
              color: '#4a4d52',
            }}
          >
            +{remaining}
          </div>
        )}
      </div>
    </div>
  );
});

AvatarGroup.displayName = 'AvatarGroup';

