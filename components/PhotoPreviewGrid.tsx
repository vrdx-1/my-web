'use client'

import React from 'react';
import Image from 'next/image';

interface PhotoPreviewGridProps {
  existingImages?: string[]; // รูปเดิมจาก DB
  newPreviews?: string[]; // Preview รูปใหม่
  onImageClick?: () => void;
  onRemoveImage?: (index: number, isNew: boolean) => void;
  showRemoveButton?: boolean;
  className?: string;
}

/**
 * PhotoPreviewGrid Component
 * Displays a grid of existing images and new preview images
 * Used in create-post and edit-post pages
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

  const handleRemove = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemoveImage) {
      const isNew = index >= existingImages.length;
      const adjustedIndex = isNew ? index - existingImages.length : index;
      onRemoveImage(adjustedIndex, isNew);
    }
  };

  if (count === 1) {
    return (
      <div 
        onClick={onImageClick} 
        style={{ position: 'relative', width: '100%', cursor: onImageClick ? 'pointer' : 'default' }}
        className={className}
      >
        <Image
          src={allImages[0]}
          alt="Preview"
          width={600}
          height={400}
          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }}
          unoptimized
        />
        {showRemoveButton && onRemoveImage && (
          <button
            onClick={(e) => handleRemove(0, e)}
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
              fontWeight: 'bold'
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      onClick={onImageClick} 
      style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '2px', 
        cursor: onImageClick ? 'pointer' : 'default',
        background: '#f0f0f0'
      }}
      className={className}
    >
      {allImages.slice(0, 4).map((img, i) => {
        const isNew = i >= existingImages.length;
        const adjustedIndex = isNew ? i - existingImages.length : i;
        
        return (
          <div key={i} style={{ position: 'relative', height: count === 2 ? '300px' : '200px' }}>
            <Image
              src={img}
              alt={`Preview ${i + 1}`}
              fill
              style={{ objectFit: 'cover' }}
              unoptimized
            />
            {i === 3 && count > 4 && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '24px',
                fontWeight: 'bold'
              }}>
                +{count - 4}
              </div>
            )}
            {showRemoveButton && onRemoveImage && (
              <button
                onClick={(e) => handleRemove(i, e)}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
});

PhotoPreviewGrid.displayName = 'PhotoPreviewGrid';
