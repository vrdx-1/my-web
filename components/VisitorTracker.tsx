'use client'
import { useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function VisitorTracker() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      } else {
        stopHeartbeat();
      }
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

    // อัปเดต last_seen อีกครั้งเมื่อ session พร้อม (กรณีโหลดจาก cookie ช้ากว่า track)
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

    return () => {
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
