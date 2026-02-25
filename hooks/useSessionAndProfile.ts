'use client';

import { useSessionProfileContext } from '@/contexts/SessionProfileContext';

/**
 * Session + profile จากแหล่งเดียว (SessionProfileContext) — Header, BottomNav ใช้ค่าเดียวกัน
 * รูปโปรไฟล์ใน Bottom Nav จะแสดงเมื่อ login แน่นอน
 */
export function useSessionAndProfile() {
  const ctx = useSessionProfileContext();
  return {
    session: ctx?.session ?? null,
    userProfile: ctx?.userProfile ?? null,
  };
}
