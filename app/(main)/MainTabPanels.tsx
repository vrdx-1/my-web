'use client';

import React, { useEffect, useCallback, useRef, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { useMainTabScroll, type MainTabId } from '@/contexts/MainTabScrollContext';
import dynamic from 'next/dynamic';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

const MAIN_TAB_PATHS: MainTabId[] = ['/home', '/notification', '/profile'];

const feedFallback = (
  <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
    <FeedSkeleton count={3} />
  </main>
);

const LazyHomePageContent = dynamic(
  () => import('./home/HomePageContent').then((m) => ({ default: m.HomePageContent })),
  { ssr: true, loading: () => feedFallback }
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
  return (
    <Suspense fallback={feedFallback}>
      <LazyHomePageContent />
    </Suspense>
  );
}

function NotificationPanel() {
  return <LazyNotificationPage />;
}

function ProfilePanel() {
  return <LazyProfileContent />;
}

/** ลงทะเบียน scroll ของ tab ที่ใช้ window (home, profile). notification ลงทะเบียนใน useNotificationPage.
 * เรียก restore เฉพาะเมื่อเพิ่งสลับมาแท็บนี้ (prev !== tabId && active === tabId) — ไม่เรียกทุกครั้งที่ effect รัน ไม่งั้นเลื่อนขึ้นแล้วจะกระโดดไปบนสุดเพราะ scrollCtx เปลี่ยน reference ตอน re-render */
function PanelScrollRegister({ tabId, children }: { tabId: MainTabId; children: React.ReactNode }) {
  const scrollCtx = useMainTabScroll();
  const activeTabId = scrollCtx?.activeTabId ?? null;
  const prevActiveTabIdRef = useRef<MainTabId | null>(null);
  const getScroll = useCallback(() => (typeof window !== 'undefined' ? window.scrollY : 0), []);
  const setScroll = useCallback((y: number) => window.scrollTo(0, y), []);

  useEffect(() => {
    if (!scrollCtx) return;
    scrollCtx.registerScroll(tabId, getScroll, setScroll);
    const justSwitchedToThisTab = prevActiveTabIdRef.current !== tabId && activeTabId === tabId;
    prevActiveTabIdRef.current = activeTabId;
    if (justSwitchedToThisTab) {
      scrollCtx.restoreScrollForTab(tabId);
    }
    return () => scrollCtx.unregisterScroll(tabId);
  }, [scrollCtx, tabId, getScroll, setScroll, activeTabId]);

  return <>{children}</>;
}

/** เก็บหน้าโฮม/แจ้งเตือน/โปรไฟล์ไว้ไม่ปิด — สลับแค่ซ่อน/แสดง + บันทึก/คืน scroll */
function MainTabPanelsInner() {
  const pathname = usePathname();
  const activeTabId: MainTabId | null =
    pathname === '/home' || pathname === '/notification' || pathname === '/profile' ? pathname : null;

  return (
    <>
      {MAIN_TAB_PATHS.map((tabId) => {
        const active = activeTabId === tabId;
        return (
          <div
            key={tabId}
            aria-hidden={!active}
            style={{
              display: active ? 'block' : 'none',
              minHeight: '100vh',
            }}
          >
            {tabId === '/home' && (
              <PanelScrollRegister tabId={tabId}>
                <HomePanel />
              </PanelScrollRegister>
            )}
            {tabId === '/notification' && <NotificationPanel />}
            {tabId === '/profile' && <ProfilePanel />}
          </div>
        );
      })}
    </>
  );
}

export function MainTabPanels() {
  return <MainTabPanelsInner />;
}
