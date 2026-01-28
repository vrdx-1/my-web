import React from 'react';

interface PostActionsProps {
  post: any;
  likedPosts: { [key: string]: boolean };
  savedPosts: { [key: string]: boolean };
  justLikedPosts?: { [key: string]: boolean };
  justSavedPosts?: { [key: string]: boolean };
  onLike: (postId: string) => void;
  onSave: (postId: string) => void;
  onShare: (post: any) => void;
  onViewLikes?: (postId: string) => void;
  onViewSaves?: (postId: string) => void;
}

/**
 * PostActions component - Like, Save, View, Share buttons
 * Optimized with React.memo for better performance
 */
export const PostActions = React.memo<PostActionsProps>(({
  post,
  likedPosts,
  savedPosts,
  justLikedPosts = {},
  justSavedPosts = {},
  onLike,
  onSave,
  onShare,
  onViewLikes,
  onViewSaves,
}) => {
  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike(post.id);
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave(post.id);
  };

  return (
    <div style={{ borderTop: '1px solid #f0f2f5' }}>
      <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Like Button */}
          <div 
            onClick={() => onViewLikes?.(post.id)} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <svg 
              width="22" 
              height="22" 
              viewBox="0 0 24 24" 
              className={justLikedPosts[post.id] ? "animate-pop" : ""} 
              fill={likedPosts[post.id] ? "#e0245e" : "none"} 
              stroke={likedPosts[post.id] ? "#e0245e" : "#4a4d52"} 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              onClick={handleLikeClick}
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path>
            </svg>
            <span style={{ fontSize: '14px', fontWeight: '600', color: likedPosts[post.id] ? '#e0245e' : '#4a4d52' }}>
              {post.likes || 0}
            </span>
          </div>

          {/* Save Button */}
          <div 
            onClick={() => onViewSaves?.(post.id)} 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <svg 
              width="22" 
              height="22" 
              viewBox="0 0 24 24" 
              className={justSavedPosts[post.id] ? "animate-pop" : ""} 
              fill={savedPosts[post.id] ? "#FFD700" : "none"} 
              stroke={savedPosts[post.id] ? "#FFD700" : "#4a4d52"} 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              onClick={handleSaveClick}
            >
              <path d="M6 2h12a2 2 0 0 1 2 2v18l-8-5-8 5V4a2 2 0 0 1 2-2z"></path>
            </svg>
            <span style={{ fontSize: '14px', fontWeight: '600', color: savedPosts[post.id] ? '#FFD700' : '#4a4d52' }}>
              {post.saves || 0}
            </span>
          </div>

          {/* View Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4a4d52' }}>
            <svg 
              width="22" 
              height="22" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#4a4d52" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{post.views || 0}</span>
          </div>

          {/* Share Button */}
          <div 
            onClick={() => onShare(post)} 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <svg 
              width="22" 
              height="22" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#4a4d52" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
});

PostActions.displayName = 'PostActions';
