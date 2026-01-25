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
    <div style={{ display: 'flex', borderBottom: '1px solid #ddd' }} className={className}>
      {tabs.map((tab) => (
        <div
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '15px',
            color: activeTab === tab.value ? '#1877f2' : '#65676b',
            fontWeight: 'bold',
            borderBottom: activeTab === tab.value ? '3px solid #1877f2' : 'none',
            cursor: 'pointer',
            fontSize: '15px',
          }}
        >
          {tab.label}
        </div>
      ))}
    </div>
  );
});

TabNavigation.displayName = 'TabNavigation';
