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
    sessionReady: ctx?.sessionReady ?? false,
    userProfile: ctx?.userProfile ?? null,
    activeProfileId: ctx?.activeProfileId ?? null,
    authUserId: ctx?.authUserId ?? null,
    availableProfiles: ctx?.availableProfiles ?? [],
    setActiveProfile: ctx?.setActiveProfile ?? (() => {}),
    activateProfileRecord: ctx?.activateProfileRecord ?? (() => {}),
    refetchProfiles: ctx?.refetchProfiles ?? (async () => {}),
    startSessionCheck: ctx?.startSessionCheck ?? (() => {}),
  };
}
