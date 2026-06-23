/**
 * ย่อ/บีบอัดรูปจาก Supabase Storage แบบ on-the-fly (ไม่แตะไฟล์ต้นฉบับ)
 *
 * แปลง public object URL → render/image endpoint ของ Supabase แล้วเติม width/quality
 *   จาก: https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *   เป็น: https://<proj>.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=..&quality=..
 *
 * - ใช้ได้เฉพาะ URL ที่เป็น Supabase Storage public เท่านั้น
 * - ข้าม data:/blob:/URL ภายนอก (OAuth ฯลฯ) — คืนค่าเดิมไม่แตะ
 * - ปรับ/ปิดได้ตลอดเวลา: ลด/เพิ่มเลข หรือคืน url เดิมเพื่อกลับไปใช้รูปเต็ม (ต้นฉบับไม่เคยถูกแก้)
 *
 * หมายเหตุ: ต้องใช้ Supabase Pro plan ขึ้นไป (image transformation)
 */

const OBJECT_PUBLIC_SEGMENT = '/storage/v1/object/public/';
const RENDER_IMAGE_SEGMENT = '/storage/v1/render/image/public/';

/**
 * สวิตช์เปิด/ปิดการย่อรูป
 *
 * ⚠️ ต้องไปเปิด "Image Transformation" ใน Supabase Dashboard ก่อน
 *    (Project Settings → Storage → Image Transformation → Enable)
 *    มิฉะนั้น render endpoint จะตอบ 403 FeatureNotEnabled แล้วรูปจะหาย
 *
 * เมื่อเปิดใน Dashboard แล้ว → เปลี่ยนเป็น true เพื่อเริ่มย่อรูป
 */
export const IMAGE_TRANSFORM_ENABLED = true;

export interface SupabaseImageTransformOptions {
  width?: number;
  quality?: number;
}

/** ค่าเริ่มต้นสำหรับรูปในกริดฟีด — ปรับที่นี่ที่เดียวเพื่อเปลี่ยนทั้งระบบ */
export const FEED_IMAGE_TRANSFORM: SupabaseImageTransformOptions = {
  width: 800,
  quality: 75,
};

export function transformSupabaseImageUrl(
  url: string,
  options: SupabaseImageTransformOptions = FEED_IMAGE_TRANSFORM
): string {
  if (typeof url !== 'string') return url;

  // ฟีเจอร์ปิดอยู่ → คืน URL เดิม (รูปเต็มความชัด) ไม่แตะอะไร
  if (!IMAGE_TRANSFORM_ENABLED) return url;

  const trimmed = url.trim();
  if (!trimmed) return url;

  // ข้ามรูปฝัง (data:), blob: และ URL ที่ผ่าน transform แล้ว
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return url;
  if (trimmed.includes(RENDER_IMAGE_SEGMENT)) return url;

  // เฉพาะ Supabase Storage public object URL เท่านั้น
  if (!trimmed.includes(OBJECT_PUBLIC_SEGMENT)) return url;

  const params: string[] = [];
  if (typeof options.width === 'number' && options.width > 0) {
    params.push(`width=${Math.round(options.width)}`);
  }
  if (typeof options.quality === 'number' && options.quality > 0) {
    params.push(`quality=${Math.round(options.quality)}`);
  }
  if (params.length === 0) return url;

  const rendered = trimmed.replace(OBJECT_PUBLIC_SEGMENT, RENDER_IMAGE_SEGMENT);
  const separator = rendered.includes('?') ? '&' : '?';
  return `${rendered}${separator}${params.join('&')}`;
}
