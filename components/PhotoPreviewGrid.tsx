'use client'

import React from 'react';
import Image from 'next/image';

interface PhotoPreviewGridProps {
  existingImages?: string[];
  newPreviews?: string[];
  onImageClick?: () => void;
  onRemoveImage?: (index: number, isNew: boolean) => void;
  showRemoveButton?: boolean;
  className?: string;
}

/**
 * PhotoPreviewGrid — layout เหมือน PhotoGrid (PostCard)
 * 1, 2, 3, 4+ รูป จัดเรียงแบบเดียวกับฟีด
 */
export const PhotoPreviewGrid = React.memo<PhotoPreviewGridProps>(({
  existingImages = [],
  newPreviews = [],
  onImageClick,
  onRemoveImage,
  showRemoveButton = true,
  className = '',
}) => {
  const allImages = [...(existingImages || []), ...(newPreviews || [])];
  const count = allImages.length;

  if (count === 0) return null;

  const isNew = (i: number) => i >= (existingImages?.length ?? 0);
  const adj = (i: number) => (isNew(i) ? i - (existingImages?.length ?? 0) : i);

  const handleRemove = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveImage?.(adj(index), isNew(index));
  };

  const removeBtn = (i: number) =>
    showRemoveButton && onRemoveImage ? (
      <button
        type="button"
        onClick={(e) => handleRemove(i, e)}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: '28px',
          height: '28px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          fontWeight: 'bold',
          zIndex: 2,
        }}
      >
        ×
      </button>
    ) : null;

  const cursor = onImageClick ? 'pointer' : 'default';
  const click = onImageClick ? () => onImageClick() : undefined;

  // 1 รูป — เหมือน PhotoGrid
  if (count === 1) {
    return (
      <div
        onClick={click}
        style={{ position: 'relative', width: '100%', height: '400px', cursor }}
        className={className}
      >
        <Image
          src={allImages[0]}
          alt="Preview"
          fill
          style={{ objectFit: 'cover', objectPosition: 'center' }}
          unoptimized
        />
        {removeBtn(0)}
      </div>
    );
  }

  // 2 รูป — เหมือน PhotoGrid
  if (count === 2) {
    return (
      <div
        onClick={click}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          cursor,
        }}
        className={className}
      >
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              width: '100%',
              height: '300px',
              background: '#f0f0f0',
            }}
          >
            <Image
              src={allImages[i]}
              alt={`Preview ${i + 1}`}
              fill
              style={{ objectFit: 'cover', objectPosition: 'center' }}
              unoptimized
            />
            {removeBtn(i)}
          </div>
        ))}
      </div>
    );
  }

  // 3 รูป — เหมือน PhotoGrid (ซ้ายใหญ่ ขวา 2 ลูก)
  if (count === 3) {
    return (
      <div
        onClick={click}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          cursor,
        }}
        className={className}
      >
        <div style={{ position: 'relative', gridRow: 'span 2' }}>
          <img
            src={allImages[0]}
            alt="Preview 1"
            style={{
              width: '100%',
              height: '400px',
              objectFit: 'cover',
              objectPosition: 'center',
              background: '#f0f0f0',
            }}
          />
          {removeBtn(0)}
        </div>
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '4px' }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                width: '100%',
                height: '199px',
                background: '#f0f0f0',
              }}
            >
              <img
                src={allImages[i]}
                alt={`Preview ${i + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center',
                }}
              />
              {removeBtn(i)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4+ รูป — เหมือน PhotoGrid (2 บน, 3 ล่าง, +N ถ้า >5)
  return (
    <div
      onClick={click}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px',
        cursor,
      }}
      className={className}
    >
      {allImages.slice(0, 2).map((img, i) => (
        <div
          key={i}
          style={{
            position: 'relative',
            aspectRatio: '1',
            background: '#f0f0f0',
            overflow: 'hidden',
          }}
        >
          <Image
            src={img}
            alt={`Preview ${i + 1}`}
            fill
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            unoptimized
          />
          {removeBtn(i)}
        </div>
      ))}
      <div
        style={{
          gridColumn: 'span 2',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '4px',
        }}
      >
        {allImages.slice(2, 5).map((img, i) => {
          const idx = i + 2;
          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                aspectRatio: '1',
                background: '#f0f0f0',
                overflow: 'hidden',
              }}
            >
              <Image
                src={img}
                alt={`Preview ${idx + 1}`}
                fill
                style={{ objectFit: 'cover', objectPosition: 'center' }}
                unoptimized
              />
              {idx === 2 && count > 5 && (
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
              {removeBtn(idx)}
            </div>
          );
        })}
      </div>
    </div>
  );
});

PhotoPreviewGrid.displayName = 'PhotoPreviewGrid';
