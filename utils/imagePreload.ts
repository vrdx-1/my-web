'use client';

import { getVisibleImageUrlsForPost } from '@/utils/photoGridVisibleImages';

function preloadOneUrl(url: string): Promise<void> {
  if (url.startsWith('data:')) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const img = new Image();
    const done = () => {
      resolve();
    };
    img.onload = done;
    img.onerror = done;
    img.src = url;
    setTimeout(done, 8000);
  });
}

/** โหลดเฉพาะรูปที่เห็นใน layout ของโพส (ไม่โหลดรูปหลัง +N) */
export function preloadPostVisibleImages(post: any): Promise<void> {
  const urls = getVisibleImageUrlsForPost(post || {});
  if (urls.length === 0) return Promise.resolve();
  return Promise.all(urls.map(preloadOneUrl)).then(() => {});
}

/** โหลดล่วงหน้าเฉพาะรูปที่เห็นของโพสหลายโพส (ใช้หลังดึงข้อมูลจากเซิร์ฟเวอร์) */
export function preloadPostsVisibleImages(posts: any[], postCount: number): Promise<void> {
  const slice = (posts || []).slice(0, postCount);
  if (slice.length === 0) return Promise.resolve();
  return Promise.all(slice.map((p) => preloadPostVisibleImages(p))).then(() => {});
}

/**
 * โหลดรูปของโพสต์ N โพสแรกให้ครบ (ใช้ก่อนแสดงโพสตามลำดับในหน้าโฮม)
 * คืนค่า Promise ที่ resolve เมื่อโหลดครบหรือ error/timeout
 * @deprecated ใช้ preloadPostsVisibleImages แทน — โหลดเฉพาะรูปที่เห็นใน layout
 */
export function preloadPostImages(posts: any[], postCount: number): Promise<void> {
  return preloadPostsVisibleImages(posts, postCount);
}
