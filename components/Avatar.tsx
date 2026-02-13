import React from 'react';
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon';
import { getDisplayAvatarUrl } from '@/utils/avatarUtils';

interface AvatarProps {
  avatarUrl?: string | null;
  size?: number;
  session?: any;
  className?: string;
}

/**
 * Reusable Avatar component
 * รูปจาก OAuth (100x100, s100 ฯลฯ) จะถูกถือว่า default → แสดงไอคอนเงาแทน
 */
export const Avatar = React.memo<AvatarProps>(({
  avatarUrl,
  size = 40,
  session,
  className
}) => {
  const displayUrl = getDisplayAvatarUrl(avatarUrl);
  const defaultSize = size;

  return (
    <div
      style={{
        width: `${defaultSize}px`,
        height: `${defaultSize}px`,
        borderRadius: '50%',
        background: '#e4e6eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0
      }}
      className={className}
    >
      {displayUrl ? (
        <img
          src={displayUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          alt="Avatar"
          loading="lazy"
        />
      ) : (
        <GuestAvatarIcon size={defaultSize * 0.65} />
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';
