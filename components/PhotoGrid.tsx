import React from 'react';
import Image from 'next/image';

interface PhotoGridProps {
  images: string[];
  onPostClick: (imageIndex: number) => void;
}

/**
 * Optimized PhotoGrid component with React.memo and next/image
 * Handles different image count layouts (1, 2, 3, 4+)
 */
export const PhotoGrid = React.memo<PhotoGridProps>(({ images, onPostClick }) => {
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
  
  // Single image
  if (count === 1) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '400px', cursor: 'pointer' }}>
        <Image 
          src={normalizedImages[0]} 
          onClick={() => onPostClick(0)} 
          fill
          style={{ 
            objectFit: 'cover', 
            objectPosition: 'center'
          }}
          loading="lazy"
          alt="Post image"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
    );
  }
  
  // Two images
  if (count === 2) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', cursor: 'pointer' }}>
        <div style={{ position: 'relative', width: '100%', height: '300px', background: '#f0f0f0' }}>
          <Image 
            src={normalizedImages[0]} 
            onClick={() => onPostClick(0)} 
            fill
            style={{ 
              objectFit: 'cover', 
              objectPosition: 'center'
            }}
            loading="lazy"
            alt="Post image 1"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        </div>
        <div style={{ position: 'relative', width: '100%', height: '300px', background: '#f0f0f0' }}>
          <Image 
            src={normalizedImages[1]} 
            onClick={() => onPostClick(1)} 
            fill
            style={{ 
              objectFit: 'cover', 
              objectPosition: 'center'
            }}
            loading="lazy"
            alt="Post image 2"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        </div>
      </div>
    );
  }
  
  // Three images
  if (count === 3) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', cursor: 'pointer' }}>
        <img 
          src={normalizedImages[0]} 
          onClick={() => onPostClick(0)} 
          style={{ 
            width: '100%', 
            height: '400px', 
            objectFit: 'cover', 
            objectPosition: 'center', 
            background: '#f0f0f0', 
            gridRow: 'span 2' 
          }}
          loading="lazy"
          alt="Post image 1"
        />
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '4px' }}>
          <img 
            src={normalizedImages[1]} 
            onClick={() => onPostClick(1)} 
            style={{ 
              width: '100%', 
              height: '199px', 
              objectFit: 'cover', 
              objectPosition: 'center', 
              background: '#f0f0f0' 
            }}
            loading="lazy"
            alt="Post image 2"
          />
          <img 
            src={normalizedImages[2]} 
            onClick={() => onPostClick(2)} 
            style={{ 
              width: '100%', 
              height: '199px', 
              objectFit: 'cover', 
              objectPosition: 'center', 
              background: '#f0f0f0' 
            }}
            loading="lazy"
            alt="Post image 3"
          />
        </div>
      </div>
    );
  }
  
  // Four images — 2x2 grid
  if (count === 4) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '4px', cursor: 'pointer' }}>
        {normalizedImages.map((img, i) => (
          <div 
            key={i} 
            style={{ 
              position: 'relative', 
              aspectRatio: '1', 
              background: '#f0f0f0', 
              overflow: 'hidden' 
            }}
          >
            <Image 
              src={img} 
              onClick={() => onPostClick(i)} 
              fill
              style={{ 
                objectFit: 'cover', 
                objectPosition: 'center'
              }}
              loading="lazy"
              alt={`Post image ${i + 1}`}
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          </div>
        ))}
      </div>
    );
  }
  
  // Five or more images
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', cursor: 'pointer' }}>
      {normalizedImages.slice(0, 2).map((img, i) => (
        <div 
          key={i} 
          style={{ 
            position: 'relative', 
            aspectRatio: '1', 
            background: '#f0f0f0', 
            overflow: 'hidden' 
          }}
        >
          <Image 
            src={img} 
            onClick={() => onPostClick(i)} 
            fill
            style={{ 
              objectFit: 'cover', 
              objectPosition: 'center'
            }}
            loading="lazy"
            alt={`Post image ${i + 1}`}
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        </div>
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
                background: '#f0f0f0', 
                cursor: 'pointer', 
                overflow: 'hidden' 
              }} 
              onClick={() => onPostClick(idx)}
            >
              <Image 
                src={img} 
                fill
                style={{ 
                  objectFit: 'cover', 
                  objectPosition: 'center', 
                  pointerEvents: 'none' 
                }}
                loading="lazy"
                alt={`Post image ${idx + 1}`}
                sizes="(max-width: 768px) 33vw, 16vw"
              />
              {idx === 4 && count > 5 && (
                <div style={{ 
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
                  zIndex: 1
                }}>
                  +{count - 5}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

PhotoGrid.displayName = 'PhotoGrid';
