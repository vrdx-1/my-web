'use client'

import React from 'react';

interface TabNavigationProps {
  tabs: Array<{ value: string; label: string }>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
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
}) => {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #ddd', minHeight: '44px' }} className={className}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.value;
        return (
          <div
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            style={{
              flex: 1,
              minHeight: '44px',
              padding: '12px 15px 10px 15px',
              color: isActive ? '#1877f2' : '#65676b',
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
              <span style={{ fontSize: '17px', lineHeight: 1.25 }}>{tab.label}</span>
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
