'use client'

import React from 'react';

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
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #ddd', minHeight: '44px' }} className={className}>
      <style>{`
@keyframes tabNavFadeColor { 0%, 100% { background: #f0f0f0; } 12.5% { background: #1a1a1a; } 25% { background: #4a4a4a; } 37.5% { background: #6a6a6a; } 50% { background: #8a8a8a; } 62.5% { background: #b0b0b0; } 75% { background: #d0d0d0; } 87.5% { background: #e5e5e5; } }
.tab-nav-loading-spinner { display: inline-block; width: 20px; height: 20px; position: relative; }
.tab-nav-loading-spinner div { position: absolute; width: 4px; height: 4px; border-radius: 50%; top: 0; left: 50%; margin-left: -2px; transform-origin: 2px 10px; background: currentColor; animation: tabNavFadeColor 1s linear infinite; opacity: 0.8; }
.tab-nav-loading-spinner div:nth-child(1) { transform: rotate(0deg); animation-delay: 0s; }
.tab-nav-loading-spinner div:nth-child(2) { transform: rotate(45deg); animation-delay: 0.125s; }
.tab-nav-loading-spinner div:nth-child(3) { transform: rotate(90deg); animation-delay: 0.25s; }
.tab-nav-loading-spinner div:nth-child(4) { transform: rotate(135deg); animation-delay: 0.375s; }
.tab-nav-loading-spinner div:nth-child(5) { transform: rotate(180deg); animation-delay: 0.5s; }
.tab-nav-loading-spinner div:nth-child(6) { transform: rotate(225deg); animation-delay: 0.625s; }
.tab-nav-loading-spinner div:nth-child(7) { transform: rotate(270deg); animation-delay: 0.75s; }
.tab-nav-loading-spinner div:nth-child(8) { transform: rotate(315deg); animation-delay: 0.875s; }
      `}</style>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.value;
        const isLoading = loadingTab === tab.value;
        return (
          <div
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            style={{
              flex: 1,
              minHeight: '44px',
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
            }}
          >
            <div style={{ display: 'inline-block', position: 'relative' }}>
              {isLoading ? (
                <span className="tab-nav-loading-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></span>
              ) : (
                <span style={{ fontSize: '17px', lineHeight: 1.25 }}>{tab.label}</span>
              )}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '200%',
                    height: '4px',
                    background: '#1877f2',
                    borderRadius: '999px',
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

TabNavigation.displayName = 'TabNavigation';
