/**
 * จำนวนรูปที่แสดงในกริดตาม layout (ตรงกับ PhotoGrid) — ไม่นับรูปที่ซ่อนหลัง +N
 */

function normalizeLayout(layout: string | undefined): string {
  return layout && layout.trim() !== '' ? layout : 'default';
}

/** ดัชนีรูปที่ต้องโหลดในการ์ดฟีด (เฉพาะช่องที่เห็นใน layout) */
export function getVisibleImageIndices(layout: string | undefined, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  if (count === 2) return [0, 1];
  if (count === 3) return [0, 1, 2];
  if (count === 4) return [0, 1, 2, 3];
  if (count === 5) return [0, 1, 2, 3, 4];

  const L = normalizeLayout(layout);
  switch (L) {
    case 'default':
      return [0, 1, 2, 3];
    case 'five-images':
    case 'car-gallery':
    case 'two-left-three-right':
      return [0, 1, 2, 3, 4];
    case 'three-images':
      return [0, 1, 2];
    case 'one-top-two-bottom':
      return [0, 1, 2];
    case 'one-top-three-bottom':
    case 'one-left-three-right':
      return [0, 1, 2, 3];
    default:
      return [0, 1, 2, 3];
  }
}

function normalizeImagesArray(images: unknown): string[] {
  if (Array.isArray(images)) {
    return images.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  }
  if (typeof images === 'string') {
    const s = images.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
        }
      } catch {
        /* ignore */
      }
    }
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) {
      return [s];
    }
  }
  return [];
}

/**
 * URL รูปที่ต้องโหลดก่อนแสดงการ์ด — ใช้ _preloadImages แทนช่องเดียวกันเมื่อมี (โพสที่พึ่งโพส)
 */
export function getVisibleImageUrlsForPost(post: {
  images?: unknown;
  layout?: string;
  _preloadImages?: string[] | null;
}): string[] {
  const normalized = normalizeImagesArray(post?.images);
  const preloadArr = post?._preloadImages;
  const indices = getVisibleImageIndices(post?.layout, normalized.length);
  const urls: string[] = [];
  for (const i of indices) {
    const fromPreload =
      preloadArr && typeof preloadArr[i] === 'string' && preloadArr[i].trim().length > 0
        ? preloadArr[i].trim()
        : null;
    const raw = fromPreload ?? normalized[i];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      urls.push(raw.trim());
    }
  }
  return urls;
}
