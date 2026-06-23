/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon';
import { getDisplayAvatarUrl } from '@/utils/avatarUtils';

interface AvatarProps {
  avatarUrl?: string | null;
  size?: number;
  session?: any;
  className?: string;
  /** true = แสดงรูปจาก OAuth เสมอ (ใช้ใน Bottom Nav / Header) ไม่ตัด URL ขนาดเล็ก */
  useProfileImage?: boolean;
  /** true = โหลดรูปทันที (eager) สำหรับ avatar ที่อยู่ above the fold เช่นการ์ดแรกในฟีด เพื่อ LCP ที่ดีขึ้น */
  eager?: boolean;
}

/**
 * Reusable Avatar component
 * รูปจาก OAuth (100x100, s100 ฯลฯ) จะถูกถือว่า default → แสดงไอคอนเงาแทน
 * ส่ง useProfileImage=true เพื่อให้แสดงรูปโปรไฟล์เสมอ (เช่น ในแถบล่าง/หัว)
 */
export const Avatar = React.memo<AvatarProps>(({
  avatarUrl,
  size = 40,
  session,
  className,
  useProfileImage = false,
  eager = false,
}) => {
  const displayUrl = getDisplayAvatarUrl(avatarUrl, useProfileImage);
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
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
        />
      ) : (
        <GuestAvatarIcon size={defaultSize * 0.65} />
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';
