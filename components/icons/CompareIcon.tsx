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
  const beamStroke = Math.max(1.8, strokeWidth);
  const hangerStroke = Math.max(1.6, strokeWidth * 0.95);
  const bowlStroke = Math.max(1.8, strokeWidth);

  if (variant === 'filled') {
    const filledBeamStroke = Math.max(2.6, strokeWidth * 1.95);
    const filledHangerStroke = Math.max(1.5, strokeWidth * 1.08);

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
        <line
          x1="3.2"
          y1="6.2"
          x2="20.8"
          y2="10.6"
          stroke={color}
          strokeWidth={filledBeamStroke}
          strokeLinecap="round"
        />

        <path
          fillRule="evenodd"
          d="M12 4.7a3.15 3.15 0 1 1 0 6.3a3.15 3.15 0 0 1 0-6.3Zm0 2.05a1.1 1.1 0 1 0 0 2.2a1.1 1.1 0 0 0 0-2.2Z"
          fill={color}
        />

        <path
          d="M6.1 9.15L3.7 14.35H8.5L6.1 9.15Z"
          stroke={color}
          strokeWidth={filledHangerStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M3.2 14.35Q6.1 20.15 9 14.35Z" fill={color} />

        <path
          d="M17.9 11.95L15.2 17.65H20.6L17.9 11.95Z"
          stroke={color}
          strokeWidth={filledHangerStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M14.6 17.65Q17.9 24.05 21.2 17.65Z" fill={color} />
      </svg>
    );
  }

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
      <line
        x1="3.7"
        y1="6.6"
        x2="20.3"
        y2="10.4"
        stroke={color}
        strokeWidth={beamStroke}
        strokeLinecap="round"
      />

      <circle cx="12" cy="8.5" r="2.2" stroke={color} strokeWidth={beamStroke} fill="none" />

      <path
        d="M6.3 9.35L4 14.05H8.6L6.3 9.35Z"
        stroke={color}
        strokeWidth={hangerStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M4.2 14.5Q6.3 18.3 8.4 14.5" stroke={color} strokeWidth={bowlStroke} strokeLinecap="round" fill="none" />

      <path
        d="M17.7 11.9L15.4 16.8H20L17.7 11.9Z"
        stroke={color}
        strokeWidth={hangerStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M15.6 17.25Q17.7 21.2 19.8 17.25" stroke={color} strokeWidth={bowlStroke} strokeLinecap="round" fill="none" />
    </svg>
  );
}