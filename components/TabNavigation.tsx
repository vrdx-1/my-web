'use client'

import React from 'react';
import { TabNavSpinner } from '@/components/LoadingSpinner';

interface TabNavigationProps {
  tabs: Array<{ value: string; label: string }>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
  /** แท็บที่กำลัง refresh (แสดง loading เหมือนปุ่มเข้าสู่ระบบ) */
  loadingTab?: string | null;
}

/**
 * TabNavigation Component
 * Reusable tab navigation component for recommend/sold tabs
 */
export const TabNavigation = React.memo<TabNavigationProps>(({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  loadingTab = null,
}) => {
  const activeIndex = tabs.findIndex((t) => t.value === activeTab);
  const indicatorLeft = activeIndex >= 0 ? `${(activeIndex + 0.5) * (100 / tabs.length)}%` : '25%';

  return (
    <div style={{ position: 'relative', display: 'flex', borderBottom: '1px solid #ddd', minHeight: '44px' }} className={className}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.value;
        const isLoading = loadingTab === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onTabChange(tab.value);
            }}
            style={{
              flex: 1,
              minHeight: 44,
              padding: '12px 15px 10px 15px',
              color: isActive ? '#1877f2' : '#4a4d52',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation',
              position: 'relative',
              overflow: 'visible',
              background: 'none',
              border: 'none',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ display: 'inline-block' }}>
              {isLoading ? (
                <TabNavSpinner />
              ) : (
                <span style={{ fontSize: '17px', lineHeight: 1.25, color: '#111111' }}>{tab.label}</span>
              )}
            </div>
          </button>
        );
      })}
      {/* เส้นบ่งชี้แท็บที่เลือก — สไลด์เหมือนหน้า Home */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 0,
          left: indicatorLeft,
          width: '28%',
          height: '4px',
          background: '#1877f2',
          borderRadius: '999px',
          transform: 'translateX(-50%)',
          transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

TabNavigation.displayName = 'TabNavigation';
