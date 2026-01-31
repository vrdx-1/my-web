'use client'

import React from 'react';
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon';

export const AvatarGroup = React.memo<{
  avatars: (string | null)[];
  totalCount: number;
}>(({ avatars, totalCount }) => {
  const size = 36;
  const overlap = 12;
  const border = '2px solid #fff';

  const shown = (avatars || []).filter((v) => v !== undefined);

  if (shown.length === 0 && (totalCount || 0) <= 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        marginLeft: '6px',
        justifyContent: 'flex-start',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {shown.map((src, idx) => (
          <div
            key={`${src}-${idx}`}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: '50%',
              overflow: 'hidden',
              background: src ? '#e6e6e6' : '#e4e6eb',
              border,
              marginLeft: idx === 0 ? 0 : `-${overlap}px`,
              position: 'relative',
              zIndex: 100 - idx,
              flexShrink: 0,
            }}
          >
            {src ? (
              <img
                src={src}
                alt="Profile"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                <GuestAvatarIcon size={18} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

AvatarGroup.displayName = 'AvatarGroup';

