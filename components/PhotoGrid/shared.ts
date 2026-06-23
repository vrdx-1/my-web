import React from 'react';
import { normalizeImageUrl } from '@/utils/avatarUtils';
import { transformSupabaseImageUrl } from '@/utils/supabaseImageTransform';

/** Style รูปพื้นฐานในกริด — ใช้ร่วมทุก layout */
export const baseImgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
};

/** Props ที่ทุก layout component ใช้ร่วมกัน */
export interface PhotoGridLayoutProps {
  /** รูปที่ผ่าน normalize แล้ว (effectiveImages) */
  images: string[];
  /** จำนวนรูปจริง (normalizedImages.length) */
  count: number;
  onPostClick: (imageIndex: number) => void;
  firstImageLoading: 'eager' | 'lazy';
  firstImgFetchPriority?: 'high' | 'low' | 'auto';
  gridGap: { rowGap: string; columnGap: string };
  gap: string;
}

/**
 * แปลง images prop ให้เป็น string[] อย่างปลอดภัย
 * รองรับ array, JSON string ('["url1","url2"]') และ URL เดี่ยว
 */
export function parseImages(images: string[] | string | null | undefined): string[] {
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
        // fallthrough
      }
    }
    // If it's a single URL string, treat it as one image.
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) {
      return [s];
    }
    return [];
  }
  return [];
}

/**
 * โพสที่พึ่งโพส: ใช้ preload (data URL) แทน URL จากเน็ต เพื่อแสดงรูปทันที
 */
export function buildEffectiveImages(normalizedImages: string[], preloadImages?: string[] | null): string[] {
  return normalizedImages.map((url, i) => {
    const rawUrl =
      preloadImages && typeof preloadImages[i] === 'string' && preloadImages[i].trim().length > 0
        ? preloadImages[i].trim()
        : url;
    return transformSupabaseImageUrl(normalizeImageUrl(rawUrl, 'car-images'));
  });
}
