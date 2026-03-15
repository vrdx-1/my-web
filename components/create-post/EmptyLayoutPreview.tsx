'use client';

import React from 'react';

const EMPTY_SLOT_STYLE: React.CSSProperties = {
  background: '#b3d9e6',
  borderRadius: '2px',
  width: '100%',
  height: '100%',
  minHeight: 0,
};

const SLOT_IMG_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: '2px',
  display: 'block',
};

/** สไตล์ +N แบบเดียวกับในโพสการ์ด */
const PLUS_N_OVERLAY_STYLE: React.CSSProperties = {
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
};

function Slot({ url, style }: { url?: string; style?: React.CSSProperties }) {
  if (url) {
    return <img src={url} alt="" style={{ ...SLOT_IMG_STYLE, ...style }} />;
  }
  return <div style={{ ...EMPTY_SLOT_STYLE, ...style }} />;
}

function SlotWithPlusN({
  url,
  style,
  plusN,
  slotStyle,
}: {
  url?: string;
  style?: React.CSSProperties;
  plusN?: number;
  slotStyle?: React.CSSProperties;
}) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: 0, ...slotStyle }}>
      <Slot url={url} style={style} />
      {plusN != null && plusN > 0 && (
        <div style={PLUS_N_OVERLAY_STYLE}>+{plusN}</div>
      )}
    </div>
  );
}

interface EmptyLayoutPreviewProps {
  layout: string;
  imageUrls: string[];
  gap: string;
  /** เมื่อใช้ในหน้าจัดเรียง: จำกัดขนาดให้อยู่ในกรอบ ไม่ให้ layout ใหญ่หรือทับรูปด้านล่าง */
  constrained?: boolean;
}

const CONTAINED_LAYOUT_STYLE: React.CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  width: 'auto',
  height: 'auto',
};

/** ตอนยังไม่เลือกรูป ให้ layout เปล่ายังเต็มกรอบ (ไม่หดเป็นศูนย์) */
const CONTAINED_EMPTY_LAYOUT_STYLE: React.CSSProperties = {
  ...CONTAINED_LAYOUT_STYLE,
  minWidth: '100%',
  minHeight: '100%',
};

