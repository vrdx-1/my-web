/**
 * เรียก API ล้าง cache ฟีดฝั่ง server (fire-and-forget)
 * ใช้หลังสร้าง/แก้ไข/ขาย/Boost โพสต์ เพื่อให้ฟีดถัดไปดึงข้อมูลใหม่
 */
export function invalidateFeedCacheClient(): void {
  if (typeof window === 'undefined') return;
  fetch('/api/cache/invalidate-feed', { method: 'POST' }).catch(() => {});
}
