import React from 'react';

/**
 * Shared "8 dots" markup for all spinners
 * (keeps UX/UI exactly the same, but avoids repeating <div></div> x8 everywhere)
 */
export const SpinnerDots = React.memo(() => {
  return (
    <>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </>
  );
});

SpinnerDots.displayName = 'SpinnerDots';

/** Page/section loading spinner (40px) */
export const PageSpinner = React.memo(() => {
  return (
    <div className="loading-spinner-circle">
      <SpinnerDots />
    </div>
  );
});

PageSpinner.displayName = 'PageSpinner';

/** Button loading spinner (20px) */
export const ButtonSpinner = React.memo(() => {
  return (
    <span className="loading-spinner-circle-btn">
      <SpinnerDots />
    </span>
  );
});

ButtonSpinner.displayName = 'ButtonSpinner';

/** Header tab loading spinner (20px) */
export const TabSpinner = React.memo(() => {
  return (
    <span className="app-header-tab-spinner">
      <SpinnerDots />
    </span>
  );
});

TabSpinner.displayName = 'TabSpinner';

/** Generic tab loading spinner for TabNavigation (20px) */
export const TabNavSpinner = React.memo(() => {
  return (
    <span className="tab-nav-loading-spinner">
      <SpinnerDots />
    </span>
  );
});

TabNavSpinner.displayName = 'TabNavSpinner';

/**
 * Reusable loading spinner component
 * Optimized with React.memo for better performance
 */
export const LoadingSpinner = React.memo(() => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
      <PageSpinner />
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';
