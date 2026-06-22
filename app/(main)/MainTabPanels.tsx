'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useLayoutEffect, useCallback, Suspense, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useMainTabScroll, type MainTabId } from '@/contexts/MainTabScrollContext';
import dynamic from 'next/dynamic';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { HomePageContent } from './home/HomePageContent';

const MAIN_TAB_PATHS: MainTabId[] = ['/home', '/notification', '/profile', '/saved'];

function getPageScrollY(): number {
  if (typeof window === 'undefined') return 0;
  const scrolling = document.scrollingElement as HTMLElement | null;
  const bodyTop = document.body?.scrollTop ?? 0;
  const docTop = document.documentElement?.scrollTop ?? 0;
  const scrollingTop = scrolling?.scrollTop ?? 0;
  const winTop = window.scrollY ?? window.pageYOffset ?? 0;
  return Math.max(winTop, scrollingTop, bodyTop, docTop);
}

function setPageScrollY(y: number): void {
  if (typeof window === 'undefined') return;
  window.scrollTo(0, y);
  const scrolling = document.scrollingElement as HTMLElement | null;
  if (scrolling) scrolling.scrollTop = y;
  if (document.body) document.body.scrollTop = y;
  if (document.documentElement) document.documentElement.scrollTop = y;
}

const feedFallback = (
  <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
    <FeedSkeleton count={3} />
  </main>
);

const LazyNotificationPage = dynamic(() => import('./notification/page'), {
  ssr: false,
  loading: () => feedFallback,
});

const LazyProfileContent = dynamic(
  () => import('@/components/ProfileContent').then((m) => ({ default: m.ProfileContent })),
  { ssr: false, loading: () => feedFallback }
);

function HomePanel() {
  /** import แบบ static — ไม่รอโหลด chunk แยกตอนกลับมาโฮม (ลดจอขาว/กระพริบจาก dynamic) */
  return (
    <Suspense fallback={feedFallback}>
      <HomePageContent />
    </Suspense>
  );
}

function NotificationPanel() {
  return <LazyNotificationPage />;
}

function ProfilePanel() {
  return <LazyProfileContent key="profile-content-v2" />;
}

/** ลงทะเบียน scroll ของหน้าโฮม (window) — ใช้ useLayoutEffect ให้ทันก่อน restore ใน context
 * การคืน scroll หลังไปหน้าอื่นแล้วกลับมาโฮมทำใน HomePageContent หลังฟีด + virtualizer พร้อม (ไม่ restore ที่นี่) */
function PanelScrollRegister({ tabId, children }: { tabId: MainTabId; children: React.ReactNode }) {
  const scrollCtx = useMainTabScroll();
  const getScroll = useCallback(() => getPageScrollY(), []);
  const setScroll = useCallback((y: number) => setPageScrollY(y), []);

  useLayoutEffect(() => {
    if (!scrollCtx) return;
    scrollCtx.registerScroll(tabId, getScroll, setScroll);
    return () => scrollCtx.unregisterScroll(tabId);
  }, [scrollCtx, tabId, getScroll, setScroll]);

  return <>{children}</>;
}

/** เก็บหน้าโฮม/แจ้งเตือน/โปรไฟล์ไว้ไม่ปิด — สลับแค่ซ่อน/แสดง + บันทึก/คืน scroll */
function MainTabPanelsInner() {
  const pathname = usePathname();
  const activeTabId: MainTabId | null =
    pathname === '/home' || pathname === '/notification' || pathname === '/profile' || pathname === '/saved'
      ? pathname
      : null;
  const [mountedTabs, setMountedTabs] = useState<Partial<Record<MainTabId, true>>>(() => ({
    '/home': true,
  }));

  useEffect(() => {
    if (!activeTabId) return;
    setMountedTabs((prev) => (prev[activeTabId] ? prev : { ...prev, [activeTabId]: true }));
  }, [activeTabId]);

  const shouldRenderTab = useCallback(
    (tabId: MainTabId) => {
      if (tabId === '/home') return true;
      return !!mountedTabs[tabId];
    },
    [mountedTabs],
  );

  return (
    <>
      {MAIN_TAB_PATHS.map((tabId) => {
        const active = activeTabId === tabId;
        const renderTab = shouldRenderTab(tabId);
        return (
          <div
            key={tabId}
            aria-hidden={!active}
            style={{
              display: active ? 'block' : 'none',
              minHeight: '100vh',
            }}
          >
            {renderTab && tabId === '/home' && (
              <PanelScrollRegister tabId={tabId}>
                <HomePanel />
              </PanelScrollRegister>
            )}
            {renderTab && tabId === '/notification' && <NotificationPanel />}
            {renderTab && tabId === '/profile' && <ProfilePanel key="profile-tab-v2" />}
            {renderTab && tabId === '/saved' && <div />}
          </div>
        );
      })}
    </>
  );
}

export function MainTabPanels() {
  return <MainTabPanelsInner />;
}
