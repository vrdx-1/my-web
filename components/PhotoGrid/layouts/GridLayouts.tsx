import React from 'react';
import { ImageWithSkeleton } from '../ImageWithSkeleton';
import { PhotoOverlayBadge } from '../PhotoOverlayBadge';
import { baseImgStyle, PhotoGridLayoutProps } from '../shared';

/** layout 'default' (6+) — grid 2x2, +N บนรูปที่ 4 */
export function DefaultGridLayout({ images, count, onPostClick, firstImageLoading, firstImgFetchPriority, gridGap }: PhotoGridLayoutProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', ...gridGap, cursor: 'pointer' }}>
      {images.slice(0, 4).map((img, i) => (
        <div
          key={i}
          style={{
            position: 'relative',
            aspectRatio: '1',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
          onClick={() => onPostClick(i)}
        >
          <ImageWithSkeleton
            src={img}
            imageIndex={i}
            onPostClick={onPostClick}
            loading={i === 0 ? firstImageLoading : 'lazy'}
            fetchPriority={i === 0 ? firstImgFetchPriority : undefined}
            containerStyle={{ position: 'absolute', inset: 0 }}
            imgStyle={{ ...baseImgStyle, pointerEvents: 'none' }}
          />
          {i === 3 && count > 4 && <PhotoOverlayBadge remaining={count - 4} />}
        </div>
      ))}
    </div>
  );
}

/** layout 'five-images' (6+) — 2 บน, 3 ล่าง */
export function FiveImagesLayout({ images, count, onPostClick, firstImageLoading, firstImgFetchPriority, gridGap }: PhotoGridLayoutProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...gridGap, cursor: 'pointer' }}>
      {images.slice(0, 2).map((img, i) => (
        <div
          key={i}
          style={{
            position: 'relative',
            aspectRatio: '1',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
          onClick={() => onPostClick(i)}
        >
          <ImageWithSkeleton
            src={img}
            imageIndex={i}
            onPostClick={onPostClick}
            loading={i === 0 ? firstImageLoading : 'lazy'}
            fetchPriority={i === 0 ? firstImgFetchPriority : undefined}
            containerStyle={{ position: 'absolute', inset: 0 }}
            imgStyle={{ ...baseImgStyle, pointerEvents: 'none' }}
          />
        </div>
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
              {idx === 4 && count > 5 && <PhotoOverlayBadge remaining={count - 5} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** layout 'car-gallery' (6+) — ซ้าย 2 รูปใหญ่, ขวา 3 รูปเล็ก */
export function CarGalleryLayout({ images, count, onPostClick, firstImageLoading, firstImgFetchPriority, gridGap }: PhotoGridLayoutProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        ...gridGap,
        cursor: 'pointer',
        aspectRatio: '1',
        width: '100%',
      }}
    >
      <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', ...gridGap, minHeight: 0 }}>
        {images.slice(0, 2).map((img, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              aspectRatio: '1',
              cursor: 'pointer',
              overflow: 'hidden',
              minHeight: 0,
            }}
            onClick={() => onPostClick(i)}
          >
            <ImageWithSkeleton
              src={img}
              imageIndex={i}
              onPostClick={onPostClick}
              loading={i === 0 ? firstImageLoading : 'lazy'}
              fetchPriority={i === 0 ? firstImgFetchPriority : undefined}
              containerStyle={{ position: 'absolute', inset: 0 }}
              imgStyle={{ ...baseImgStyle, pointerEvents: 'none' }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr 1fr', ...gridGap, minHeight: 0 }}>
        {images.slice(2, 5).map((img, i) => {
          const idx = i + 2;
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
              {idx === 4 && count > 5 && <PhotoOverlayBadge remaining={count - 5} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** layout 'two-left-three-right' (6+) — 2 รูปใหญ่ซ้าย, 3 รูปเล็กขวา */
export function TwoLeftThreeRightLayout({ images, count, onPostClick, firstImageLoading, firstImgFetchPriority, gridGap }: PhotoGridLayoutProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gridTemplateRows: '1fr 1fr 1fr 1fr 1fr 1fr', ...gridGap, cursor: 'pointer', position: 'relative', aspectRatio: '5/6', width: '100%' }}>
      {images.slice(0, 2).map((img, i) => (
        <div
          key={i}
          style={{
            position: 'relative',
            gridColumn: 1,
            gridRow: `${i * 3 + 1} / ${i * 3 + 4}`,
            minHeight: 0,
            cursor: 'pointer',
            overflow: 'hidden',
          }}
          onClick={() => onPostClick(i)}
        >
          <ImageWithSkeleton
            src={img}
            imageIndex={i}
            onPostClick={onPostClick}
            loading={i === 0 ? firstImageLoading : 'lazy'}
            fetchPriority={i === 0 ? firstImgFetchPriority : undefined}
            containerStyle={{ position: 'absolute', inset: 0 }}
            imgStyle={{ ...baseImgStyle, pointerEvents: 'none' }}
          />
        </div>
      ))}
      {images.slice(2, 5).map((img, i) => {
        const idx = i + 2;
        return (
          <div
            key={idx}
            style={{
              position: 'relative',
              gridColumn: 2,
              gridRow: `${i * 2 + 1} / ${i * 2 + 3}`,
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
            {idx === 4 && count > 5 && <PhotoOverlayBadge remaining={count - 5} />}
          </div>
        );
      })}
    </div>
  );
}