/** แสดง layout เปล่าหรือเติมรูปตามลำดับที่ส่งมา (ช่องที่ไม่มีรูปแสดงเป็นพื้นสีเทาอ่อน) */
export const EmptyLayoutPreview = React.memo<EmptyLayoutPreviewProps>(
  ({ layout, imageUrls, gap, constrained }) => {
    const g = gap;
    const rootStyle = constrained
      ? (imageUrls.length === 0 ? CONTAINED_EMPTY_LAYOUT_STYLE : CONTAINED_LAYOUT_STYLE)
      : undefined;

    if (layout === 'default') {
      const slotCount = 4;
      const plusN = imageUrls.length > slotCount ? imageUrls.length - slotCount : undefined;
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: g,
            width: '100%',
            aspectRatio: '1',
            background: '#ffffff',
            ...rootStyle,
          }}
        >
          {[0, 1, 2].map((i) => (
            <SlotWithPlusN key={i} url={imageUrls[i]} style={{ aspectRatio: '1' }} slotStyle={{ aspectRatio: '1' }} />
          ))}
          <SlotWithPlusN key={3} url={imageUrls[3]} style={{ aspectRatio: '1' }} plusN={plusN} slotStyle={{ aspectRatio: '1' }} />
        </div>
      );
    }

    if (layout === 'car-gallery') {
      const slotCount = 5;
      const plusN = imageUrls.length > slotCount ? imageUrls.length - slotCount : undefined;
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: g,
            width: '100%',
            aspectRatio: '1',
            background: '#ffffff',
            ...rootStyle,
          }}
        >
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: g, background: '#ffffff' }}>
            {[0, 1].map((i) => (
              <SlotWithPlusN key={i} url={imageUrls[i]} style={{ aspectRatio: '1' }} slotStyle={{}} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr 1fr', gap: g, background: '#ffffff' }}>
            {[2, 3].map((i) => (
              <SlotWithPlusN key={i} url={imageUrls[i]} slotStyle={{}} />
            ))}
            <SlotWithPlusN url={imageUrls[4]} plusN={plusN} slotStyle={{}} />
          </div>
        </div>
      );
    }

    if (layout === 'two-left-three-right') {
      const slotCount = 5;
      const plusN = imageUrls.length > slotCount ? imageUrls.length - slotCount : undefined;
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '3fr 2fr',
            gridTemplateRows: '1fr 1fr 1fr 1fr 1fr 1fr',
            gap: g,
            width: '100%',
            aspectRatio: '5/6',
            background: '#ffffff',
            ...rootStyle,
          }}
        >
          <SlotWithPlusN url={imageUrls[0]} slotStyle={{ gridColumn: 1, gridRow: '1 / 4' }} />
          <SlotWithPlusN url={imageUrls[1]} slotStyle={{ gridColumn: 1, gridRow: '4 / 7' }} />
          <SlotWithPlusN url={imageUrls[2]} slotStyle={{ gridColumn: 2, gridRow: '1 / 3' }} />
          <SlotWithPlusN url={imageUrls[3]} slotStyle={{ gridColumn: 2, gridRow: '3 / 5' }} />
          <SlotWithPlusN url={imageUrls[4]} plusN={plusN} slotStyle={{ gridColumn: 2, gridRow: '5 / 7' }} />
        </div>
      );
    }

    if (layout === 'five-images') {
      const slotCount = 5;
      const plusN = imageUrls.length > slotCount ? imageUrls.length - slotCount : undefined;
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: g,
            width: '100%',
            aspectRatio: '1',
            background: '#ffffff',
            ...rootStyle,
          }}
        >
          {[0, 1].map((i) => (
            <SlotWithPlusN key={i} url={imageUrls[i]} style={{ aspectRatio: '1' }} slotStyle={{ aspectRatio: '1' }} />
          ))}
          <div
            style={{
              gridColumn: 'span 2',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: g,
              background: '#ffffff',
            }}
          >
            {[2, 3].map((i) => (
              <SlotWithPlusN key={i} url={imageUrls[i]} style={{ aspectRatio: '1' }} slotStyle={{ aspectRatio: '1' }} />
            ))}
            <SlotWithPlusN url={imageUrls[4]} style={{ aspectRatio: '1' }} plusN={plusN} slotStyle={{ aspectRatio: '1' }} />
          </div>
        </div>
      );
    }

    if (layout === 'one-top-three-bottom') {
      const slotCount = 4;
      const plusN = imageUrls.length > slotCount ? imageUrls.length - slotCount : undefined;
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateRows: '2fr 1fr',
            gap: g,
            width: '100%',
            aspectRatio: '1',
            background: '#ffffff',
            ...rootStyle,
          }}
        >
          <SlotWithPlusN url={imageUrls[0]} slotStyle={{}} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: g,
              background: '#ffffff',
              minHeight: 0,
            }}
          >
            {[1, 2].map((i) => (
              <SlotWithPlusN key={i} url={imageUrls[i]} style={{ aspectRatio: '1' }} slotStyle={{ aspectRatio: '1' }} />
            ))}
            <SlotWithPlusN url={imageUrls[3]} style={{ aspectRatio: '1' }} plusN={plusN} slotStyle={{ aspectRatio: '1' }} />
          </div>
        </div>
      );
    }

    if (layout === 'one-left-three-right') {
      const slotCount = 4;
      const plusN = imageUrls.length > slotCount ? imageUrls.length - slotCount : undefined;
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gridTemplateRows: '1fr 1fr 1fr',
            gap: g,
            width: '100%',
            aspectRatio: '1',
            background: '#ffffff',
            ...rootStyle,
          }}
        >
          <SlotWithPlusN url={imageUrls[0]} slotStyle={{ gridRow: 'span 3' }} />
          {[1, 2].map((i) => (
            <SlotWithPlusN key={i} url={imageUrls[i]} style={{ aspectRatio: '1' }} slotStyle={{ aspectRatio: '1' }} />
          ))}
          <SlotWithPlusN url={imageUrls[3]} style={{ aspectRatio: '1' }} plusN={plusN} slotStyle={{ aspectRatio: '1' }} />
        </div>
      );
    }

    if (layout === 'one-top-two-bottom') {
      const slotCount = 3;
      const plusN = imageUrls.length > slotCount ? imageUrls.length - slotCount : undefined;
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateRows: '2fr 1fr',
            gap: g,
            width: '100%',
            aspectRatio: '1',
            background: '#ffffff',
            ...rootStyle,
          }}
        >
          <SlotWithPlusN url={imageUrls[0]} slotStyle={{}} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: g,
              background: '#ffffff',
              minHeight: 0,
            }}
          >
            <SlotWithPlusN url={imageUrls[1]} style={{ aspectRatio: '1' }} slotStyle={{ aspectRatio: '1' }} />
            <SlotWithPlusN url={imageUrls[2]} style={{ aspectRatio: '1' }} plusN={plusN} slotStyle={{ aspectRatio: '1' }} />
          </div>
        </div>
      );
    }

    if (layout === 'three-images') {
      const slotCount = 3;
      const plusN = imageUrls.length > slotCount ? imageUrls.length - slotCount : undefined;
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: g,
            width: '100%',
            aspectRatio: '1',
            background: '#ffffff',
            ...rootStyle,
          }}
        >
          <SlotWithPlusN url={imageUrls[0]} slotStyle={{ gridRow: 'span 2' }} />
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: g, background: '#ffffff' }}>
            <SlotWithPlusN url={imageUrls[1]} style={{ aspectRatio: '1' }} slotStyle={{ aspectRatio: '1' }} />
            <SlotWithPlusN url={imageUrls[2]} style={{ aspectRatio: '1' }} plusN={plusN} slotStyle={{ aspectRatio: '1' }} />
          </div>
        </div>
      );
    }

    const slotCount = 4;
    const plusN = imageUrls.length > slotCount ? imageUrls.length - slotCount : undefined;
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: g,
          width: '100%',
          aspectRatio: '1',
          background: '#ffffff',
          ...rootStyle,
        }}
      >
        {[0, 1, 2].map((i) => (
          <SlotWithPlusN key={i} url={imageUrls[i]} style={{ aspectRatio: '1' }} slotStyle={{ aspectRatio: '1' }} />
        ))}
        <SlotWithPlusN key={3} url={imageUrls[3]} style={{ aspectRatio: '1' }} plusN={plusN} slotStyle={{ aspectRatio: '1' }} />
      </div>
    );
  },
);

EmptyLayoutPreview.displayName = 'EmptyLayoutPreview';
