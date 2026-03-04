'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function VisitorTracker() {
  const pathname = usePathname()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentUserId: string | null = null;
    const now = () => new Date().toISOString();

    /** อัปเดต profiles.last_seen */
    const updatePresenceNow = () => {
      if (currentUserId) {
        supabase
          .from('profiles')
          .update({ last_seen: now() })
          .eq('id', currentUserId)
          .then(() => {});
      }
    };
    const updateLastSeen = updatePresenceNow;

    const startPresenceHeartbeat = () => {
      if (heartbeatIntervalRef.current) return;
      updatePresenceNow();
      heartbeatIntervalRef.current = setInterval(updatePresenceNow, 60 * 1000);
    };

    const stopPresenceHeartbeat = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
    const stopHeartbeat = stopPresenceHeartbeat;

    const applyUserPresence = (user: { id: string } | null) => {
      currentUserId = user?.id ?? null;
    };

    /** อัปเดต last_seen เฉยๆ (ใช้เมื่ออยู่หน้า admin เพื่อให้สถานะออนไลน์ยังขึ้น) */
    const runPresenceOnly = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        applyUserPresence(user ?? null);
        startPresenceHeartbeat();
      } catch (_) {
        // ignore
      }
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

        startPresenceHeartbeat();

        const { data: { user } } = await supabase.auth.getUser();
        applyUserPresence(user ?? null);

        await supabase.from('visitor_logs').insert({
          visitor_id: vId,
          user_id: user?.id ?? null,
          page_path: window.location.pathname,
          user_agent: navigator.userAgent,
          is_first_visit: isFirstVisit
        });

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

    // ทำหลังหน้าโหลดเสร็จหรือเบราว์เซอร์ว่าง — ไม่แข่งกับโหลดฟีด
    const scheduleTrack = () => {
      if (typeof requestIdleCallback !== 'undefined') {
        return requestIdleCallback(() => { track(); }, { timeout: 3000 });
      }
      return window.setTimeout(() => { track(); }, 1500) as unknown as number;
    };
    const cancelScheduled = (id: number) => {
      if (typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(id);
      else clearTimeout(id);
    };
    const scheduledId = scheduleTrack();

    const lateTouch = setTimeout(() => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.id) applyUserPresence(user);
      });
    }, 2000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      applyUserPresence(uid ? { id: uid } : null);
    });

    const onVisibilityChange = () => {
      if (!document.hidden && typeof window !== 'undefined') {
        updatePresenceNow();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelScheduled(scheduledId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(lateTouch);
      subscription.unsubscribe();
      stopPresenceHeartbeat();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [pathname]);

  return null;
}
