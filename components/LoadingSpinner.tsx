import React from 'react';

/**
 * วงหมุนมาตรฐานสากล (circular ring) — คุ้นเคยจาก iOS, Android, Material, Chrome
 */
export const SpinnerRing = React.memo(() => {
  return <div className="spinner-ring" aria-hidden="true" />;
});
SpinnerRing.displayName = 'SpinnerRing';

/** ขนาดเล็ก ใช้ในปุ่ม/แท็บ (รับสีจาก currentColor) */
export const SpinnerRingSm = React.memo(() => {
  return <span className="spinner-ring-sm" aria-hidden="true" />;
});
SpinnerRingSm.displayName = 'SpinnerRingSm';

/** เลิกใช้แล้ว — เก็บไว้เผื่อ backward compatibility */
export const SpinnerDots = React.memo(() => (
  <>
    <div></div><div></div><div></div><div></div>
    <div></div><div></div><div></div><div></div>
  </>
));
SpinnerDots.displayName = 'SpinnerDots';

/** Page/section loading spinner (40px) — วงหมุนมาตรฐาน */
export const PageSpinner = React.memo(() => <SpinnerRing />);
PageSpinner.displayName = 'PageSpinner';

/** Button loading spinner (20px) */
export const ButtonSpinner = React.memo(() => <SpinnerRingSm />);
ButtonSpinner.displayName = 'ButtonSpinner';

/** Header tab loading spinner (20px) */
export const TabSpinner = React.memo(() => <SpinnerRingSm />);
TabSpinner.displayName = 'TabSpinner';

/** Generic tab loading spinner for TabNavigation (20px) */
export const TabNavSpinner = React.memo(() => <SpinnerRingSm />);
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
