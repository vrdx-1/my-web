/**
 * Guest token — ใช้ระบุตัวตนของ Guest เมื่อยังไม่ล็อกอิน (สำหรับ search_logs เป็นต้น)
 */

const GUEST_TOKEN_KEY = 'guest_token';

function generateToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12);
}

export function getOrCreateGuestToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    let token = localStorage.getItem(GUEST_TOKEN_KEY);
    if (!token || token.trim() === '') {
      token = generateToken();
      localStorage.setItem(GUEST_TOKEN_KEY, token);
    }
    return token;
  } catch {
    return generateToken();
  }
}
