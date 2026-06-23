import React, { memo, useState, useEffect } from 'react';
import { isPhotoGridImageUrlLoaded, markPhotoGridImageUrlLoaded } from '@/utils/photoGridImageCache';

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

export const ImageWithSkeleton = memo(function ImageWithSkeleton({
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
