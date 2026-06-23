import React, { useMemo } from 'react';
import { PHOTO_GRID_GAP } from '@/utils/layoutConstants';
import { parseImages, buildEffectiveImages, PhotoGridLayoutProps } from './shared';
import {
  SingleImageLayout,
  TwoImageLayout,
  ThreeImageLayout,
  FourImageLayout,
  DefaultFiveLayout,
} from './layouts/BasicLayouts';
import {
  DefaultGridLayout,
  FiveImagesLayout,
  CarGalleryLayout,
  TwoLeftThreeRightLayout,
} from './layouts/GridLayouts';
import {
  ThreeImagesGalleryLayout,
  OneTopTwoBottomLayout,
  OneTopThreeBottomLayout,
  OneLeftThreeRightLayout,
} from './layouts/SplitLayouts';

interface PhotoGridProps {
  images: string[];
  onPostClick: (imageIndex: number) => void;
  /** รูปที่โหลดไว้แล้ว (data URL) สำหรับโพสที่พึ่งโพส — ใช้แสดงทันทีโดยไม่เห็น Skeleton */
  preloadImages?: string[] | null;
  /** เมื่อ true รูปแรกใช้ loading="eager" สำหรับ LCP (โพสแรกในฟีด) */
  priority?: boolean;
  /** ลำดับโหลดรูปแรกของการ์ด (เมื่อไม่ใช้ priority): high = โหลดก่อน, low = โหลดหลัง */
  firstImageFetchPriority?: 'high' | 'low' | 'auto';
  /** Layout สำหรับ 6+ รูป: 'default' | 'five-images' | 'five-images-side' | 'car-gallery' | 'three-images' */
  layout?: string;
  /** Gap เส้นแบ่งรูป — ไม่ใส่ใช้ค่าเดียวกับ layout 2×2 (PHOTO_GRID_GAP) */
  gap?: string;
}

/**
 * Optimized PhotoGrid with lazy loading. First card in feed uses priority for LCP.
 */
export const PhotoGrid = React.memo<PhotoGridProps>(({ images, preloadImages, onPostClick, priority = false, firstImageFetchPriority, layout = 'default', gap = PHOTO_GRID_GAP }) => {
  // ใช้ rowGap/columnGap เดียวกันทุก layout — ให้เส้นแบ่งรูปเท่ากับ 2×2 จริง
  const gridGap = { rowGap: gap, columnGap: gap };
  // รูปแรกของการ์ด: โพสบนสุด = high, โพสถัดไป = high, โพสล่าง = low
  const firstImgFetchPriority = priority ? 'high' : (firstImageFetchPriority ?? undefined);
  // Defensive: some rows may return images as a JSON string (e.g. '["url1","url2"]').
  const normalizedImages = useMemo(() => parseImages(images), [images]);
  // โพสที่พึ่งโพส: ใช้ preload (data URL) แทน URL จากเน็ต เพื่อแสดงรูปทันที
  const effectiveImages = useMemo(
    () => buildEffectiveImages(normalizedImages, preloadImages),
    [normalizedImages, preloadImages],
  );

  const count = normalizedImages.length;

  if (count === 0) return null;

  const firstImageLoading: 'eager' | 'lazy' = priority ? 'eager' : 'lazy';

  const layoutProps: PhotoGridLayoutProps = {
    images: effectiveImages,
    count,
    onPostClick,
    firstImageLoading,
    firstImgFetchPriority,
    gridGap,
    gap,
  };

  // Single image
  if (count === 1) return <SingleImageLayout {...layoutProps} />;
  // Two images
  if (count === 2) return <TwoImageLayout {...layoutProps} />;
  // Three images
  if (count === 3) return <ThreeImageLayout {...layoutProps} />;
  // Four images — 2x2 grid
  if (count === 4) return <FourImageLayout {...layoutProps} />;

  // Five or more images — ใช้ layout ที่เลือก (เหมือน PhotoPreviewGrid)
  if (count >= 6) {
    if (layout === 'default') return <DefaultGridLayout {...layoutProps} />;
    if (layout === 'five-images') return <FiveImagesLayout {...layoutProps} />;
    if (layout === 'car-gallery') return <CarGalleryLayout {...layoutProps} />;
    if (layout === 'two-left-three-right') return <TwoLeftThreeRightLayout {...layoutProps} />;
    if (layout === 'three-images') return <ThreeImagesGalleryLayout {...layoutProps} />;
    if (layout === 'one-top-two-bottom') return <OneTopTwoBottomLayout {...layoutProps} />;
    if (layout === 'one-top-three-bottom') return <OneTopThreeBottomLayout {...layoutProps} />;
    if (layout === 'one-left-three-right') return <OneLeftThreeRightLayout {...layoutProps} />;
  }

  // Five images — fallback to default layout (2 บน, 3 ล่าง)
  return <DefaultFiveLayout {...layoutProps} />;
});

PhotoGrid.displayName = 'PhotoGrid';
