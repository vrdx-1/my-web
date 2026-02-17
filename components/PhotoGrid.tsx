import React, { useState } from 'react';

const photoGridShimmerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
  backgroundSize: '200% 100%',
  animation: 'photo-grid-skeleton-shimmer 1.2s ease-in-out infinite',
};

function ImageWithSkeleton({
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
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...containerStyle }}>
      {!loaded && <div style={photoGridShimmerStyle} aria-hidden />}
      <img
        src={src}
        onClick={() => onPostClick(imageIndex)}
        onLoad={() => setLoaded(true)}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        alt={imageIndex === 0 ? 'Post image' : `Post image ${imageIndex + 1}`}
        style={{
          ...imgStyle,
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.2s ease-out',
        }}
      />
    </div>
  );
}

interface PhotoGridProps {
  images: string[];
  onPostClick: (imageIndex: number) => void;
  /** เมื่อ true รูปแรกใช้ loading="eager" สำหรับ LCP (โพสแรกในฟีด) */
  priority?: boolean;
}

/**
 * Optimized PhotoGrid with lazy loading. First card in feed uses priority for LCP.
 * แสดง Skeleton (shimmer) ในพื้นที่รูปจนกว่ารูปโหลดเสร็จ
 */
export const PhotoGrid = React.memo<PhotoGridProps>(({ images, onPostClick, priority = false }) => {
  // Defensive: some rows may return images as a JSON string (e.g. '["url1","url2"]').
  // Normalize to string[] to avoid rendering broken src like '[' / '"'.
  const normalizedImages: string[] = (() => {
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
  })();

  const count = normalizedImages.length;

  if (count === 0) return null;

  const firstImageLoading = priority ? 'eager' : 'lazy';
  const shimmerStyleTag = (
    <style>{`
      @keyframes photo-grid-skeleton-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  );

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
        {shimmerStyleTag}
        <div style={{ position: 'relative', width: '100%', height: '400px', cursor: 'pointer' }}>
          <ImageWithSkeleton
            src={normalizedImages[0]}
            imageIndex={0}
            onPostClick={onPostClick}
            loading={firstImageLoading}
            fetchPriority={priority ? 'high' : undefined}
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
        {shimmerStyleTag}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', cursor: 'pointer' }}>
          <ImageWithSkeleton
            src={normalizedImages[0]}
            imageIndex={0}
            onPostClick={onPostClick}
            loading={firstImageLoading}
            fetchPriority={priority ? 'high' : undefined}
            containerStyle={{ width: '100%', height: '300px' }}
            imgStyle={baseImgStyle}
          />
          <ImageWithSkeleton
            src={normalizedImages[1]}
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
        {shimmerStyleTag}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', cursor: 'pointer' }}>
          <div style={{ gridRow: 'span 2' }}>
            <ImageWithSkeleton
              src={normalizedImages[0]}
              imageIndex={0}
              onPostClick={onPostClick}
              loading={firstImageLoading}
              fetchPriority={priority ? 'high' : undefined}
              containerStyle={{ width: '100%', height: '400px' }}
              imgStyle={{ ...baseImgStyle, background: '#f0f0f0' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '4px' }}>
            <ImageWithSkeleton
              src={normalizedImages[1]}
              imageIndex={1}
              onPostClick={onPostClick}
              loading="lazy"
              containerStyle={{ width: '100%', height: '199px' }}
              imgStyle={{ ...baseImgStyle, background: '#f0f0f0' }}
            />
            <ImageWithSkeleton
              src={normalizedImages[2]}
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
        {shimmerStyleTag}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '4px', cursor: 'pointer' }}>
          {normalizedImages.map((img, i) => (
            <ImageWithSkeleton
              key={i}
              src={img}
              imageIndex={i}
              onPostClick={onPostClick}
              loading={i === 0 ? firstImageLoading : 'lazy'}
              fetchPriority={i === 0 && priority ? 'high' : undefined}
              containerStyle={{ position: 'relative', aspectRatio: '1', overflow: 'hidden' }}
              imgStyle={baseImgStyle}
            />
          ))}
        </div>
      </>
    );
  }

  // Five or more images
  return (
    <>
      {shimmerStyleTag}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', cursor: 'pointer' }}>
        {normalizedImages.slice(0, 2).map((img, i) => (
          <ImageWithSkeleton
            key={i}
            src={img}
            imageIndex={i}
            onPostClick={onPostClick}
            loading={i === 0 ? firstImageLoading : 'lazy'}
            fetchPriority={i === 0 && priority ? 'high' : undefined}
            containerStyle={{ position: 'relative', aspectRatio: '1', overflow: 'hidden' }}
            imgStyle={baseImgStyle}
          />
        ))}
        <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
          {normalizedImages.slice(2, 5).map((img, i) => {
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
});

PhotoGrid.displayName = 'PhotoGrid';
