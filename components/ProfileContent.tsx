'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getDisplayAvatarUrl, isProviderDefaultAvatar } from '@/utils/avatarUtils';
import { LAO_FONT } from '@/utils/constants';
import { REGISTER_PATH } from '@/utils/authRoutes';
import { PageSpinner } from '@/components/LoadingSpinner';
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon';

interface ProfileContentProps {
  onBack: () => void;
  /** เมื่อไม่มี session (ยังไม่ล็อกอิน) เรียกฟังก์ชันนี้ แทน redirect เอง (เช่น ปิด overlay แล้วค่อย redirect) */
  onNotLoggedIn?: () => void;
}

export function ProfileContent({ onBack, onNotLoggedIn }: ProfileContentProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (currentSession) {
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
              router.push('/');
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
            } catch {}
          }
        }

        if (profile) {
          setUsername(profile.username || '');
          const rawAvatar = profile.avatar_url || '';
          if (rawAvatar && isProviderDefaultAvatar(rawAvatar)) {
            await supabase.from('profiles').update({ avatar_url: null }).eq('id', currentSession.user.id);
            setAvatarUrl('');
          } else {
            setAvatarUrl(getDisplayAvatarUrl(rawAvatar));
          }
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, [router]);

  useEffect(() => {
    if (!loading && !session) {
      if (onNotLoggedIn) {
        onNotLoggedIn();
      } else {
        router.replace(REGISTER_PATH);
      }
    }
  }, [loading, session, router, onNotLoggedIn]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: LAO_FONT }}>
        <PageSpinner />
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
        background: '#fff',
        minHeight: '100vh',
        fontFamily: LAO_FONT,
      }}
    >
      <div style={{ padding: '15px 15px 5px 15px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 100 }}>
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

      <div style={{ padding: '20px' }}>
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

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/liked" style={{ flex: 1, textDecoration: 'none' }}>
            <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e0e0e0', borderRadius: '12px', cursor: 'pointer' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
              </svg>
            </div>
          </Link>
          <Link href="/saved" style={{ flex: 1, textDecoration: 'none' }}>
            <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e0e0e0', borderRadius: '12px', cursor: 'pointer' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2h12a2 2 0 0 1 2 2v18l-8-5-8 5V4a2 2 0 0 1 2-2z" />
              </svg>
            </div>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => router.push('/profile/settings')}
          style={{ marginTop: '50px', width: '100%', padding: '14px', color: '#1c1e21', background: '#e0e0e0', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1c1e21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          ການຕັ້ງຄ່າ
        </button>
      </div>
    </main>
  );
}
