import React from 'react';
import { ImageWithSkeleton } from '../ImageWithSkeleton';
import { PhotoOverlayBadge } from '../PhotoOverlayBadge';
import { baseImgStyle, PhotoGridLayoutProps } from '../shared';

/** layout 'three-images' (6+) — ซ้ายใหญ่ 1 รูป, ขวา 2 รูปเล็ก (เหมือน post 3 รูป) */
export function ThreeImagesGalleryLayout({ images, count, onPostClick, firstImageLoading, firstImgFetchPriority, gridGap, gap }: PhotoGridLayoutProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: gap, rowGap: 0, cursor: 'pointer', position: 'relative' }}>
      <div style={{ gridRow: 'span 2' }}>
        <ImageWithSkeleton
          src={images[0]}
          imageIndex={0}
          onPostClick={onPostClick}
          loading={firstImageLoading}
          fetchPriority={firstImgFetchPriority}
          containerStyle={{ width: '100%', height: '400px' }}
          imgStyle={{ ...baseImgStyle, background: '#f0f0f0' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', ...gridGap }}>
        {images.slice(1, 3).map((img, i) => {
          const idx = i + 1;
          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                cursor: 'pointer',
              }}
              onClick={() => onPostClick(idx)}
            >
              <ImageWithSkeleton
                src={img}
                imageIndex={idx}
                onPostClick={onPostClick}
                loading="lazy"
                containerStyle={{ width: '100%', height: '198.5px' }}
                imgStyle={{ ...baseImgStyle, background: '#f0f0f0' }}
              />
              {idx === 2 && count > 3 && <PhotoOverlayBadge remaining={count - 3} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** layout 'one-top-two-bottom' (6+) — 1 รูปใหญ่บน, 2 รูปเล็กล่าง */
export function OneTopTwoBottomLayout({ images, count, onPostClick, firstImageLoading, firstImgFetchPriority, gridGap }: PhotoGridLayoutProps) {
  return (
    <div style={{ display: 'grid', gridTemplateRows: '2fr 1fr', ...gridGap, cursor: 'pointer', aspectRatio: '1', width: '100%' }}>
      <div style={{ position: 'relative', width: '100%', minHeight: 0 }} onClick={() => onPostClick(0)}>
        <ImageWithSkeleton
          src={images[0]}
          imageIndex={0}
          onPostClick={onPostClick}
          loading={firstImageLoading}
          fetchPriority={firstImgFetchPriority}
          containerStyle={{ position: 'absolute', inset: 0 }}
          imgStyle={{ ...baseImgStyle, pointerEvents: 'none' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...gridGap }}>
        {images.slice(1, 3).map((img, i) => {
          const idx = i + 1;
          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                aspectRatio: '1',
                cursor: 'pointer',
                overflow: 'hidden',
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
              {idx === 2 && count > 3 && <PhotoOverlayBadge remaining={count - 3} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** layout 'one-top-three-bottom' (6+) — 1 รูปใหญ่บน, 3 รูปเล็กล่าง */
export function OneTopThreeBottomLayout({ images, count, onPostClick, firstImageLoading, firstImgFetchPriority, gridGap }: PhotoGridLayoutProps) {
  return (
    <div style={{ display: 'grid', gridTemplateRows: '2fr 1fr', ...gridGap, cursor: 'pointer', aspectRatio: '1', width: '100%' }}>
      <div style={{ position: 'relative', width: '100%', minHeight: 0 }} onClick={() => onPostClick(0)}>
        <ImageWithSkeleton
          src={images[0]}
          imageIndex={0}
          onPostClick={onPostClick}
          loading={firstImageLoading}
          fetchPriority={firstImgFetchPriority}
          containerStyle={{ position: 'absolute', inset: 0 }}
          imgStyle={{ ...baseImgStyle, pointerEvents: 'none' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', ...gridGap }}>
        {images.slice(1, 4).map((img, i) => {
          const idx = i + 1;
          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                aspectRatio: '1',
                cursor: 'pointer',
                overflow: 'hidden',
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
              {idx === 3 && count > 4 && <PhotoOverlayBadge remaining={count - 4} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** layout 'one-left-three-right' (6+) — 1 รูปใหญ่ซ้าย, 3 รูปเล็กขวา */
export function OneLeftThreeRightLayout({ images, count, onPostClick, firstImageLoading, firstImgFetchPriority, gridGap }: PhotoGridLayoutProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr 1fr', ...gridGap, cursor: 'pointer', position: 'relative', aspectRatio: '1', width: '100%' }}>
      <div style={{ gridRow: 'span 3', minHeight: 0 }}>
        <ImageWithSkeleton
          src={images[0]}
          imageIndex={0}
          onPostClick={onPostClick}
          loading={firstImageLoading}
          fetchPriority={firstImgFetchPriority}
          containerStyle={{ width: '100%', height: '100%' }}
          imgStyle={{ ...baseImgStyle, background: '#f0f0f0' }}
        />
      </div>
      {images.slice(1, 4).map((img, i) => {
        const idx = i + 1;
        return (
          <div
            key={idx}
            style={{
              position: 'relative',
              minHeight: 0,
              cursor: 'pointer',
              overflow: 'hidden',
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
            {idx === 3 && count > 4 && <PhotoOverlayBadge remaining={count - 4} />}
          </div>
        );
      })}
    </div>
  );
}
