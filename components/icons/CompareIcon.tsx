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
  const isFilled = variant === 'filled';
  const beamStroke = isFilled ? Math.max(2.0, strokeWidth * 1.1) : Math.max(1.6, strokeWidth * 0.92);
  const shapeStroke = isFilled ? Math.max(1.95, strokeWidth * 1.05) : Math.max(1.55, strokeWidth * 0.9);
  const mastStroke = isFilled ? Math.max(2.1, strokeWidth * 1.14) : Math.max(1.65, strokeWidth * 0.95);
  const cupFill = isFilled ? color : 'none';

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
      <line x1="4.3" y1="6.1" x2="19.7" y2="6.1" stroke={color} strokeWidth={beamStroke} strokeLinecap="round" />

      <line x1="12" y1="3.4" x2="12" y2="18.9" stroke={color} strokeWidth={mastStroke} strokeLinecap="round" />
      {isFilled ? (
        <rect x="8.4" y="19" width="7.2" height="1.7" rx="0.85" fill={color} />
      ) : (
        <line x1="8.4" y1="19.8" x2="15.6" y2="19.8" stroke={color} strokeWidth={mastStroke} strokeLinecap="round" />
      )}

      <path
        d="M6 6.1L3.95 10.75H8.05L6 6.1Z"
        fill="none"
        stroke={color}
        strokeWidth={shapeStroke}
        strokeLinejoin="round"
      />
      <path
        d="M18 6.1L15.95 10.75H20.05L18 6.1Z"
        fill="none"
        stroke={color}
        strokeWidth={shapeStroke}
        strokeLinejoin="round"
      />

      <path
        d="M2.95 10.95H9.05C9.05 12.72 7.69 14.06 6 14.06C4.31 14.06 2.95 12.72 2.95 10.95Z"
        fill={cupFill}
        stroke={color}
        strokeWidth={shapeStroke}
      />
      <path
        d="M14.95 10.95H21.05C21.05 12.72 19.69 14.06 18 14.06C16.31 14.06 14.95 12.72 14.95 10.95Z"
        fill={cupFill}
        stroke={color}
        strokeWidth={shapeStroke}
      />

    </svg>
  );
}