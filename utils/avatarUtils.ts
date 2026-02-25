/**
 * รูปโปรไฟล์จาก OAuth (Google/Facebook) มักเป็น thumbnail 100x100
 * เฉพาะ URL จาก domain เหล่านี้ + มี pattern ขนาดเล็ก ถึงจะถือว่า "default" (แสดงไอคอนเงาแทน)
 * URL อื่น (เช่น Supabase Storage) แสดงรูปตามปกติ — อย่าใช้ ?width=100 / size=100 ไปตัดทุกที่
 */
const OAUTH_AVATAR_DOMAINS = [
  'googleusercontent.com',
  'google.com',
  'fbcdn.net',
  'facebook.com',
];

const OAUTH_SMALL_SIZE_PATTERNS = [
  '100x100',
  '100×100',
  '=s100',
  '/s100',
  's100-c',
  'sz=100',
];

/**
 * คืนค่า true ถ้า url เป็นรูป default จาก OAuth (ต้องการแสดงไอคอนเงาแทน)
 * เฉพาะ domain OAuth + มี pattern ขนาดเล็กเท่านั้น
 */
export function isProviderDefaultAvatar(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  const isOAuthDomain = OAUTH_AVATAR_DOMAINS.some((d) => lower.includes(d));
  if (!isOAuthDomain) return false;
  return OAUTH_SMALL_SIZE_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * คืนค่า URL สำหรับแสดง: ถ้าเป็น default ให้คืน '' เพื่อให้ UI แสดง Avatar เงา
 * ถ้า allowOAuthDefault = true จะไม่ตัด URL จาก OAuth (ใช้เมื่ออยากแสดงรูปโปรไฟล์เสมอ เช่น Bottom Nav)
 */
export function getDisplayAvatarUrl(
  url: string | null | undefined,
  allowOAuthDefault?: boolean
): string {
  if (!url || typeof url !== 'string') return '';
  if (allowOAuthDefault) return url;
  return isProviderDefaultAvatar(url) ? '' : url;
}
