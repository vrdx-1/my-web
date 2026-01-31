import React from 'react';

interface GuestAvatarIconProps {
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}

/**
 * Guest avatar fallback icon (matches Home top-right profile icon).
 */
export const GuestAvatarIcon = React.memo<GuestAvatarIconProps>(({
  size = 18,
  stroke = '#000',
  strokeWidth = 2.5,
  className,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );
});

GuestAvatarIcon.displayName = 'GuestAvatarIcon';

