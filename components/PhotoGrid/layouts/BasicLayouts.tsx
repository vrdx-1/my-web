import React from 'react';
import { ImageWithSkeleton } from '../ImageWithSkeleton';
import { baseImgStyle, PhotoGridLayoutProps } from '../shared';
import {
  PHOTO_GRID_SINGLE_IMAGE_HEIGHT,
  PHOTO_GRID_THREE_LEFT_HEIGHT,
  PHOTO_GRID_THREE_RIGHT_HEIGHT,
  PHOTO_GRID_TWO_IMAGE_HEIGHT,
} from '@/utils/layoutConstants';

/** 1 รูป — สูงคงที่ 400px + cover แบบ PhotoGrid ตอนแสดงพอดี */
export function SingleImageLayout({ images, onPostClick, firstImageLoading, firstImgFetchPriority }: PhotoGridLayoutProps) {
  return (
    <div style={{ position: 'relative', width: '100%', height: PHOTO_GRID_SINGLE_IMAGE_HEIGHT, cursor: 'pointer' }}>
      <ImageWithSkeleton
        src={images[0]}
        imageIndex={0}
        onPostClick={onPostClick}
        loading={firstImageLoading}
        fetchPriority={firstImgFetchPriority}
        containerStyle={{ width: '100%', height: '100%' }}
        imgStyle={baseImgStyle}
      />
    </div>
  );
}

/** 2 รูป — 2 คอลัมน์ ความสูงคงที่เหมือน PhotoPreviewGrid */
export function TwoImageLayout({ images, onPostClick, firstImageLoading, firstImgFetchPriority, gridGap }: PhotoGridLayoutProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...gridGap, cursor: 'pointer' }}>
      <ImageWithSkeleton
        src={images[0]}
        imageIndex={0}
        onPostClick={onPostClick}
        loading={firstImageLoading}
        fetchPriority={firstImgFetchPriority}
        containerStyle={{ width: '100%', height: PHOTO_GRID_TWO_IMAGE_HEIGHT, background: '#f0f0f0' }}
        imgStyle={baseImgStyle}
      />
      <ImageWithSkeleton
        src={images[1]}
        imageIndex={1}
        onPostClick={onPostClick}
        loading="lazy"
        containerStyle={{ width: '100%', height: PHOTO_GRID_TWO_IMAGE_HEIGHT, background: '#f0f0f0' }}
        imgStyle={baseImgStyle}
      />
    </div>
  );
}

/** 3 รูป — ซ้ายใหญ่ ขวา 2 รูปเล็ก ความสูงช่องเดียวกับ PhotoPreviewGrid */
export function ThreeImageLayout({ images, onPostClick, firstImageLoading, firstImgFetchPriority, gridGap }: PhotoGridLayoutProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...gridGap, cursor: 'pointer' }}>
      <div style={{ gridRow: 'span 2' }}>
        <ImageWithSkeleton
          src={images[0]}
          imageIndex={0}
          onPostClick={onPostClick}
          loading={firstImageLoading}
          fetchPriority={firstImgFetchPriority}
          containerStyle={{ width: '100%', height: PHOTO_GRID_THREE_LEFT_HEIGHT, background: '#f0f0f0' }}
          imgStyle={{ ...baseImgStyle, background: '#f0f0f0' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', ...gridGap }}>
        <ImageWithSkeleton
          src={images[1]}
          imageIndex={1}
          onPostClick={onPostClick}
          loading="lazy"
          containerStyle={{ width: '100%', height: PHOTO_GRID_THREE_RIGHT_HEIGHT, background: '#f0f0f0' }}
          imgStyle={baseImgStyle}
        />
        <ImageWithSkeleton
          src={images[2]}
          imageIndex={2}
          onPostClick={onPostClick}
          loading="lazy"
          containerStyle={{ width: '100%', height: PHOTO_GRID_THREE_RIGHT_HEIGHT, background: '#f0f0f0' }}
          imgStyle={baseImgStyle}
        />
      </div>
    </div>
  );
}

/** 4 รูป — grid 2x2 */
export function FourImageLayout({ images, onPostClick, firstImageLoading, firstImgFetchPriority, gridGap }: PhotoGridLayoutProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...gridGap, cursor: 'pointer', width: '100%', minWidth: 0 }}>
      {images.map((img, i) => (
        <ImageWithSkeleton
          key={i}
          src={img}
          imageIndex={i}
          onPostClick={onPostClick}
          loading={i === 0 ? firstImageLoading : 'lazy'}
          fetchPriority={i === 0 ? firstImgFetchPriority : undefined}
          containerStyle={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', minWidth: 0, minHeight: 0 }}
          imgStyle={baseImgStyle}
        />
      ))}
    </div>
  );
}

/** Fallback (5 รูป / layout ไม่ตรง) — 2 บน, 3 ล่าง */
export function DefaultFiveLayout({ images, onPostClick, firstImageLoading, firstImgFetchPriority, gridGap }: PhotoGridLayoutProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...gridGap, cursor: 'pointer', width: '100%', minWidth: 0 }}>
      {images.slice(0, 2).map((img, i) => (
        <ImageWithSkeleton
          key={i}
          src={img}
          imageIndex={i}
          onPostClick={onPostClick}
          loading={i === 0 ? firstImageLoading : 'lazy'}
          fetchPriority={i === 0 ? firstImgFetchPriority : undefined}
          containerStyle={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', minWidth: 0, minHeight: 0 }}
          imgStyle={baseImgStyle}
        />
      ))}
      <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', ...gridGap }}>
        {images.slice(2, 5).map((img, i) => {
          const idx = i + 2;
          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                aspectRatio: '1',
                cursor: 'pointer',
                overflow: 'hidden',
                minWidth: 0,
                minHeight: 0,
              }}
              onClick={() => onPostClick(idx)}
            >
              <ImageWithSkeleton
                src={img}
                imageIndex={idx}
                onPostClick={onPostClick}
                loading="lazy"
                containerStyle={{ position: 'absolute', inset: 0 }}
                imgStyle={{ ...baseImgStyle, pointerEvents: 'none' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
