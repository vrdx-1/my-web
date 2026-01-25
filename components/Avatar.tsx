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
          fill={session ? "#1877f2" : "#65676b"}
        >
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';
