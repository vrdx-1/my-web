import React from 'react';

/**
 * Reusable loading spinner component
 * Optimized with React.memo for better performance
 */
export const LoadingSpinner = React.memo(() => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
      <div className="loading-spinner-circle">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';
