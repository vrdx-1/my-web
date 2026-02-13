/**
 * รูปโปรไฟล์จาก OAuth (Google/Facebook) มักเป็น thumbnail 100x100
 * ถ้า URL เป็นแบบนี้ ให้ถือว่าเป็น "default" และแสดง Avatar เงาคนสีเทาแทน
 */
const PROVIDER_DEFAULT_PATTERNS = [
  '100x100',
  '100×100',
  '=s100',      // Google: =s100-c
  '/s100',
  's100-c',
  'sz=100',     // Google บางรูปแบบ
  '?width=100',
  '&width=100',
  'height=100',
  'size=100',
];

/**
 * คืนค่า true ถ้า url เป็นรูป default จาก OAuth (ต้องการแสดงไอคอนเงาแทน)
 */
export function isProviderDefaultAvatar(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return PROVIDER_DEFAULT_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * คืนค่า URL สำหรับแสดง: ถ้าเป็น default ให้คืน '' เพื่อให้ UI แสดง Avatar เงา
 */
export function getDisplayAvatarUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  return isProviderDefaultAvatar(url) ? '' : url;
}
