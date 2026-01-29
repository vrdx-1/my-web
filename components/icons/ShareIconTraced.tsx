import React from 'react';

export type ShareIconTracedProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  size?: number;
};

/** สีเดียวกับ action อื่น #4a4d52 – ใช้ filter ให้ไอคอนเป็นสีดำ/เทาเข้ม */
const ACTION_ICON_FILTER = 'brightness(0) saturate(100%)';

/**
 * Share icon – ใช้รูปอ้างอิงที่ส่งมาโดยตรง เพื่อให้ตรงแบบทุกพิกเซล
 */
export function ShareIconTraced({ size = 24, width, height, style, ...props }: ShareIconTracedProps) {
  const w = width ?? size;
  const h = height ?? size;
  const combinedStyle = {
    display: 'block',
    objectFit: 'contain',
    ...style,
    filter: ACTION_ICON_FILTER,
  };
  return (
    <img
      src="/share-icon.png?v=2"
      alt=""
      width={w}
      height={h}
      style={combinedStyle}
      loading="eager"
      decoding="async"
      {...props}
    />
  );
}
