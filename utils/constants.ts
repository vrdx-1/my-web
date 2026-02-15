/**
 * Shared Constants for the Application
 */

/** Font สำหรับข้อความภาษาลาว — ใช้เดียวกับแขวง (Arial, Helvetica, sans-serif) */
export const LAO_FONT = 'Arial, Helvetica, sans-serif';

// Lao Provinces (18 provinces)
export const LAO_PROVINCES = [
  "ຜົ້ງສາລີ",
  "ຫຼວງນ້ຳທາ",
  "ອຸດົມໄຊ",
  "ບໍ່ແກ້ວ",
  "ຫຼວງພະບາງ",
  "ຫົວພັນ",
  "ໄຊຍະບູລີ",
  "ຊຽງຂວາງ",
  "ໄຊສົມບູນ",
  "ວຽງຈັນ",
  "ນະຄອນຫຼວງວຽງຈັນ",
  "ບໍລິຄຳໄຊ",
  "ຄຳມ່ວນ",
  "ສະຫວັນນະເຂດ",
  "ສາລະວັນ",
  "ເຊກອງ",
  "ຈຳປາສັກ",
  "ອັດຕະປື"
] as const;

// Pagination Constants
export const PAGE_SIZE = 5; // โหลดครั้งแรก 5 items เพื่อให้เห็นผลเร็ว
export const PREFETCH_COUNT = 3; // โหลดเพิ่มทีละ 3 items เพื่อให้ smooth เหมือน Facebook
/** จำนวนการแจ้งเตือนต่อหน้า (lazy load หน้า Notification) */
export const NOTIFICATION_PAGE_SIZE = 20;

// Post Status Types
export const POST_STATUS = {
  RECOMMEND: 'recommend',
  SOLD: 'sold',
} as const;

// Filter Types for Admin
export type FilterType = 'D' | 'W' | 'M' | 'Y' | 'A';

export const FILTER_LABELS: Record<FilterType, string> = {
  D: 'Today',
  W: 'This Week',
  M: 'This Month',
  Y: 'This Year',
  A: 'All Time',
};
