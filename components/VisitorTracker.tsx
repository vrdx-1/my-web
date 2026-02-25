'use client'
import { useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

/** ถ้าไม่ใช้งาน (แท็บถูกซ่อน/ไม่โฟกัส) เกิน N วินาที เมื่อกลับมาจะจบ session เดิมและสร้างแถวใหม่ */
const SESSION_INACTIVITY_SECONDS = 1;

export default function VisitorTracker() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      heartbeatIntervalRef.current = setInterval(() => updateLastSeen(userId), 2 * 60 * 1000);
    };

    const stopHeartbeat = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };

    const applyUserPresence = (user: { id: string } | null) => {
      currentUserId = user?.id ?? null;
      if (user?.id) {
        startHeartbeat(user.id);
        const sessionId = sessionStorage.getItem('current_session_id');
        if (sessionId) {
          supabase
            .from('user_sessions')
            .update({ user_id: user.id })
            .eq('id', sessionId)
            .is('user_id', null)
            .then(() => {});
        }
      } else {
        stopHeartbeat();
      }
    };

    const sendSessionEnd = () => {
      const sessionId = sessionStorage.getItem('current_session_id');
      if (sessionId) {
        fetch('/api/session-end', {
          method: 'POST',
          body: JSON.stringify({ sessionId }),
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {});
      }
    };

    /** สร้างแถว session ใหม่ใน DB แล้วเก็บ id ลง sessionStorage (ใช้ทั้งตอนโหลดครั้งแรกและตอนกลับมาหลัง inactive นาน) */
    const createNewSession = async (): Promise<boolean> => {
      let vId = localStorage.getItem('visitor_id');
      if (!vId) {
        vId = crypto.randomUUID();
        localStorage.setItem('visitor_id', vId);
      }
      const startedAt = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: sessionRow } = await supabase
        .from('user_sessions')
        .insert({
          user_id: user?.id ?? null,
          visitor_id: vId,
          started_at: startedAt,
        })
        .select('id')
        .single();
      if (sessionRow?.id) {
        sessionStorage.setItem('current_session_id', sessionRow.id);
        sessionStorage.setItem('current_session_started_at', startedAt);
        return true;
      }
      return false;
    };

    const track = async () => {
      try {
        if (window.location.pathname.startsWith('/admin')) {
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

    window.addEventListener('pagehide', sendSessionEnd);
    window.addEventListener('beforeunload', sendSessionEnd);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', sendSessionEnd);
      window.removeEventListener('beforeunload', sendSessionEnd);
      clearTimeout(lateTouch);
      subscription.unsubscribe();
      stopHeartbeat();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return null;
}
