'use client'

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [indicatorPx, setIndicatorPx] = useState<{ left: number; width: number }>(() => {
    const initialIndex = activeIndex >= 0 ? activeIndex : 0;
    return { left: initialIndex * 50 + 25, width: 0 };
  });

  const updateIndicator = () => {
    const container = containerRef.current;
    if (!container) return;

    const labelEl = labelRefs.current[activeTab];
    if (!labelEl) return;

    const containerRect = container.getBoundingClientRect();
    const rect = labelEl.getBoundingClientRect();

    // เผื่อให้เส้น “ยาวกว่าตัวหนังสือเล็กน้อย” เพื่อให้ดูสมดุลเหมือนดีไซน์
    const EXTRA_WIDTH_PX = 14;
    const width = rect.width + EXTRA_WIDTH_PX;
    // ทำให้เส้นสมมาตรกึ่งกลางตรงกับกึ่งกลางของตัวหนังสือ (ไม่ใช่กึ่งกลางของเส้นที่ขยายแล้ว)
    const centerX = rect.left - containerRect.left + rect.width / 2;

    setIndicatorPx({ left: centerX, width });
  };

  useLayoutEffect(() => {
    updateIndicator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loadingTab, tabs.length]);

  useLayoutEffect(() => {
    const onResize = () => updateIndicator();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'flex', borderBottom: '1px solid #ddd', minHeight: '36px' }}
      className={className}
    >
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
              minHeight: 36,
              padding: '4px 15px 2px 15px',
              color: isActive ? '#111111' : '#65676b',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              // ทำให้ข้อความแท็บอยู่ชิดด้านบนมากขึ้น (เทียบกับแถบค้นหา)
              justifyContent: 'flex-start',
              touchAction: 'manipulation',
              position: 'relative',
              overflow: 'visible',
              background: 'none',
              border: 'none',
              fontFamily: 'inherit',
            }}
          >
            <div
              ref={(el) => {
                labelRefs.current[tab.value] = el;
              }}
              style={{ display: 'inline-block' }}
            >
              {isLoading ? (
                <TabNavSpinner />
              ) : (
                <span style={{ fontSize: '14px', lineHeight: 1.15, color: isActive ? '#111111' : '#65676b' }}>{tab.label}</span>
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
          left: indicatorPx.left,
          width: indicatorPx.width || '28%',
          height: '3px',
          background: '#1877f2',
          borderRadius: '999px',
          transform: 'translateX(-50%)',
          transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

TabNavigation.displayName = 'TabNavigation';
