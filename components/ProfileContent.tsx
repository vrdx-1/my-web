'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useMainTabScroll } from '@/contexts/MainTabScrollContext';
import { supabase } from '@/lib/supabase';
import { getDisplayAvatarUrl, isProviderDefaultAvatar } from '@/utils/avatarUtils';
import { LAO_FONT } from '@/utils/constants';
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon';

/** แคชโปรไฟล์ล่าสุด — สลับกลับมาไม่แสดง Skeleton (แบบ Facebook) */
let profileCache: { userId: string; username: string; avatarUrl: string } | null = null;

interface ProfileContentProps {
  /** ไม่ส่ง = ไม่แสดงปุ่ม back (เช่น หน้า App profile) */
  onBack?: () => void;
  /** เมื่อไม่มี session (ยังไม่ล็อกอิน) เรียกฟังก์ชันนี้ แทน redirect เอง (เช่น ปิด overlay แล้วค่อย redirect) */
  onNotLoggedIn?: () => void;
}

export function ProfileContent({ onBack, onNotLoggedIn }: ProfileContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [session, setSession] = useState<any>(null);

  const mainTabScroll = useMainTabScroll();
  useLayoutEffect(() => {
    if (!mainTabScroll) return;
    const getScroll = () => scrollContainerRef.current?.scrollTop ?? 0;
    const setScroll = (y: number) => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = y;
    };
    mainTabScroll.registerScroll('/profile', getScroll, setScroll);
    return () => mainTabScroll.unregisterScroll('/profile');
  }, [mainTabScroll]);

  /** สลับมาหน้าโปรไฟล์ → ล็อก scroll: ดึง window ขึ้นบนเสมอ ไม่งั้นจะเลื่อนตามตำแหน่งของหน้าโฮม */
  useLayoutEffect(() => {
    if (pathname !== '/profile') return;
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [pathname]);

  useLayoutEffect(() => {
    if (pathname !== '/profile' || !session) return;
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = 0;
    const id = requestAnimationFrame(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, session]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (currentSession) {
        const userId = currentSession.user?.id;
        if (userId && profileCache?.userId === userId) {
          setUsername(profileCache.username);
          setAvatarUrl(profileCache.avatarUrl);
          setLoading(false);
        }
        setSession(currentSession);
        const user = currentSession.user;
        const createdAtMs = user.created_at ? new Date(user.created_at).getTime() : NaN;
        const isNewEmailUser = Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 60_000;

        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (isNewEmailUser) {
          const hasRealUsername =
            !!profile &&
            !!profile.username &&
            profile.username.trim() !== '' &&
            profile.username !== 'Guest User';
          const isOAuthProvider =
            user.app_metadata?.provider === 'google' || user.app_metadata?.provider === 'facebook';

          if (isOAuthProvider && !hasRealUsername) {
            const rawAvatar = profile?.avatar_url || '';
            if (rawAvatar && isProviderDefaultAvatar(rawAvatar)) {
              await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
            }
            const meta = user.user_metadata || {};
            const displayName = meta.full_name || meta.name || meta.display_name || '';
            const emailStr = user.email || '';
            const emailFallback = emailStr.replace(/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i, '');
            const defaultName = (displayName || emailFallback || 'Guest User').trim();
            try {
              await supabase.from('profiles').upsert(
                { id: user.id, username: defaultName, avatar_url: null },
                { onConflict: 'id' }
              );
              setUsername(defaultName);
              setAvatarUrl('');
              localStorage.removeItem('pending_registration');
              router.push('/home');
              setLoading(false);
              return;
            } catch {}
          } else if (!isOAuthProvider) {
            const rawAvatar = profile?.avatar_url || '';
            if (rawAvatar && isProviderDefaultAvatar(rawAvatar)) {
              await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
            }
            const meta = user.user_metadata || {};
            const displayName = meta.full_name || meta.name || meta.display_name || '';
            const emailStr = user.email || '';
            const emailFallback = emailStr.replace(/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i, '');
            const defaultName = (displayName || emailFallback || 'Guest User').trim();
            try {
              await supabase.from('profiles').upsert(
                { id: user.id, username: defaultName, avatar_url: null },
                { onConflict: 'id' }
              );
              setUsername(defaultName);
              setAvatarUrl('');
              profileCache = { userId: user.id, username: defaultName, avatarUrl: '' };
            } catch {}
          }
        }

        if (profile) {
          const name = profile.username || '';
          const rawAvatar = profile.avatar_url || '';
          let url = '';
          if (rawAvatar && isProviderDefaultAvatar(rawAvatar)) {
            await supabase.from('profiles').update({ avatar_url: null }).eq('id', currentSession.user.id);
          } else {
            url = getDisplayAvatarUrl(rawAvatar);
          }
          setUsername(name);
          setAvatarUrl(url);
          if (currentSession.user?.id) {
            profileCache = { userId: currentSession.user.id, username: name, avatarUrl: url };
          }
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, [router]);

  useEffect(() => {
    if (!loading && !session && pathname === '/profile') {
      if (onNotLoggedIn) {
        onNotLoggedIn();
      } else {
        // Guest เข้าหน้า profile โดยตรง (ไม่ผ่าน overlay) → ไปหน้าโฮมให้ใช้ได้ปกติ ไม่เด้งไปลงทะเบียน
        router.replace('/home');
      }
    }
  }, [loading, session, router, onNotLoggedIn, pathname]);

  if (loading) {
    const isAppProfile = onBack == null;
    const shimmerStyle = {
      background: 'linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)',
      backgroundSize: '200% 100%',
      animation: 'profile-skeleton-shimmer 1.2s ease-in-out infinite',
    };
    return (
      <div
        className="profile-content-skeleton"
        style={{ maxWidth: '600px', margin: '0 auto', background: '#ffffff', backgroundColor: '#ffffff', height: '100vh', overflow: 'hidden', fontFamily: LAO_FONT }}
        aria-hidden
      >
        <style>{`
          @keyframes profile-skeleton-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        {!isAppProfile && (
          <div style={{ padding: '15px 15px 5px 15px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, background: '#ffffff', backgroundColor: '#ffffff', zIndex: 100 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, ...shimmerStyle }} />
          </div>
        )}
        <div style={{ padding: '20px', ...(isAppProfile ? { paddingTop: '48px' } : {}) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: '#e0e0e0', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '25px' }}>
            <div style={{ width: 75, height: 75, borderRadius: '50%', flexShrink: 0, ...shimmerStyle }} />
            <div style={{ height: 20, flex: 1, maxWidth: 160, borderRadius: 8, ...shimmerStyle }} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, height: 52, borderRadius: 12, ...shimmerStyle }} />
            <div style={{ flex: 1, height: 52, borderRadius: 12, ...shimmerStyle }} />
          </div>
          <div style={{ marginTop: '50px', width: '100%', height: 52, borderRadius: 12, ...shimmerStyle }} />
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        background: '#ffffff',
        backgroundColor: '#ffffff',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: LAO_FONT,
      }}
    >
      <div
        ref={scrollContainerRef}
        style={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
      >
      {onBack != null && (
        <div style={{ padding: '15px 15px 5px 15px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, background: '#ffffff', backgroundColor: '#ffffff', zIndex: 100 }}>
          <button
            type="button"
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: '10px' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
      )}

      <div style={{ padding: '20px', ...(onBack == null ? { paddingTop: '48px' } : {}) }}>
        <Link href="/my-posts" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: '#e0e0e0', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '25px', cursor: 'pointer' }}>
            <div style={{ position: 'relative', width: '75px', height: '75px', borderRadius: '50%', overflow: 'hidden', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <GuestAvatarIcon size={40} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1c1e21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username || 'ຊື່ຜູ້ໃຊ້'}</div>
            </div>
          </div>
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <Link href="/saved" style={{ textDecoration: 'none' }}>
            <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#e0e0e0', borderRadius: '12px', cursor: 'pointer' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2h12a2 2 0 0 1 2 2v18l-8-5-8 5V4a2 2 0 0 1 2-2z" />
              </svg>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1c1e21' }}>ລາຍການທີ່ບັນທຶກ</span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => router.push('/profile/settings')}
            style={{ width: '100%', height: '52px', color: '#1c1e21', background: '#e0e0e0', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1c1e21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            ການຕັ້ງຄ່າ
          </button>
        </div>
      </div>
      </div>
    </main>
  );
}
