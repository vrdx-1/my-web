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

const DEFAULT_SUPABASE_URL = 'https://pkvtwuwicjqodkyraune.supabase.co';

function getPublicSupabaseBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  return raw.replace(/\/$/, '');
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function normalizeImageUrl(
  url: string | null | undefined,
  bucket: string = 'car-images'
): string {
  if (!url || typeof url !== 'string') return '';

  const raw = stripWrappingQuotes(url);
  if (!raw) return '';

  if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;

  const baseUrl = getPublicSupabaseBaseUrl();

  if (raw.startsWith('/storage/v1/object/public/')) {
    return `${baseUrl}${raw}`;
  }

  if (raw.startsWith('storage/v1/object/public/')) {
    return `${baseUrl}/${raw}`;
  }

  if (raw.startsWith('/object/public/')) {
    return `${baseUrl}/storage/v1${raw}`;
  }

  if (raw.startsWith('object/public/')) {
    return `${baseUrl}/storage/v1/${raw}`;
  }

  if (raw.startsWith(`${bucket}/`)) {
    return `${baseUrl}/storage/v1/object/public/${raw}`;
  }

  const looksLikeStoragePath =
    raw.startsWith('/') ||
    raw.startsWith('avatars/') ||
    raw.startsWith('guest-uploads/') ||
    raw.startsWith('updates/') ||
    /^[0-9a-f-]+\/.+/i.test(raw);

  if (looksLikeStoragePath) {
    return `${baseUrl}/storage/v1/object/public/${bucket}/${raw.replace(/^\/+/, '')}`;
  }

  return raw;
}

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
  const normalizedUrl = normalizeImageUrl(url, 'car-images');
  if (!normalizedUrl) return '';
  if (allowOAuthDefault) return normalizedUrl;
  return isProviderDefaultAvatar(normalizedUrl) ? '' : normalizedUrl;
}
