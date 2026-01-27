import React from 'react';

interface AvatarProps {
  avatarUrl?: string | null;
  size?: number;
  session?: any;
  className?: string;
}

/**
 * Reusable Avatar component
 * Optimized with React.memo for better performance
 */
export const Avatar = React.memo<AvatarProps>(({ 
  avatarUrl, 
  size = 40, 
  session,
  className 
}) => {
  const defaultSize = size;
  
  return (
    <div 
      style={{ 
        width: `${defaultSize}px`, 
        height: `${defaultSize}px`, 
        borderRadius: '50%', 
        background: '#e4e6eb', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        overflow: 'hidden',
        flexShrink: 0
      }}
      className={className}
    >
      {avatarUrl ? (
        <img 
          src={avatarUrl} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          alt="Avatar"
          loading="lazy"
        />
      ) : (
        <svg 
          width={defaultSize * 0.65} 
          height={defaultSize * 0.65} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke={session ? "#1877f2" : "#8a8a8a"}
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';
