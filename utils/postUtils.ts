/**
 * Utility functions for post-related operations
 * Shared across multiple pages for better maintainability
 */

import { safeParseJSON } from './storageUtils';

export interface OnlineStatus {
  isOnline: boolean;
  text: string;
}

/**
 * Get online status based on last seen timestamp
 */
export const getOnlineStatus = (lastSeen: string | null): OnlineStatus => {
  if (!lastSeen) return { isOnline: false, text: '' };
  const now = new Date().getTime();
  const lastActive = new Date(lastSeen).getTime();
  const diffInSeconds = Math.floor((now - lastActive) / 1000);
  
  if (diffInSeconds < 300) return { isOnline: true, text: 'ອອນລາຍ' };
  if (diffInSeconds < 60) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ເມື່ອຄູ່` };
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInMinutes} ນາທີທີ່ແລ້ວ` };
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInHours} ຊົ່ວໂມງທີ່ແລ້ວ` };
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInDays} ມື້ທີ່ແລ້ວ` };
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInWeeks} ອາທິດທີ່ແລ້ວ` };
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInMonths} ເດືອນທີ່ແລ້ວ` };
  
  const diffInYears = Math.floor(diffInDays / 365);
  return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInYears} ປີທີ່ແລ້ວ` };
};

/**
 * Format time difference from now
 */
export const formatTime = (dateString: string): string => {
  const now = new Date().getTime();
  const postTime = new Date(dateString).getTime();
  const diffInSeconds = Math.floor((now - postTime) / 1000);
  
  if (diffInSeconds < 60) return 'ເມື່ອຄູ່';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} ນາທີ`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} ຊົ່ວໂມງ`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} ມື້`;
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks} ອາທິດ`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} ເດືອນ`;
  
  const diffInYears = Math.floor(diffInDays / 365);
  if (diffInYears >= 1) return `${diffInYears} ປີທີ່ແລ້ວ`;
  
  return new Date(dateString).toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' });
};

/**
 * Check if current user is the owner of the post
 */
export const isPostOwner = (post: any, session: any): boolean => {
  if (session && String(post.user_id) === String(session.user.id)) return true;
  
  if (typeof window === 'undefined') return false;
  const stored = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
  return stored.some((item: any) => String(item.post_id) === String(post.id));
};

/**
 * Get primary guest token from localStorage
 */
export const getPrimaryGuestToken = (): string => {
  if (typeof window === 'undefined') return '';
  const stored = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
  if (stored.length > 0 && stored[0]?.token) return stored[0].token;
  
  let deviceToken = localStorage.getItem('device_guest_token');
  if (!deviceToken) {
    deviceToken = 'guest-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_guest_token', deviceToken);
  }
  return deviceToken;
};
