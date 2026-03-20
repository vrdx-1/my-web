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
  /** ซ่อนเส้น indicator (ใช้เฉพาะช่วง skeleton เพื่อไม่ให้เห็นเส้นสี) */
  hideIndicator?: boolean;
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
  hideIndicator = false,
}) => {
  const activeIndex = tabs.findIndex((t) => t.value === activeTab);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const LINE_HEIGHT_PX = 3;
  const LINE_GAP_BELOW_TEXT_PX = 1;
  const [indicatorPx, setIndicatorPx] = useState<{ left: number; width: number; bottom: number }>({
    left: 0,
    width: 0,
    bottom: 0,
  });
  const [enableTransition, setEnableTransition] = useState(false);

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

    // วางเส้นให้ "อยู่ใต้ตัวหนังสือ" โดยอิงจากตำแหน่ง bottom ของ label
    const bottomPx = containerRect.bottom - rect.bottom - LINE_HEIGHT_PX - LINE_GAP_BELOW_TEXT_PX;
    setIndicatorPx({
      left: centerX,
      width,
      bottom: Math.max(0, bottomPx),
    });
  };

  useLayoutEffect(() => {
    updateIndicator();
    // ปิด transition ตอน mount/วัดตำแหน่งครั้งแรก เพื่อไม่ให้เส้นกระโดดจากซ้ายทุกครั้ง
    requestAnimationFrame(() => setEnableTransition(true));
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
      style={{ position: 'relative', display: 'flex', borderBottom: 'none', minHeight: '32px' }}
      className={className}
    >
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.value;
        const isLoading = loadingTab === tab.value;
        // ให้ข้อความแท็บ “เข้าหากึ่งกลางหน้าจอ” (ฝั่งซ้ายชิดขวา, ฝั่งขวาชิดซ้าย)
        const alignToCenter = tabs.length <= 1 ? 'center' : idx < tabs.length / 2 ? 'flex-end' : 'flex-start';
        // ถ้าชิดกันมากไป ให้เพิ่ม padding เฉพาะฝั่งที่ดันเข้าหากัน
        const baseSidePadding = 15;
        // หน้า home อยากให้ข้อความแท็บ “เข้าหากัน” มากขึ้นเล็กน้อย
        const centerGapExtraPx = className.includes('home-tab-navigation') ? 18 : 44;
        const rightPadding = idx < tabs.length / 2 ? baseSidePadding + centerGapExtraPx : baseSidePadding;
        const leftPadding = idx < tabs.length / 2 ? baseSidePadding : baseSidePadding + centerGapExtraPx;
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
              minHeight: 32,
              padding: `0px ${rightPadding}px 0px ${leftPadding}px`,
              color: isActive ? '#111111' : '#65676b',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: alignToCenter,
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
                <span style={{ fontSize: '14px', lineHeight: 0.95, color: isActive ? '#111111' : '#65676b' }}>{tab.label}</span>
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
          bottom: indicatorPx.bottom,
          left: indicatorPx.left,
          width: indicatorPx.width || '28%',
          height: hideIndicator ? '0px' : '3px',
          background: hideIndicator ? 'transparent' : '#1877f2',
          borderRadius: '999px',
          transform: 'translateX(-50%)',
          opacity: hideIndicator ? 0 : 1,
          transition: enableTransition
            ? hideIndicator
              ? 'none'
              : 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            : 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

TabNavigation.displayName = 'TabNavigation';
