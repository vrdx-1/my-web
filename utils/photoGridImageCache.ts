/** URL ที่โหลดครบในกริด (PhotoGrid) — ใช้ร่วมกับ imagePreload + การ์ดที่ remount ใน virtual feed */
const LOADED_URLS = new Set<string>();
const MAX_URLS = 4000;

export function markPhotoGridImageUrlLoaded(url: string): void {
  if (!url || url.startsWith('data:')) return;
  if (LOADED_URLS.has(url)) return;
  if (LOADED_URLS.size >= MAX_URLS) {
    const first = LOADED_URLS.values().next().value as string | undefined;
    if (first !== undefined) LOADED_URLS.delete(first);
  }
  LOADED_URLS.add(url);
}

export function isPhotoGridImageUrlLoaded(url: string): boolean {
  if (typeof url !== 'string') return false;
  if (url.startsWith('data:')) return true;
  return LOADED_URLS.has(url);
}
