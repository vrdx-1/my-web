'use client';

import { useEffect, useState } from 'react';
import { cropWhiteImageBorders, peekWhiteCroppedUrl } from '@/utils/cropWhiteImageBorders';

/** คืน URL รูปที่ตัดขอบขาวแล้ว (ถ้าตัดไม่ได้ใช้ต้นฉบับ) */
export function useWhiteCroppedSrc(src: string): string {
  const [url, setUrl] = useState(() => peekWhiteCroppedUrl(src) ?? src);

  useEffect(() => {
    let live = true;
    setUrl(peekWhiteCroppedUrl(src) ?? src);
    cropWhiteImageBorders(src).then((next) => {
      if (live) setUrl(next);
    });
    return () => {
      live = false;
    };
  }, [src]);

  return url;
}
