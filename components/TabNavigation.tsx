'use client'

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
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
  const isHomeNav = className.includes('home-tab-navigation');
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
  const rafUpdateRef = useRef<number | null>(null);
  const transitionEnabledRef = useRef(false);

  const updateIndicator = useCallback(() => {
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

    // หน้า home: ให้เส้นฟ้าชิดขอบล่าง (ไม่มีช่องว่างกับขอบ)
    const bottomPx = isHomeNav
      ? 0
      : containerRect.bottom - rect.bottom - LINE_HEIGHT_PX - LINE_GAP_BELOW_TEXT_PX;
    const next = {
      left: centerX,
      width,
      bottom: Math.max(0, bottomPx),
    };

    setIndicatorPx((prev) => {
      const sameLeft = Math.abs(prev.left - next.left) < 0.5;
      const sameWidth = Math.abs(prev.width - next.width) < 0.5;
      const sameBottom = Math.abs(prev.bottom - next.bottom) < 0.5;
      return sameLeft && sameWidth && sameBottom ? prev : next;
    });
  }, [activeTab, isHomeNav]);

  const scheduleUpdateIndicator = useCallback(() => {
    if (rafUpdateRef.current != null) return;
    rafUpdateRef.current = requestAnimationFrame(() => {
      rafUpdateRef.current = null;
      updateIndicator();
    });
  }, [updateIndicator]);

  useLayoutEffect(() => {
    updateIndicator();
    // ปิด transition ตอน mount/วัดตำแหน่งครั้งแรก เพื่อไม่ให้เส้นกระโดดจากซ้ายทุกครั้ง
    if (!transitionEnabledRef.current) {
      transitionEnabledRef.current = true;
      requestAnimationFrame(() => setEnableTransition(true));
    }
  }, [activeTab, loadingTab, updateIndicator]);

  useLayoutEffect(() => {
    let cancelled = false;
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            scheduleUpdateIndicator();
          })
        : null;
    const container = containerRef.current;
    if (ro && container) {
      ro.observe(container);
      tabs.forEach((t) => {
        const el = labelRefs.current[t.value];
        if (el) ro.observe(el);
      });
    }
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) scheduleUpdateIndicator();
      });
    }
    scheduleUpdateIndicator();

    return () => {
      cancelled = true;
      ro?.disconnect();
      if (rafUpdateRef.current != null) {
        cancelAnimationFrame(rafUpdateRef.current);
        rafUpdateRef.current = null;
      }
    };
    // tabs เป็น array literal จาก parent ทุกครั้ง — ใช้แค่ length กับค่าที่มีผลต่อการวัด
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length, scheduleUpdateIndicator]);

  useLayoutEffect(() => {
    const onResize = () => scheduleUpdateIndicator();
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [scheduleUpdateIndicator]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        borderBottom: 'none',
        minHeight: isHomeNav ? '38px' : '32px',
        ...(isHomeNav ? { justifyContent: 'center', gap: 30, paddingTop: 2, paddingBottom: 2 } : {}),
      }}
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
        const centerGapExtraPx = isHomeNav ? 0 : 44;
        const rightPadding = idx < tabs.length / 2 ? baseSidePadding + centerGapExtraPx : baseSidePadding;
        const leftPadding = idx < tabs.length / 2 ? baseSidePadding : baseSidePadding + centerGapExtraPx;
        /** หน้า home: กดได้เฉพาะบริเวณข้อความ + padding พอดีมือ — ไม่เต็มครึ่งจอ */
        const homeTabPadding = '5px 10px 0px';
        const labelTextStyle = {
          fontSize: isHomeNav ? '15px' : '14px',
          lineHeight: isHomeNav ? 1.05 : 0.95,
          color: isActive ? '#111111' : '#8b929b',
          fontWeight: isActive ? 700 : 600,
        } as const;
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
              flex: isHomeNav ? '0 0 auto' : 1,
              minHeight: 32,
              padding: isHomeNav ? homeTabPadding : `0px ${rightPadding}px 0px ${leftPadding}px`,
              color: isActive ? '#111111' : '#7e868f',
              fontWeight: isHomeNav ? 600 : 'bold',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: isHomeNav ? 'center' : alignToCenter,
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
              style={{
                display: 'inline-block',
                position: isHomeNav && isLoading ? 'relative' : undefined,
              }}
            >
              {isHomeNav && isLoading ? (
                <>
                  <span
                    style={{
                      ...labelTextStyle,
                      visibility: 'hidden',
                      pointerEvents: 'none',
                    }}
                  >
                    {tab.label}
                  </span>
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <TabNavSpinner />
                  </span>
                </>
              ) : isLoading ? (
                <TabNavSpinner />
              ) : (
                <span style={labelTextStyle}>{tab.label}</span>
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
          // home-tab: อย่าใช้ 28% ก่อนวัดได้ — จะอยู่กลางจอผิดตำแหน่ง; แสดงเส้นหลัง width > 0
          width:
            indicatorPx.width > 0
              ? indicatorPx.width
              : isHomeNav
                ? 0
                : '28%',
          height: hideIndicator ? '0px' : '3px',
          background: hideIndicator ? 'transparent' : '#1877f2',
          borderRadius: '999px',
          transform: 'translateX(-50%)',
          opacity:
            hideIndicator || (isHomeNav && indicatorPx.width <= 0)
              ? 0
              : 1,
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
