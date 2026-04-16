'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { useMainTabScroll } from '@/contexts/MainTabScrollContext';
import { supabase } from '@/lib/supabase';
import { getDisplayAvatarUrl, isProviderDefaultAvatar } from '@/utils/avatarUtils';
import { LAO_FONT } from '@/utils/constants';
import { clearGuestUserData } from '@/utils/storageUtils';
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon';
import { EditNameModal, EditPhoneModal } from '@/app/(main)/profile/edit-profile/EditProfileSections';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { mergeHeaders } from '@/utils/activeProfile';

/** แคชโปรไฟล์ล่าสุด — สลับกลับมาไม่แสดง Skeleton (แบบ Facebook) */
let profileCache: {
  profileId: string;
  username: string;
  avatarUrl: string;
  phone: string;
  isVerified: boolean;
  isAdmin: boolean;
  isSubAccount: boolean;
} | null = null;

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [phone, setPhone] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingUsername, setEditingUsername] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editingPhone, setEditingPhone] = useState('');
  const [, setSavingProfile] = useState(false)
  const [isVerified, setIsVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubAccount, setIsSubAccount] = useState(false);
  const [showSubAccountPanel, setShowSubAccountPanel] = useState(false);
  const [subAccountUsername, setSubAccountUsername] = useState('');
  const [subAccountLoading, setSubAccountLoading] = useState(false);
  const [subAccountSubmitting, setSubAccountSubmitting] = useState(false);
  const [subAccountError, setSubAccountError] = useState('');
  const [subAccountSuccess, setSubAccountSuccess] = useState('');
  const { activeProfileId, authUserId, availableProfiles, setActiveProfile, refetchProfiles } = useSessionAndProfile();

  const canManageSubAccounts = isAdmin;
  const loadSubAccounts = useCallback(async () => {
    if (!canManageSubAccounts) return;
    setSubAccountLoading(true);
    setSubAccountError('');
    try {
      let accessToken = session?.access_token ?? '';
      if (!accessToken) {
        const refreshed = await supabase.auth.refreshSession();
        accessToken = refreshed.data.session?.access_token ?? '';
      }

      const response = await fetch('/api/admin/sub-accounts', {
        method: 'GET',
        credentials: 'include',
        headers: mergeHeaders(
          accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          activeProfileId,
        ),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to load sub accounts');
      }

      await refetchProfiles();
    } catch (error) {
      setSubAccountError(error instanceof Error ? error.message : 'Failed to load sub accounts');
    } finally {
      setSubAccountLoading(false);
    }
  }, [activeProfileId, canManageSubAccounts, refetchProfiles, session?.access_token]);

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
        const targetProfileId = activeProfileId || currentSession.user?.id;
        if (targetProfileId && profileCache?.profileId === targetProfileId) {
          setUsername(profileCache.username);
          setAvatarUrl(profileCache.avatarUrl);
          setPhone(profileCache.phone ?? '');
          setIsVerified(profileCache.isVerified ?? false);
          setIsAdmin(profileCache.isAdmin ?? false);
          setIsSubAccount(profileCache.isSubAccount ?? false);
          setLoading(false);
        }
        setSession(currentSession);
        const user = currentSession.user;
        const createdAtMs = user.created_at ? new Date(user.created_at).getTime() : NaN;
        const isNewEmailUser = Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 60_000;

        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url, phone, is_verified, role, is_sub_account')
          .eq('id', targetProfileId)
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
              setIsAdmin(false);
              setIsSubAccount(false);
              clearGuestUserData();
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
              clearGuestUserData();
              profileCache = {
                profileId: user.id,
                username: defaultName,
                avatarUrl: '',
                phone: '',
                isVerified: false,
                isAdmin: false,
                isSubAccount: false,
              };
            } catch {}
          }
        }

        if (profile) {
          const name = profile.username || '';
          const rawAvatar = profile.avatar_url || '';
          let url = '';
          if (rawAvatar && isProviderDefaultAvatar(rawAvatar)) {
            await supabase.from('profiles').update({ avatar_url: null }).eq('id', targetProfileId);
          } else {
            url = getDisplayAvatarUrl(rawAvatar);
          }
          const rawPhone = profile.phone || '';
          const displayPhone = rawPhone.startsWith('85620') && rawPhone.length === 13
            ? '020' + rawPhone.slice(5)
            : rawPhone;
          const verified = profile.is_verified ?? false;
          const adminRole = profile.role === 'admin';
          const subRole = profile.is_sub_account ?? false;
          setUsername(name);
          setAvatarUrl(url);
          setPhone(displayPhone);
          setIsVerified(verified);
          setIsAdmin(adminRole);
          setIsSubAccount(subRole);
          if (targetProfileId) {
            profileCache = {
              profileId: targetProfileId,
              username: name,
              avatarUrl: url,
              phone: displayPhone,
              isVerified: verified,
              isAdmin: adminRole,
              isSubAccount: subRole,
            };
          }
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, [activeProfileId, router]);

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

  useEffect(() => {
    if (showSubAccountPanel && canManageSubAccounts) {
      loadSubAccounts();
    }
  }, [canManageSubAccounts, loadSubAccounts, showSubAccountPanel]);

  // Lock background scroll while edit-name is open
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const shouldLock = isEditingName || isEditingPhone;
    
    if (shouldLock) {
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = `-${scrollX}px`;
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.documentElement.style.overflow = 'hidden';
      
      const preventDefault = (e: TouchEvent | WheelEvent) => {
        e.preventDefault();
      };
      
      const preventDefaultPassive = (e: TouchEvent) => {
        e.preventDefault();
      };
      
      document.addEventListener('touchmove', preventDefaultPassive, { passive: false });
      document.addEventListener('wheel', preventDefault, { passive: false });
      document.addEventListener('scroll', preventDefault, { passive: false });
      
      return () => {
        document.removeEventListener('touchmove', preventDefaultPassive);
        document.removeEventListener('wheel', preventDefault);
        document.removeEventListener('scroll', preventDefault);
        
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.documentElement.style.overflow = '';
        
        window.scrollTo(scrollX, scrollY);
      };
    } else {
      const scrollY = document.body.style.top ? parseInt(document.body.style.top.replace('px', '')) * -1 : 0;
      const scrollX = document.body.style.left ? parseInt(document.body.style.left.replace('px', '')) * -1 : 0;
      
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      
      if (scrollY !== 0 || scrollX !== 0) {
        window.scrollTo(scrollX, scrollY);
      }
    }
  }, [isEditingName, isEditingPhone]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    try {
      setSavingProfile(true);
      const fileExt = file.name.split('.').pop();
      const targetProfileId = activeProfileId || session.user.id;
      const fileName = `${targetProfileId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('car-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('car-images').getPublicUrl(filePath);
      const publicUrl = data?.publicUrl || '';

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', targetProfileId);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      if (targetProfileId) {
        profileCache = {
          profileId: targetProfileId,
          username,
          avatarUrl: publicUrl,
          phone,
          isVerified,
          isAdmin,
          isSubAccount,
        };
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveProfile = async () => {
    if (!session || !editingUsername.trim()) return;
    const targetProfileId = activeProfileId || session.user.id;

    try {
      setSavingProfile(true);
      const { error } = await supabase
        .from('profiles')
        .update({ username: editingUsername.trim() })
        .eq('id', targetProfileId);

      if (error) throw error;

      setUsername(editingUsername.trim());
      setEditingUsername(false);
      if (targetProfileId) {
        profileCache = {
          profileId: targetProfileId,
          username: editingUsername.trim(),
          avatarUrl,
          phone,
          isVerified,
          isAdmin,
          isSubAccount,
        };
      }
    } catch (error) {
      console.error('Error updating username:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSavingProfile(false);
    }
  };

  const cancelEdit = () => {
    setIsEditingName(false);
    setEditingUsername(username);
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  };

  const handleEditNameClick = () => {
    setEditingUsername(username);
    setIsEditingName(true);
  };

  const handleSaveUsername = (name: string) => {
    saveProfile(name.trim());
  };

  const handleCloseNameModal = () => {
    cancelEdit();
  };

  const handleEditPhoneClick = () => {
    setEditingPhone(phone || '020');
    setIsEditingPhone(true);
  };

  const handleSavePhone = async (phoneNum: string) => {
    if (!session) return;
    const targetProfileId = activeProfileId || session.user.id;
    const valueToSave =
      phoneNum.startsWith('020') && phoneNum.length === 11
        ? '85620' + phoneNum.slice(3)
        : phoneNum;
    const { error } = await supabase
      .from('profiles')
      .update({ phone: valueToSave })
      .eq('id', targetProfileId);
    if (!error) {
      setPhone(phoneNum);
      setIsEditingPhone(false);
      if (targetProfileId) {
        profileCache = {
          profileId: targetProfileId,
          username,
          avatarUrl,
          phone: phoneNum,
          isVerified,
          isAdmin,
          isSubAccount,
        };
      }
    }
  };

  const handleCreateSubAccount = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (subAccountSubmitting || !canManageSubAccounts) return;

    setSubAccountSubmitting(true);
    setSubAccountError('');
    setSubAccountSuccess('');

    try {
      let accessToken = session?.access_token ?? '';
      if (!accessToken) {
        const refreshed = await supabase.auth.refreshSession();
        accessToken = refreshed.data.session?.access_token ?? '';
      }

      const response = await fetch('/api/admin/sub-accounts', {
        method: 'POST',
        credentials: 'include',
        headers: mergeHeaders(
          {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          activeProfileId,
        ),
        body: JSON.stringify({ username: subAccountUsername }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to create sub account');
      }

      setSubAccountUsername('');
      setSubAccountSuccess('สร้าง sub account สำเร็จแล้ว สามารถสลับเข้าใช้งานผ่านบัญชีหลักนี้ได้ทันที');
      await loadSubAccounts();
    } catch (error) {
      setSubAccountError(error instanceof Error ? error.message : 'Failed to create sub account');
    } finally {
      setSubAccountSubmitting(false);
    }
  }, [activeProfileId, canManageSubAccounts, loadSubAccounts, session?.access_token, subAccountSubmitting, subAccountUsername]);

  const handleClosePhoneModal = () => {
    setIsEditingPhone(false);
    setEditingPhone('');
  };

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
        <div style={{ padding: '40px 20px 20px 20px', ...(isAppProfile ? { paddingTop: '60px' } : {}) }}>
          <div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto 16px' }}>
            <div style={{ width: 130, height: 130, borderRadius: '50%', ...shimmerStyle }} />
            <div style={{ position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: '50%', ...shimmerStyle }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 210, height: 28, borderRadius: 10, ...shimmerStyle }} />
              <div style={{ width: 32, height: 32, borderRadius: 8, ...shimmerStyle }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
            <div style={{ width: 206, height: 40, borderRadius: 24, ...shimmerStyle }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0' }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, ...shimmerStyle }} />
              <div style={{ marginLeft: 16, width: 116, height: 18, borderRadius: 8, ...shimmerStyle }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0' }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, ...shimmerStyle }} />
              <div style={{ marginLeft: 16, width: 142, height: 18, borderRadius: 8, ...shimmerStyle }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0' }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, ...shimmerStyle }} />
              <div style={{ marginLeft: 16, width: 88, height: 18, borderRadius: 8, ...shimmerStyle }} />
            </div>
          </div>
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

      <div style={{ padding: '40px 20px 20px 20px', ...(onBack == null ? { paddingTop: '60px' } : {}) }}>
        {/* Hidden file input for avatar upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />

        {/* Avatar Section */}
        <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0, margin: '0 auto 16px' }}>
          <div
            style={{
              width: 130,
              height: 130,
              borderRadius: '50%',
              overflow: 'hidden',
              background: '#f0f2f5',
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f0f2f5',
                  width: '100%',
                }}
              >
                <GuestAvatarIcon size={70} />
              </div>
            )}
          </div>
          <label
            htmlFor="avatar-up"
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              background: '#f3f4f6',
              borderRadius: '50%',
              padding: 8,
              width: 36,
              height: 36,
              boxShadow: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation',
              border: '1px solid #e5e7eb',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <input id="avatar-up" type="file" hidden onChange={handleAvatarChange} accept="image/*" ref={fileInputRef} />
          </label>
        </div>

        {/* Username with edit button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                margin: 0,
                color: '#1c1e21',
              }}
            >
              {username || 'ຊື່ຜູ້ໃຊ້'}
            </h2>
            {isVerified && (
              <svg
                width="22" height="22" viewBox="0 0 24 24"
                style={{ flexShrink: 0 }}
                aria-label="Verified"
              >
                <g fill="#2d9bf0">
                  <circle cx="12" cy="12" r="8.2"/>
                  <circle cx="12" cy="4.7" r="3.5"/>
                  <circle cx="17.2" cy="6.8" r="3.5"/>
                  <circle cx="19.3" cy="12" r="3.5"/>
                  <circle cx="17.2" cy="17.2" r="3.5"/>
                  <circle cx="12" cy="19.3" r="3.5"/>
                  <circle cx="6.8" cy="17.2" r="3.5"/>
                  <circle cx="4.7" cy="12" r="3.5"/>
                  <circle cx="6.8" cy="6.8" r="3.5"/>
                </g>
                <path d="M7.1 12.9L10.3 16.1L17.1 9.2L15.5 7.6L10.3 12.8L8.7 11.3L7.1 12.9Z" fill="white"/>
              </svg>
            )}
            <button
              type="button"
              onClick={handleEditNameClick}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleEditNameClick();
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 5,
                minWidth: 32,
                minHeight: 32,
                touchAction: 'manipulation',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1c1e21" strokeWidth="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </button>
          </div>
        </div>

        {/* WhatsApp row */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          {(() => {
            const hasPhone = phone.length === 11;
            return (
              <button
                type="button"
                onClick={handleEditPhoneClick}
                onTouchEnd={(e) => { e.preventDefault(); handleEditPhoneClick(); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 24,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 448 512" fill="#25d366">
                  <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
                </svg>
                <span style={{ fontSize: '15px', color: hasPhone ? '#111111' : '#9ca3af', fontWeight: hasPhone ? '500' : '400' }}>
                  {hasPhone ? phone : 'ເບີ WhatsApp'}
                </span>
              </button>
            );
          })()}
        </div>

        {canManageSubAccounts && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: showSubAccountPanel ? '16px' : '0' }}>
              <button
                type="button"
                onClick={() => {
                  setShowSubAccountPanel((prev) => !prev);
                  setSubAccountError('');
                  setSubAccountSuccess('');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#111827',
                  border: 'none',
                  borderRadius: 24,
                  padding: '10px 18px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                <span>สร้าง Sub Account</span>
                <span style={{ fontSize: '18px', lineHeight: 1 }}>{showSubAccountPanel ? '−' : '+'}</span>
              </button>
            </div>

            {showSubAccountPanel && (
              <div style={{
                background: '#ffffff',
                borderRadius: '18px',
                padding: '18px',
                boxShadow: '0 10px 30px rgba(17, 24, 39, 0.08)',
                border: '1px solid #e5e7eb',
              }}>
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>Sub Accounts</div>
                  <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>สร้างบัญชีย่อยด้วยชื่ออย่างเดียว แล้วสลับเข้าใช้งานจากบัญชีหลักนี้ได้ทันที</div>
                </div>

                <form onSubmit={handleCreateSubAccount} style={{ display: 'grid', gap: '12px', marginBottom: '18px' }}>
                  <input
                    type="text"
                    value={subAccountUsername}
                    onChange={(event) => setSubAccountUsername(event.target.value)}
                    placeholder="ชื่อของ sub account"
                    required
                    maxLength={50}
                    style={{
                      width: '100%',
                      padding: '13px 15px',
                      borderRadius: '12px',
                      border: '1px solid #d1d5db',
                      fontSize: '15px',
                      background: '#fff',
                      outline: 'none',
                    }}
                  />
                  {subAccountError ? <div style={{ color: '#dc2626', fontSize: '14px' }}>{subAccountError}</div> : null}
                  {subAccountSuccess ? <div style={{ color: '#15803d', fontSize: '14px' }}>{subAccountSuccess}</div> : null}
                  <button
                    type="submit"
                    disabled={subAccountSubmitting}
                    style={{
                      width: 'fit-content',
                      minWidth: '170px',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px 18px',
                      background: subAccountSubmitting ? '#9ca3af' : '#111827',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: subAccountSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {subAccountSubmitting ? 'กำลังสร้าง...' : 'สร้าง Sub Account'}
                  </button>
                </form>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>บัญชีที่ใช้งานได้</div>
                  <button
                    type="button"
                    onClick={loadSubAccounts}
                    disabled={subAccountLoading}
                    style={{
                      background: '#fff',
                      border: '1px solid #d1d5db',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      color: '#111827',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: subAccountLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Refresh
                  </button>
                </div>

                {subAccountLoading ? (
                  <div style={{ color: '#6b7280', fontSize: '14px' }}>กำลังโหลดรายการบัญชี...</div>
                ) : availableProfiles.length === 0 ? (
                  <div style={{ color: '#6b7280', fontSize: '14px' }}>ยังไม่มี sub account สำหรับบัญชีนี้</div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {availableProfiles.map((account) => {
                      const isActiveProfile = (activeProfileId || authUserId) === account.id;
                      const isMainProfile = authUserId === account.id;
                      return (
                      <div
                        key={account.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '14px 16px',
                          borderRadius: '14px',
                          border: '1px solid #e5e7eb',
                          background: '#f9fafb',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>
                            {account.username || 'Unnamed Admin'} {isMainProfile ? '(บัญชีหลัก)' : '(Sub Account)'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>ID: {account.id}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveProfile(account.id)}
                          disabled={isActiveProfile}
                          style={{
                            border: 'none',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            background: isActiveProfile ? '#d1fae5' : '#111827',
                            color: isActiveProfile ? '#065f46' : '#fff',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: isActiveProfile ? 'default' : 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isActiveProfile ? 'กำลังใช้งาน' : 'สลับเข้าใช้'}
                        </button>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Edit Name Modal */}
        <EditNameModal
          isOpen={isEditingName}
          editingUsername={editingUsername}
          setEditingUsername={setEditingUsername}
          onClose={handleCloseNameModal}
          onSave={handleSaveUsername}
        />

        {/* Edit Phone Modal */}
        <EditPhoneModal
          isOpen={isEditingPhone}
          editingPhone={editingPhone}
          setEditingPhone={setEditingPhone}
          onCancel={handleClosePhoneModal}
          onSave={handleSavePhone}
        />

        {/* Modal backdrop overlay */}
        {(isEditingName || isEditingPhone) && (
          <div
            onClick={isEditingName ? handleCloseNameModal : handleClosePhoneModal}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
            }}
          />
        )}

        {/* Menu Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* My Posts */}
          <Link href="/my-posts" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0', cursor: 'pointer', transition: 'background 0.15s ease' }}
              onMouseEnter={(e) => { if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.background = '#f9fafb'; }}
              onMouseLeave={(e) => { if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M7 8h10M7 12h10M7 16h6" />
                </svg>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#4b5563' }}>ໂພສຂອງຂ້ອຍ</span>
              </div>
            </div>
          </Link>

          {/* Saved Items */}
          <Link href="/saved" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0', cursor: 'pointer', transition: 'background 0.15s ease' }}
              onMouseEnter={(e) => { if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.background = '#f9fafb'; }}
              onMouseLeave={(e) => { if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2h12a2 2 0 0 1 2 2v18l-8-5-8 5V4a2 2 0 0 1 2-2z" />
                </svg>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#4b5563' }}>ລາຍການທີ່ບັນທຶກ</span>
              </div>
            </div>
          </Link>

          {/* Settings */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0', cursor: 'pointer', transition: 'background 0.15s ease' }}
            onClick={() => router.push('/profile/settings')}
            onMouseEnter={(e) => { if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.background = '#f9fafb'; }}
            onMouseLeave={(e) => { if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#4b5563' }}>ການຕັ້ງຄ່າ</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </main>
  );
}
