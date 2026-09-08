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

  const layoutNode =
    count === 1 ? (
      <SingleImageLayout {...layoutProps} />
    ) : count === 2 ? (
      <TwoImageLayout {...layoutProps} />
    ) : count === 3 ? (
      <ThreeImageLayout {...layoutProps} />
    ) : count === 4 ? (
      <FourImageLayout {...layoutProps} />
    ) : count >= 6 && layout === 'default' ? (
      <DefaultGridLayout {...layoutProps} />
    ) : count >= 6 && layout === 'five-images' ? (
      <FiveImagesLayout {...layoutProps} />
    ) : count >= 6 && layout === 'car-gallery' ? (
      <CarGalleryLayout {...layoutProps} />
    ) : count >= 6 && layout === 'two-left-three-right' ? (
      <TwoLeftThreeRightLayout {...layoutProps} />
    ) : count >= 6 && layout === 'three-images' ? (
      <ThreeImagesGalleryLayout {...layoutProps} />
    ) : count >= 6 && layout === 'one-top-two-bottom' ? (
      <OneTopTwoBottomLayout {...layoutProps} />
    ) : count >= 6 && layout === 'one-top-three-bottom' ? (
      <OneTopThreeBottomLayout {...layoutProps} />
    ) : count >= 6 && layout === 'one-left-three-right' ? (
      <OneLeftThreeRightLayout {...layoutProps} />
    ) : (
      <DefaultFiveLayout {...layoutProps} />
    );

  return (
    <div style={{ overflow: 'hidden', isolation: 'isolate', width: '100%' }}>
      {layoutNode}
    </div>
  );
});

PhotoGrid.displayName = 'PhotoGrid';
