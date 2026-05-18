/**
 * Guest token — ใช้ระบุตัวตนของ Guest เมื่อยังไม่ล็อกอิน (สำหรับ search_logs เป็นต้น)
 */

const GUEST_TOKEN_KEY = 'guest_token';
const LEGACY_DEVICE_GUEST_TOKEN_KEY = 'device_guest_token';

function generateToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12);
}

export function getOrCreateGuestToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existingGuestToken = localStorage.getItem(GUEST_TOKEN_KEY);
    if (existingGuestToken && existingGuestToken.trim() !== '') {
      return existingGuestToken;
    }

    const legacyDeviceToken = localStorage.getItem(LEGACY_DEVICE_GUEST_TOKEN_KEY);
    if (legacyDeviceToken && legacyDeviceToken.trim() !== '') {
      localStorage.setItem(GUEST_TOKEN_KEY, legacyDeviceToken);
      return legacyDeviceToken;
    }

    const token = generateToken();
    localStorage.setItem(GUEST_TOKEN_KEY, token);
    localStorage.setItem(LEGACY_DEVICE_GUEST_TOKEN_KEY, token);
    return token;
  } catch {
    return generateToken();
  }
}
