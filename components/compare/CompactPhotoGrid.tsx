'use client';

import React from 'react';
import { PhotoGrid } from '@/components/PhotoGrid';

interface CompactPhotoGridProps {
  images: string[] | string | null | undefined;
  size?: number;
  layout?: string;
  onClick?: () => void;
}

function normalizeImages(images: string[] | string | null | undefined): string[] {
  if (Array.isArray(images)) {
    return images.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  }

  if (typeof images === 'string') {
    const trimmed = images.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
        }
      } catch {
        return [];
      }
    }

    return [trimmed];
  }

  return [];
}

export function CompactPhotoGrid({ images, size = 98, layout = 'default', onClick }: CompactPhotoGridProps) {
  const normalizedImages = React.useMemo(() => normalizeImages(images), [images]);
  const scale = size / 400;

  if (normalizedImages.length === 0) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 18,
          background: '#eef2f7',
          border: '1px solid #dbe3ee',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        padding: 0,
        border: 'none',
        background: 'transparent',
        display: 'block',
        width: size,
        height: size,
        borderRadius: 18,
        overflow: 'hidden',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 400,
          height: 400,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <PhotoGrid images={normalizedImages} onPostClick={onClick ?? (() => {})} layout={layout} />
      </div>
    </button>
  );
}
