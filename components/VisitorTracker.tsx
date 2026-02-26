'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

/** ถ้าไม่ใช้งาน (แท็บถูกซ่อน/ไม่โฟกัส) เกิน N วินาที เมื่อกลับมาจะจบ session เดิมและสร้างแถวใหม่ */
const SESSION_INACTIVITY_SECONDS = 1;

export default function VisitorTracker() {
  const pathname = usePathname()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionHeartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHiddenAtRef = useRef<number>(0);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentUserId: string | null = null;

    const updateLastSeen = async (userId: string) => {
      await supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', userId);
    };

    const startHeartbeat = (userId: string) => {
      if (heartbeatIntervalRef.current) return;
      updateLastSeen(userId);
      heartbeatIntervalRef.current = setInterval(() => updateLastSeen(userId), 60 * 1000);
    };

    const stopHeartbeat = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };

    const startSessionHeartbeat = () => {
      if (sessionHeartbeatIntervalRef.current) return;
      sessionHeartbeatIntervalRef.current = setInterval(() => {
        const sessionId = sessionStorage.getItem('current_session_id');
        if (!sessionId) return;
        supabase
          .from('user_sessions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', sessionId)
          .then(() => {});
      }, 30 * 1000);
    };

    const stopSessionHeartbeat = () => {
      if (sessionHeartbeatIntervalRef.current) {
        clearInterval(sessionHeartbeatIntervalRef.current);
        sessionHeartbeatIntervalRef.current = null;
      }
    };

    const applyUserPresence = (user: { id: string } | null) => {
      currentUserId = user?.id ?? null;
      if (user?.id) {
        startHeartbeat(user.id);
        const sessionId = sessionStorage.getItem('current_session_id');
        if (sessionId) {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          fetch(`${origin}/api/session-link-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, user_id: user.id }),
          }).catch(() => {});
        }
      } else {
        stopHeartbeat();
      }
    };

    /** อัปเดต last_seen เฉยๆ (ใช้เมื่ออยู่หน้า admin เพื่อให้สถานะออนไลน์ยังขึ้น) */
    const runPresenceOnly = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        applyUserPresence(user ?? null);
      } catch (_) {
        // ignore
      }
    };

    const sendSessionEnd = (useBeacon = false) => {
      const sessionId = sessionStorage.getItem('current_session_id');
      if (!sessionId) return;
      const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/session-end`;
      const payload = JSON.stringify({ sessionId });
      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: 'POST',
          body: payload,
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {});
      }
    };

    /** สร้างแถว session ใหม่ใน DB ผ่าน API (service_role ไม่ติด RLS) แล้วเก็บ id ลง sessionStorage */
    const createNewSession = async (): Promise<boolean> => {
      let vId = localStorage.getItem('visitor_id');
      if (!vId) {
        vId = crypto.randomUUID();
        localStorage.setItem('visitor_id', vId);
      }
      const { data: { user } } = await supabase.auth.getUser();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${origin}/api/session-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitor_id: vId,
          user_id: user?.id ?? null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[VisitorTracker] session-start error:', res.status, err);
        return false;
      }
      const data = await res.json();
      if (data?.sessionId && data?.started_at) {
        sessionStorage.setItem('current_session_id', data.sessionId);
        sessionStorage.setItem('current_session_started_at', data.started_at);
        return true;
      }
      return false;
    };

    const track = async () => {
      try {
        const isAdmin = (pathname ?? '').startsWith('/admin');
        if (isAdmin) {
          await runPresenceOnly();
          return;
        }

        let vId = localStorage.getItem('visitor_id');
        let isFirstVisit = false;
        if (!vId) {
          vId = crypto.randomUUID();
          localStorage.setItem('visitor_id', vId);
          isFirstVisit = true;
        }

        if (!sessionStorage.getItem('current_session_id')) {
          await createNewSession();
        }
        startSessionHeartbeat();

        await supabase.from('visitor_logs').insert({
          visitor_id: vId,
          page_path: window.location.pathname,
          user_agent: navigator.userAgent,
          is_first_visit: isFirstVisit
        });

        const { data: { user } } = await supabase.auth.getUser();
        applyUserPresence(user ?? null);

        channel = supabase.channel('active_users', {
          config: { presence: { key: vId } }
        });

        channel
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && channel) {
              const { data: { user: u } } = await supabase.auth.getUser();
              await channel.track({
                online_at: new Date().toISOString(),
                user_id: u?.id || null,
                is_guest: !u
              });
            }
          });
      } catch (error) {
        console.error('Error tracking visitor:', error);
      }
    };

    track();

    const lateTouch = setTimeout(() => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.id && !heartbeatIntervalRef.current) {
          applyUserPresence(user);
        }
      });
    }, 2000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      applyUserPresence(uid ? { id: uid } : null);
    });

    const onVisibilityChange = () => {
      if (document.hidden) {
        lastHiddenAtRef.current = Date.now();
        return;
      }
      if (!document.hidden && typeof window !== 'undefined') {
        if (currentUserId) updateLastSeen(currentUserId);
        const sessionId = sessionStorage.getItem('current_session_id');
        if (!sessionId) return;
        const inactiveMs = Date.now() - lastHiddenAtRef.current;
        const thresholdMs = SESSION_INACTIVITY_SECONDS * 1000;
        if (lastHiddenAtRef.current > 0 && inactiveMs >= thresholdMs) {
          sendSessionEnd();
          sessionStorage.removeItem('current_session_id');
          sessionStorage.removeItem('current_session_started_at');
          createNewSession().then((created) => {
            if (created) {
              supabase.auth.getUser().then(({ data: { user } }) => {
                if (user?.id) applyUserPresence(user);
              });
            }
          });
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    const onPageUnload = () => sendSessionEnd(true);
    window.addEventListener('pagehide', onPageUnload);
    window.addEventListener('beforeunload', onPageUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageUnload);
      window.removeEventListener('beforeunload', onPageUnload);
      clearTimeout(lateTouch);
      subscription.unsubscribe();
      stopHeartbeat();
      stopSessionHeartbeat();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [pathname]);

  return null;
}
