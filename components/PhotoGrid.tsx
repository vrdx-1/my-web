import React, { memo, useMemo, useState, useEffect } from 'react';
import { PHOTO_GRID_GAP } from '@/utils/layoutConstants';
import { isPhotoGridImageUrlLoaded, markPhotoGridImageUrlLoaded } from '@/utils/photoGridImageCache';
import { normalizeImageUrl } from '@/utils/avatarUtils';

function computeImageLoadedState(src: string): boolean {
  if (typeof src === 'string' && src.startsWith('data:')) return true;
  return isPhotoGridImageUrlLoaded(src);
}

const imagePlaceholderShimmerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(90deg, #e8e8e8 25%, #f0f0f0 50%, #e8e8e8 75%)',
  backgroundSize: '200% 100%',
  animation: 'photo-grid-shimmer 1.5s ease-in-out infinite',
  borderRadius: 0,
};

const ImageWithSkeleton = memo(function ImageWithSkeleton({
  src,
  imageIndex,
  onPostClick,
  loading,
  decoding = 'async',
  fetchPriority,
  containerStyle,
  imgStyle,
}: {
  src: string;
  imageIndex: number;
  onPostClick: (i: number) => void;
  loading: 'eager' | 'lazy';
  decoding?: 'async' | 'sync' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
  containerStyle: React.CSSProperties;
  imgStyle: React.CSSProperties;
}) {
  const [loaded, setLoaded] = useState(() => computeImageLoadedState(src));

  useEffect(() => {
    setLoaded(computeImageLoadedState(src));
  }, [src]);

  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...containerStyle }}>
      {/* Facebook-style placeholder: grey shimmer until image loads */}
      {!loaded && (
        <div
          className="photo-grid-placeholder"
          style={imagePlaceholderShimmerStyle}
          aria-hidden="true"
        />
      )}
      <img
        src={src}
        onClick={() => onPostClick(imageIndex)}
        onLoad={() => {
          markPhotoGridImageUrlLoaded(src);
          setLoaded((prev) => (prev ? prev : true));
        }}
        onError={() => {
          markPhotoGridImageUrlLoaded(src);
          setLoaded((prev) => (prev ? prev : true));
        }}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        alt={imageIndex === 0 ? 'Post image' : `Post image ${imageIndex + 1}`}
        style={{
          ...imgStyle,
          position: 'relative',
          zIndex: 1,
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.25s ease-out',
        }}
      />
    </div>
  );
});

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
  const normalizedImages: string[] = useMemo(() => {
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
  }, [images]);

  // โพสที่พึ่งโพส: ใช้ preload (data URL) แทน URL จากเน็ต เพื่อแสดงรูปทันที
  const effectiveImages: string[] = useMemo(
    () =>
      normalizedImages.map((url, i) => {
        const rawUrl =
          preloadImages && typeof preloadImages[i] === 'string' && preloadImages[i].trim().length > 0
            ? preloadImages[i].trim()
            : url;
        return normalizeImageUrl(rawUrl, 'car-images');
      }),
    [normalizedImages, preloadImages],
  );

  const count = normalizedImages.length;

  if (count === 0) return null;

  const firstImageLoading = priority ? 'eager' : 'lazy';

  const baseImgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
  };

  // Single image
  if (count === 1) {
    return (
      <>
        <div style={{ position: 'relative', width: '100%', height: '400px', cursor: 'pointer' }}>
          <ImageWithSkeleton
            src={effectiveImages[0]}
            imageIndex={0}
            onPostClick={onPostClick}
            loading={firstImageLoading}
            fetchPriority={firstImgFetchPriority}
            containerStyle={{ width: '100%', height: '100%' }}
            imgStyle={baseImgStyle}
          />
        </div>
      </>
    );
  }

  // Two images
  if (count === 2) {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...gridGap, cursor: 'pointer' }}>
          <ImageWithSkeleton
            src={effectiveImages[0]}
            imageIndex={0}
            onPostClick={onPostClick}
            loading={firstImageLoading}
            fetchPriority={firstImgFetchPriority}
            containerStyle={{ width: '100%', height: '300px' }}
            imgStyle={baseImgStyle}
          />
          <ImageWithSkeleton
            src={effectiveImages[1]}
            imageIndex={1}
            onPostClick={onPostClick}
            loading="lazy"
            containerStyle={{ width: '100%', height: '300px' }}
            imgStyle={baseImgStyle}
          />
        </div>
      </>
    );
  }

  // Three images
  if (count === 3) {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...gridGap, cursor: 'pointer' }}>
          <div style={{ gridRow: 'span 2' }}>
            <ImageWithSkeleton
              src={effectiveImages[0]}
              imageIndex={0}
              onPostClick={onPostClick}
              loading={firstImageLoading}
              fetchPriority={firstImgFetchPriority}
              containerStyle={{ width: '100%', height: '400px' }}
            imgStyle={{ ...baseImgStyle, background: '#f0f0f0' }}
          />
          </div>
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', ...gridGap }}>
            <ImageWithSkeleton
              src={effectiveImages[1]}
              imageIndex={1}
              onPostClick={onPostClick}
              loading="lazy"
              containerStyle={{ width: '100%', height: '199px' }}
            imgStyle={{ ...baseImgStyle, background: '#f0f0f0' }}
          />
            <ImageWithSkeleton
              src={effectiveImages[2]}
              imageIndex={2}
              onPostClick={onPostClick}
              loading="lazy"
              containerStyle={{ width: '100%', height: '199px' }}
            imgStyle={{ ...baseImgStyle, background: '#f0f0f0' }}
          />
          </div>
        </div>
      </>
    );
  }

  // Four images — 2x2 grid
  if (count === 4) {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', ...gridGap, cursor: 'pointer' }}>
          {effectiveImages.map((img, i) => (
            <ImageWithSkeleton
              key={i}
              src={img}
              imageIndex={i}
              onPostClick={onPostClick}
              loading={i === 0 ? firstImageLoading : 'lazy'}
              fetchPriority={i === 0 ? firstImgFetchPriority : undefined}
              containerStyle={{ position: 'relative', aspectRatio: '1', overflow: 'hidden' }}
                  imgStyle={baseImgStyle}
                />
          ))}
        </div>
      </>
    );
  }

  // Five or more images — ใช้ layout ที่เลือก (เหมือน PhotoPreviewGrid)
  if (count >= 6) {
    // Layout: default (2x2 grid สำหรับ 4 รูป, +N ในรูปที่ 4 ถ้า >4)
    if (layout === 'default') {
      return (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', ...gridGap, cursor: 'pointer' }}>
            {effectiveImages.slice(0, 4).map((img, i) => (
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
                {i === 3 && count > 4 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: '#fff',
                      WebkitTextStroke: '3px #000',
                      paintOrder: 'stroke fill',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  >
                    +{count - 4}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      );
    }

    // Layout: five-images (2 บน, 3 ล่าง)
    if (layout === 'five-images') {
      return (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...gridGap, cursor: 'pointer' }}>
            {effectiveImages.slice(0, 2).map((img, i) => (
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
              {effectiveImages.slice(2, 5).map((img, i) => {
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
                    {idx === 4 && count > 5 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: '#fff',
                          WebkitTextStroke: '3px #000',
                          paintOrder: 'stroke fill',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      >
                        +{count - 5}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      );
    }

    // Layout: car-gallery (ซ้าย 2 รูปใหญ่สี่เหลี่ยมจัตุรัสเท่ากัน, ขวา 3 รูปเล็กสี่เหลี่ยม — ตามภาพ template)
    if (layout === 'car-gallery') {
      return (
        <>
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
              {effectiveImages.slice(0, 2).map((img, i) => (
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
              {effectiveImages.slice(2, 5).map((img, i) => {
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
                    {idx === 4 && count > 5 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: '#fff',
                          WebkitTextStroke: '3px #000',
                          paintOrder: 'stroke fill',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      >
                        +{count - 5}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      );
    }

    // Layout: two-left-three-right (2 รูปใหญ่ 1:1 ซ้าย, 3 รูปเล็ก 1:1 ขวา — ซ้ายใหญ่กว่าขวา)
    if (layout === 'two-left-three-right') {
      return (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gridTemplateRows: '1fr 1fr 1fr 1fr 1fr 1fr', ...gridGap, cursor: 'pointer', position: 'relative', aspectRatio: '5/6', width: '100%' }}>
            {effectiveImages.slice(0, 2).map((img, i) => (
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
            {effectiveImages.slice(2, 5).map((img, i) => {
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
                  {idx === 4 && count > 5 && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#fff',
                        WebkitTextStroke: '3px #000',
                        paintOrder: 'stroke fill',
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    >
                      +{count - 5}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      );
    }

    // Layout: three-images (ซ้ายใหญ่ 1 รูป, ขวา 2 รูปเล็ก - เหมือนตอน post 3 รูป)
    if (layout === 'three-images') {
      return (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: gap, rowGap: 0, cursor: 'pointer', position: 'relative' }}>
            <div style={{ gridRow: 'span 2' }}>
              <ImageWithSkeleton
                src={effectiveImages[0]}
                imageIndex={0}
                onPostClick={onPostClick}
                loading={firstImageLoading}
                fetchPriority={firstImgFetchPriority}
                containerStyle={{ width: '100%', height: '400px' }}
            imgStyle={{ ...baseImgStyle, background: '#f0f0f0' }}
          />
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', ...gridGap }}>
              {effectiveImages.slice(1, 3).map((img, i) => {
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
                    {idx === 2 && count > 3 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: '#fff',
                          WebkitTextStroke: '3px #000',
                          paintOrder: 'stroke fill',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      >
                        +{count - 3}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      );
    }

    // Layout: one-top-two-bottom (1 รูปใหญ่อยู่ด้านบน 2 รูปเล็กอยู่ด้านล่าง) — โครงสร้างรวมเป็นสี่เหลี่ยมจตุรัส
    if (layout === 'one-top-two-bottom') {
      return (
        <>
          <div style={{ display: 'grid', gridTemplateRows: '2fr 1fr', ...gridGap, cursor: 'pointer', aspectRatio: '1', width: '100%' }}>
            <div style={{ position: 'relative', width: '100%', minHeight: 0 }} onClick={() => onPostClick(0)}>
                  <ImageWithSkeleton
                src={effectiveImages[0]}
                imageIndex={0}
                onPostClick={onPostClick}
                loading={firstImageLoading}
                fetchPriority={firstImgFetchPriority}
                containerStyle={{ position: 'absolute', inset: 0 }}
                imgStyle={{ ...baseImgStyle, pointerEvents: 'none' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...gridGap }}>
              {effectiveImages.slice(1, 3).map((img, i) => {
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
                    {idx === 2 && count > 3 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: '#fff',
                          WebkitTextStroke: '3px #000',
                          paintOrder: 'stroke fill',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      >
                        +{count - 3}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      );
    }

    // Layout: one-top-three-bottom (หนึ่งรูปใหญ่อยู่ด้านบน สามรูปเล็ก 1:1 อยู่ด้านล่าง) — โครงสร้างรวมเป็นสี่เหลี่ยมจตุรัส
    if (layout === 'one-top-three-bottom') {
      return (
        <>
          <div style={{ display: 'grid', gridTemplateRows: '2fr 1fr', ...gridGap, cursor: 'pointer', aspectRatio: '1', width: '100%' }}>
            <div style={{ position: 'relative', width: '100%', minHeight: 0 }} onClick={() => onPostClick(0)}>
              <ImageWithSkeleton
                src={effectiveImages[0]}
                imageIndex={0}
                onPostClick={onPostClick}
                loading={firstImageLoading}
                fetchPriority={firstImgFetchPriority}
                containerStyle={{ position: 'absolute', inset: 0 }}
                imgStyle={{ ...baseImgStyle, pointerEvents: 'none' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', ...gridGap }}>
              {effectiveImages.slice(1, 4).map((img, i) => {
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
                    {idx === 3 && count > 4 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: '#fff',
                          WebkitTextStroke: '3px #000',
                          paintOrder: 'stroke fill',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      >
                        +{count - 4}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      );
    }

    // Layout: one-left-three-right (หนึ่งรูปใหญ่อยู่ด้านซ้าย สามรูปเล็ก 1:1 อยู่ด้านขวา) — โครงสร้างรวมเป็นสี่เหลี่ยมจตุรัส, ช่องขวา 1:1, ใช้ grid หลักเดียวเพื่อให้ row gap เท่ากับ layout อื่น
    if (layout === 'one-left-three-right') {
      return (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr 1fr', ...gridGap, cursor: 'pointer', position: 'relative', aspectRatio: '1', width: '100%' }}>
            <div style={{ gridRow: 'span 3', minHeight: 0 }}>
              <ImageWithSkeleton
                src={effectiveImages[0]}
                imageIndex={0}
                onPostClick={onPostClick}
                loading={firstImageLoading}
                fetchPriority={firstImgFetchPriority}
                containerStyle={{ width: '100%', height: '100%' }}
            imgStyle={{ ...baseImgStyle, background: '#f0f0f0' }}
          />
            </div>
            {effectiveImages.slice(1, 4).map((img, i) => {
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
                  {idx === 3 && count > 4 && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#fff',
                        WebkitTextStroke: '3px #000',
                        paintOrder: 'stroke fill',
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    >
                      +{count - 4}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      );
    }
  }

  // Five images — fallback to default layout (2 บน, 3 ล่าง)
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...gridGap, cursor: 'pointer' }}>
        {effectiveImages.slice(0, 2).map((img, i) => (
          <ImageWithSkeleton
            key={i}
            src={img}
            imageIndex={i}
            onPostClick={onPostClick}
            loading={i === 0 ? firstImageLoading : 'lazy'}
            fetchPriority={i === 0 ? firstImgFetchPriority : undefined}
            containerStyle={{ position: 'relative', aspectRatio: '1', overflow: 'hidden' }}
            imgStyle={baseImgStyle}
          />
        ))}
        <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', ...gridGap }}>
          {effectiveImages.slice(2, 5).map((img, i) => {
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
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
});

PhotoGrid.displayName = 'PhotoGrid';
