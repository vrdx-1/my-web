'use client';

import React from 'react';

interface CompareIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  variant?: 'outline' | 'filled';
  style?: React.CSSProperties;
}

export function CompareIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.9,
  variant = 'outline',
  style,
}: CompareIconProps) {
  const beamStroke = variant === 'filled' ? Math.max(2.4, strokeWidth * 1.45) : Math.max(1.8, strokeWidth);
  const shapeStroke = variant === 'filled' ? Math.max(2, strokeWidth * 1.2) : Math.max(1.7, strokeWidth * 0.95);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={style}
    >
      <line x1="3" y1="15.3" x2="21" y2="12.5" stroke={color} strokeWidth={beamStroke} strokeLinecap="round" />

      <path
        d="M12 13.9L9.1 18.8Q8.9 19.1 9.3 19.1H14.7Q15.1 19.1 14.9 18.8L12 13.9Z"
        fill="none"
        stroke={color}
        strokeWidth={shapeStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="5.4" cy="11.7" r="3.2" fill="none" stroke={color} strokeWidth={shapeStroke} />
      <circle cx="18.6" cy="9.7" r="3.2" fill="none" stroke={color} strokeWidth={shapeStroke} />

    </svg>
  );
}