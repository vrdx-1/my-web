'use client';

import React, { useLayoutEffect, useCallback, Suspense, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useMainTabScroll, type MainTabId } from '@/contexts/MainTabScrollContext';
import { HomeScrollRootProvider, useHomeScrollRootOptional } from '@/contexts/HomeScrollRootContext';
import { HomeScrollShell } from '@/components/home/HomeScrollShell';
import dynamic from 'next/dynamic';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { HomePageContent } from './home/HomePageContent';

const MAIN_TAB_PATHS: MainTabId[] = ['/home', '/notification', '/profile'];

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
  return <LazyProfileContent />;
}

/** ลงทะเบียน scroll ของหน้าโฮม (window หรือกล่องภายในบน iPhone) — ใช้ useLayoutEffect ให้ทันก่อน restore ใน context */
function PanelScrollRegister({ tabId, children }: { tabId: MainTabId; children: React.ReactNode }) {
  const scrollCtx = useMainTabScroll();
  const homeScroll = useHomeScrollRootOptional();
  const getScroll = useCallback(() => {
    if (tabId === '/home' && homeScroll?.useElementScroll && homeScroll.scrollElementRef.current) {
      return homeScroll.scrollElementRef.current.scrollTop;
    }
    return typeof window !== 'undefined' ? window.scrollY : 0;
  }, [tabId, homeScroll]);

  const setScroll = useCallback(
    (y: number) => {
      if (tabId === '/home' && homeScroll?.useElementScroll && homeScroll.scrollElementRef.current) {
        homeScroll.scrollElementRef.current.scrollTop = y;
      } else {
        window.scrollTo(0, y);
      }
    },
    [tabId, homeScroll],
  );

  useLayoutEffect(() => {
    if (!scrollCtx) return;
    scrollCtx.registerScroll(tabId, getScroll, setScroll);
    return () => scrollCtx.unregisterScroll(tabId);
  }, [scrollCtx, tabId, getScroll, setScroll]);

  useEffect(() => {
    if (tabId !== '/home' || !homeScroll?.useElementScroll) return;
    const el = homeScroll.boundScrollEl;
    if (!el) return;
    const onScroll = () => {
      scrollCtx?.notifyTabScrollPosition('/home', el.scrollTop);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [tabId, homeScroll?.useElementScroll, homeScroll?.boundScrollEl, scrollCtx]);

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
              <HomeScrollRootProvider>
                <PanelScrollRegister tabId={tabId}>
                  <HomeScrollShell>
                    <HomePanel />
                  </HomeScrollShell>
                </PanelScrollRegister>
              </HomeScrollRootProvider>
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
