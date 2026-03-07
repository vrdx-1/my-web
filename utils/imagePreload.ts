'use client';

/**
 * โหลดรูปของโพสต์ N โพสแรกให้ครบ (ใช้ก่อนแสดงโพสตามลำดับในหน้าโฮม)
 * คืนค่า Promise ที่ resolve เมื่อโหลดครบหรือ error/timeout
 */
export function preloadPostImages(posts: any[], postCount: number): Promise<void> {
  const slice = (posts || []).slice(0, postCount);
  const urls: string[] = [];
  for (const post of slice) {
    const imgs = post?.images;
    if (Array.isArray(imgs)) {
      for (const url of imgs) {
        if (url && typeof url === 'string' && url.startsWith('http')) urls.push(url);
      }
    }
  }
  if (urls.length === 0) return Promise.resolve();
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          const done = () => {
            resolve();
          };
          img.onload = done;
          img.onerror = done;
          img.src = url;
          // ไม่ให้ค้างถ้ารูปโหลดช้าเกิน 8 วินาที
          setTimeout(done, 8000);
        })
    )
  ).then(() => {});
}
