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
export const PREFETCH_COUNT = 3; // โหลดเพิ่มทีละ 3 items
/** จำนวนโพสต์ต่อหนึ่งหน้าในฟีดลิสต์ (saved / liked / sold / my-posts) — โหลดทั้งหมดในครั้งเดียว */
export const LIST_FEED_PAGE_SIZE = 1000;
/** จำนวนโพสต์ที่โหลดในหน้าโฮมต่อหนึ่งครั้ง (เมื่อเลื่อนลง) — โหลดเพิ่มทีละ 10 รายการ */
export const FEED_PAGE_SIZE = 10;
/** จำนวนโพสต์ชุดแรกที่โหลดในหน้าโฮม (6 รายการ — balance ระหว่างโหลดเร็วกับความสมูท) */
export const INITIAL_FEED_PAGE_SIZE = 6;
/** หน้าโฮม (แท็บแนะนำ): ดึงโพสจากเซิร์ฟเวอร์ทีละ 1 โพส */
export const HOME_FEED_PAGE_SIZE = 1;
/** อายุ cache ฟีดหน้าโฮม (มิลลิวินาที) — ใช้แสดงผลทันทีเมื่อกลับมาเปิดเว็บ แล้วค่อยโหลดที่อัปเดตใหม่ทีหลัง */
export const FEED_CACHE_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000; // 2 วัน
/** จำนวนการแจ้งเตือนต่อหน้า (lazy load หน้า Notification) */
export const NOTIFICATION_PAGE_SIZE = 20;
/** อายุ cache รายการหน้าแจ้งเตือน (มิลลิวินาที) — แสดงของเก่าก่อน แล้วโหลดใหม่ด้านหลัง */
export const NOTIFICATION_LIST_CACHE_MAX_AGE_MS = 2 * 60 * 1000; // 2 นาที

/** Infinite scroll: โหลดหน้าถัดไปล่วงหน้าเมื่อผู้ใช้เลื่อนใกล้ล่าง (ระดับสากล เช่น Facebook, Instagram) */
export const FEED_PRELOAD_ROOT_MARGIN = '0px 0px 800px 0px';
export const FEED_PRELOAD_THRESHOLD = 0;

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
