'use client';

import { useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';

const TRACKING_STORAGE_PREFIX = 'analytics:daily-visitor';

function getBangkokDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

function buildStorageKey(date: string, scope: 'user' | 'guest', identifier: string): string {
  return `${TRACKING_STORAGE_PREFIX}:${date}:${scope}:${identifier}`;
}

async function postDailyVisitor(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('/api/analytics/daily-visitor', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function DailyVisitorTracker() {
  const pathname = usePathname();
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    let idleId: number | null = null;
    const isHome = pathname === '/' || pathname === '/home';

    const trackByKey = async (
      date: string,
      scope: 'user' | 'guest',
      identifier: string,
      payload: Record<string, unknown>
    ) => {
      if (!identifier) return;

      const key = buildStorageKey(date, scope, identifier);
      if (inFlightRef.current.has(key)) return;

      try {
        if (window.localStorage.getItem(key) === '1') return;
      } catch {
        // ignore storage failures
      }

      inFlightRef.current.add(key);
      const ok = await postDailyVisitor(payload);
      inFlightRef.current.delete(key);

      if (cancelled || !ok) return;

      try {
        window.localStorage.setItem(key, '1');
      } catch {
        // ignore storage failures
      }
    };

    const run = async (sessionOverride?: Session | null) => {
      const date = getBangkokDateString();
      const session =
        sessionOverride !== undefined
          ? sessionOverride
          : (await supabase.auth.getSession()).data.session;

      const userId = session?.user?.id ? String(session.user.id) : '';
      if (userId) {
        await trackByKey(date, 'user', userId, {});
        return;
      }

      const guestToken = String(getPrimaryGuestToken() || '').trim();
      if (!guestToken || guestToken.length > 200) return;
      await trackByKey(date, 'guest', guestToken, { guestToken });
    };

    const scheduleRun = (sessionOverride?: Session | null) => {
      if (cancelled) return;
      const runner = () => {
        if (cancelled) return;
        void run(sessionOverride);
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleId = (
          window as Window & { requestIdleCallback: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number }
        ).requestIdleCallback(runner, { timeout: isHome ? 7000 : 3000 });
        return;
      }

      timeoutId = window.setTimeout(runner, isHome ? 1800 : 600);
    };

    scheduleRun();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      scheduleRun(session ?? null);
    });

    return () => {
      cancelled = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (idleId != null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (
          window as Window & { cancelIdleCallback: (id: number) => void }
        ).cancelIdleCallback(idleId);
        idleId = null;
      }
      subscription.unsubscribe();
    };
  }, [pathname]);

  return null;
}
