'use client';

import { useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from '@/utils/postUtils';

const TRACKING_STORAGE_PREFIX = 'analytics:daily-visitor';
const TRACKING_SESSION_PREFIX = 'analytics:visit-session';
const TRACKING_SESSION_MARKER_PREFIX = 'analytics:visit-marker';
const SESSION_IDLE_WINDOW_MS = 30 * 60 * 1000;

type TrackingScope = 'user' | 'guest';

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

function buildStorageKey(date: string, scope: TrackingScope, identifier: string): string {
  return `${TRACKING_STORAGE_PREFIX}:${date}:${scope}:${identifier}`;
}

function buildSessionStateKey(date: string, scope: TrackingScope, identifier: string): string {
  return `${TRACKING_SESSION_PREFIX}:${date}:${scope}:${identifier}`;
}

function buildSessionMarkerKey(date: string, scope: TrackingScope, identifier: string, sessionKey: string): string {
  return `${TRACKING_SESSION_MARKER_PREFIX}:${date}:${scope}:${identifier}:${sessionKey}`;
}

function createSessionKey(date: string, scope: TrackingScope, identifier: string): string {
  const entropy = `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  return `${date}:${scope}:${identifier.slice(0, 24)}:${entropy}`.slice(0, 160);
}

function getVisitSessionKey(date: string, scope: TrackingScope, identifier: string): string {
  const storageKey = buildSessionStateKey(date, scope, identifier);
  const now = Date.now();

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { sessionKey?: string; lastActivityAt?: number };
      if (
        parsed?.sessionKey &&
        typeof parsed.lastActivityAt === 'number' &&
        now - parsed.lastActivityAt < SESSION_IDLE_WINDOW_MS
      ) {
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({ sessionKey: parsed.sessionKey, lastActivityAt: now })
        );
        return parsed.sessionKey;
      }
    }
  } catch {
    // ignore storage failures
  }

  const sessionKey = createSessionKey(date, scope, identifier);
  try {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({ sessionKey, lastActivityAt: now })
    );
  } catch {
    // ignore storage failures
  }
  return sessionKey;
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

    const trackVisit = async (
      date: string,
      scope: TrackingScope,
      identifier: string,
      payload: Record<string, unknown>
    ) => {
      if (!identifier) return;

      const dailyKey = buildStorageKey(date, scope, identifier);
      const sessionKey = getVisitSessionKey(date, scope, identifier);
      const sessionMarkerKey = buildSessionMarkerKey(date, scope, identifier, sessionKey);

      let needsDailyTrack = true;
      let needsSessionTrack = true;

      try {
        needsDailyTrack = window.localStorage.getItem(dailyKey) !== '1';
      } catch {
        // ignore storage failures
      }

      try {
        needsSessionTrack = window.sessionStorage.getItem(sessionMarkerKey) !== '1';
      } catch {
        // ignore storage failures
      }

      if (!needsDailyTrack && !needsSessionTrack) return;

      const requestKey = `${sessionMarkerKey}:request`;
      if (inFlightRef.current.has(requestKey)) return;

      inFlightRef.current.add(requestKey);
      const ok = await postDailyVisitor({
        ...payload,
        sessionKey,
        path: pathname,
      });
      inFlightRef.current.delete(requestKey);

      if (cancelled || !ok) return;

      try {
        if (needsDailyTrack) {
          window.localStorage.setItem(dailyKey, '1');
        }
      } catch {
        // ignore storage failures
      }

      try {
        if (needsSessionTrack) {
          window.sessionStorage.setItem(sessionMarkerKey, '1');
        }
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
        await trackVisit(date, 'user', userId, {});
        return;
      }

      const guestToken = String(getPrimaryGuestToken() || '').trim();
      if (!guestToken || guestToken.length > 200) return;
      await trackVisit(date, 'guest', guestToken, { guestToken });
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

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleRun();
      }
    };

    const handleFocus = () => {
      scheduleRun();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);

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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      subscription.unsubscribe();
    };
  }, [pathname]);

  return null;
}
