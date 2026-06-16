'use client';

import React from 'react';

interface CompareIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export function CompareIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.9,
  style,
}: CompareIconProps) {
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
      <rect x="3.75" y="5" width="6.5" height="14" rx="2.2" stroke={color} strokeWidth={strokeWidth} />
      <rect x="13.75" y="5" width="6.5" height="14" rx="2.2" stroke={color} strokeWidth={strokeWidth} />
      <path d="M10.95 9.25H13.05" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M11.95 8.15L13.05 9.25L11.95 10.35" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.05 14.75H10.95" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M12.05 13.65L10.95 14.75L12.05 15.85" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}