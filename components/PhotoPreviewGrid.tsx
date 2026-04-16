'use client'

import React from 'react';
import Image from 'next/image';
import { PHOTO_GRID_GAP } from '@/utils/layoutConstants';
import { normalizeImageUrl } from '@/utils/avatarUtils';

interface PhotoPreviewGridProps {
  existingImages?: string[];
  newPreviews?: string[];
  onImageClick?: () => void;
  onRemoveImage?: (index: number, isNew: boolean) => void;
  showRemoveButton?: boolean;
  className?: string;
  layout?: string;
  /** Gap เส้นแบ่งรูป — ไม่ใส่ใช้ค่าเดียวกับ layout 2×2 (PHOTO_GRID_GAP) */
  gap?: string;
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
  layout = 'default',
  gap = PHOTO_GRID_GAP,
}) => {
  const gridGap = { rowGap: gap, columnGap: gap };
  const allImages = [...(existingImages || []), ...(newPreviews || [])].map((url, index) => {
    const isPreview = index >= (existingImages?.length ?? 0);
    return isPreview ? url : normalizeImageUrl(url, 'car-images');
  });
  const count = allImages.length;

  if (count === 0) return null;

  const isNew = (i: number) => i >= (existingImages?.length ?? 0);
  const adj = (i: number) => (isNew(i) ? i - (existingImages?.length ?? 0) : i);
  const imageKey = (url: string, index: number) => `${index}:${url}`;

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

  // 1 รูป — แสดง aspect ratio ตามรูปจริง
  if (count === 1) {
    return (
      <div
        onClick={click}
        style={{ position: 'relative', width: '100%', cursor }}
        className={className}
      >
        <img
          src={allImages[0]}
          alt="Preview"
          style={{ width: '100%', height: 'auto', display: 'block' }}
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
          ...gridGap,
          cursor,
        }}
        className={className}
      >
        {[0, 1].map((i) => (
          <div
            key={imageKey(allImages[i], i)}
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
          ...gridGap,
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
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', ...gridGap }}>
          {[1, 2].map((i) => (
            <div
              key={imageKey(allImages[i], i)}
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

  // 4 รูป — 2x2 grid, แต่ละรูป 1:1
  if (count === 4) {
    return (
      <div
        onClick={click}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          ...gridGap,
          cursor,
        }}
        className={className}
      >
        {allImages.map((img, i) => (
          <div
            key={imageKey(img, i)}
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
      </div>
    );
  }

  // 5 รูป — เหมือน PhotoGrid (2 บน, 3 ล่าง)
  if (count === 5) {
    return (
      <div
        onClick={click}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          ...gridGap,
          cursor,
        }}
        className={className}
      >
        {allImages.slice(0, 2).map((img, i) => (
          <div
            key={imageKey(img, i)}
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
            ...gridGap,
          }}
        >
          {allImages.slice(2, 5).map((img, i) => {
            const idx = i + 2;
            return (
              <div
                key={imageKey(img, idx)}
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
                {removeBtn(idx)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 6+ รูป — ใช้ layout ที่เลือก
  if (count >= 6) {
    // Layout: default (2x2 grid สำหรับ 4 รูป, +N ในรูปที่ 4 ถ้า >4)
    if (layout === 'default') {
      return (
        <div
          onClick={click}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            ...gridGap,
            cursor,
          }}
          className={className}
        >
          {allImages.slice(0, 4).map((img, i) => (
            <div
              key={imageKey(img, i)}
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
              {removeBtn(i)}
            </div>
          ))}
        </div>
      );
    }

    // Layout: five-images (2 บน, 3 ล่าง)
    if (layout === 'five-images') {
      return (
        <div
          onClick={click}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            ...gridGap,
            cursor,
          }}
          className={className}
        >
          {allImages.slice(0, 2).map((img, i) => (
            <div
              key={imageKey(img, i)}
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
              ...gridGap,
            }}
          >
            {allImages.slice(2, 5).map((img, i) => {
              const idx = i + 2;
              return (
                <div
                  key={imageKey(img, idx)}
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
                  {removeBtn(idx)}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Layout: car-gallery (ซ้าย 2 รูปใหญ่สี่เหลี่ยมจัตุรัสเท่ากัน, ขวา 3 รูปเล็กสี่เหลี่ยม, gap แคบ)
    if (layout === 'car-gallery') {
      return (
        <div
          onClick={click}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            ...gridGap,
            cursor,
            aspectRatio: '1',
            width: '100%',
          }}
          className={className}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateRows: '1fr 1fr',
              ...gridGap,
              minHeight: 0,
            }}
          >
            {allImages.slice(0, 2).map((img, i) => (
              <div
                key={imageKey(img, i)}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  background: '#f0f0f0',
                  overflow: 'hidden',
                  minHeight: 0,
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
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateRows: '1fr 1fr 1fr',
              ...gridGap,
              minHeight: 0,
            }}
          >
            {allImages.slice(2, 5).map((img, i) => {
              const idx = i + 2;
              return (
                <div
                  key={imageKey(img, idx)}
                  style={{
                    position: 'relative',
                    minHeight: 0,
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
                  {removeBtn(idx)}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Layout: three-images (ซ้ายใหญ่ 1 รูป, ขวา 2 รูปเล็ก - เหมือนตอน post 3 รูป)
    if (layout === 'three-images') {
      return (
        <div
          onClick={click}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: gap,
            rowGap: 0,
            cursor,
            position: 'relative',
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
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', ...gridGap }}>
            {[1, 2].map((i) => (
              <div
                key={imageKey(allImages[i], i)}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '198.5px',
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
                {i === 2 && count > 3 && (
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
                {removeBtn(i)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Layout: one-top-three-bottom (หนึ่งรูปใหญ่อยู่ด้านบน สามรูปเล็ก 1:1 อยู่ด้านล่าง) — โครงสร้างรวมเป็นสี่เหลี่ยมจตุรัส
    if (layout === 'one-top-three-bottom') {
      return (
        <div
          onClick={click}
          style={{
            display: 'grid',
            gridTemplateRows: '2fr 1fr',
            ...gridGap,
            cursor,
            aspectRatio: '1',
            width: '100%',
          }}
          className={className}
        >
          <div style={{ position: 'relative', width: '100%', minHeight: 0 }}>
            <img
              src={allImages[0]}
              alt="Preview 1"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                background: '#f0f0f0',
              }}
            />
            {removeBtn(0)}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              ...gridGap,
            }}
          >
            {allImages.slice(1, 4).map((img, i) => {
              const idx = i + 1;
              return (
                <div
                  key={imageKey(img, idx)}
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
                  {removeBtn(idx)}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Layout: one-top-two-bottom (1 รูปใหญ่อยู่ด้านบน 2 รูปเล็กอยู่ด้านล่าง) — โครงสร้างรวมเป็นสี่เหลี่ยมจตุรัส
    if (layout === 'one-top-two-bottom') {
      return (
        <div
          onClick={click}
          style={{
            display: 'grid',
            gridTemplateRows: '2fr 1fr',
            ...gridGap,
            cursor,
            aspectRatio: '1',
            width: '100%',
          }}
          className={className}
        >
          <div style={{ position: 'relative', width: '100%', minHeight: 0 }}>
            <img
              src={allImages[0]}
              alt="Preview 1"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                background: '#f0f0f0',
              }}
            />
            {removeBtn(0)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...gridGap }}>
            {allImages.slice(1, 3).map((img, i) => {
              const idx = i + 1;
              return (
                <div
                  key={imageKey(img, idx)}
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
                  {removeBtn(idx)}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Layout: two-left-three-right (2 รูปใหญ่ 1:1 ซ้าย, 3 รูปเล็ก 1:1 ขวา — ซ้ายใหญ่กว่าขวา)
    if (layout === 'two-left-three-right') {
      return (
        <div
          onClick={click}
          style={{
            display: 'grid',
            gridTemplateColumns: '3fr 2fr',
            gridTemplateRows: '1fr 1fr 1fr 1fr 1fr 1fr',
            ...gridGap,
            cursor,
            position: 'relative',
            aspectRatio: '5/6',
            width: '100%',
          }}
          className={className}
        >
          {allImages.slice(0, 2).map((img, i) => (
            <div
              key={imageKey(img, i)}
              style={{
                position: 'relative',
                gridColumn: 1,
                gridRow: `${i * 3 + 1} / ${i * 3 + 4}`,
                minHeight: 0,
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
          {allImages.slice(2, 5).map((img, i) => {
            const idx = i + 2;
            return (
              <div
                key={imageKey(img, idx)}
                style={{
                  position: 'relative',
                  gridColumn: 2,
                  gridRow: `${i * 2 + 1} / ${i * 2 + 3}`,
                  minHeight: 0,
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
                {removeBtn(idx)}
              </div>
            );
          })}
        </div>
      );
    }

    // Layout: one-left-three-right (หนึ่งรูปใหญ่อยู่ด้านซ้าย สามรูปเล็ก 1:1 อยู่ด้านขวา) — โครงสร้างรวมเป็นสี่เหลี่ยมจตุรัส, ช่องขวา 1:1, ใช้ grid หลักเดียวเพื่อให้ row gap เท่ากับ layout อื่น
    if (layout === 'one-left-three-right') {
      return (
        <div
          onClick={click}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gridTemplateRows: '1fr 1fr 1fr',
            ...gridGap,
            cursor,
            position: 'relative',
            aspectRatio: '1',
            width: '100%',
          }}
          className={className}
        >
          <div style={{ position: 'relative', gridRow: 'span 3', minHeight: 0 }}>
            <img
              src={allImages[0]}
              alt="Preview 1"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                background: '#f0f0f0',
              }}
            />
            {removeBtn(0)}
          </div>
          {allImages.slice(1, 4).map((img, i) => {
            const idx = i + 1;
            return (
              <div
                key={imageKey(img, idx)}
                style={{
                  position: 'relative',
                  minHeight: 0,
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
                {removeBtn(idx)}
              </div>
            );
          })}
        </div>
      );
    }

    // Fallback to default layout (2x2 grid)
    return (
      <div
        onClick={click}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          ...gridGap,
          cursor,
        }}
        className={className}
      >
        {allImages.slice(0, 4).map((img, i) => (
          <div
            key={imageKey(img, i)}
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
            {removeBtn(i)}
          </div>
        ))}
      </div>
    );
  }

  return null;
});

PhotoPreviewGrid.displayName = 'PhotoPreviewGrid';
