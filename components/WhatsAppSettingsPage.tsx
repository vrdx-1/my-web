'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { mergeHeaders } from '@/utils/activeProfile';
import { Avatar } from '@/components/Avatar';
import { LAO_FONT } from '@/utils/constants';
import { formatStoredWhatsAppPhone, normalizeWhatsAppNumberSource, type WhatsAppNumberSource } from '@/utils/whatsapp';

type WhatsAppConfigAccount = {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  role?: string | null;
  is_sub_account?: boolean | null;
  parent_admin_id?: string | null;
  whatsapp_number_source?: string | null;
  updated_at?: string | null;
};

export function WhatsAppSettingsPage() {
  const router = useRouter();
  const { activeProfileId, userProfile, availableProfiles, sessionReady } = useSessionAndProfile();

  const [whatsAppConfigSearchQuery, setWhatsAppConfigSearchQuery] = useState('');
  const [whatsAppConfigError, setWhatsAppConfigError] = useState('');
  const [whatsAppUpdatingKey, setWhatsAppUpdatingKey] = useState('');
  const [whatsAppUseAdminForAll, setWhatsAppUseAdminForAll] = useState<boolean | null>(null);

  // Use context data - no separate API call needed
  const canConfigureWhatsAppSource = Boolean(userProfile?.role === 'admin' || userProfile?.is_sub_account === true);
  
  const whatsAppAdminProfile = useMemo(() => {
    if (!canConfigureWhatsAppSource) return null;
    // For sub-accounts, find the parent admin; for admins, use themselves
    if (userProfile?.is_sub_account && userProfile?.parent_admin_id) {
      return availableProfiles.find((p) => p.id === userProfile.parent_admin_id) || null;
    }
    return userProfile || null;
  }, [userProfile, availableProfiles, canConfigureWhatsAppSource]);

  const whatsAppSubAccounts = useMemo(() => {
    if (!canConfigureWhatsAppSource) return [];
    const adminId = whatsAppAdminProfile?.id;
    if (!adminId) return [];
    // Get all sub accounts of this admin
    return availableProfiles.filter((p) => p.is_sub_account && p.parent_admin_id === adminId);
  }, [availableProfiles, whatsAppAdminProfile, canConfigureWhatsAppSource]);

  const normalizedWhatsAppConfigSearchQuery = whatsAppConfigSearchQuery.trim().toLowerCase();
  const filteredWhatsAppAccounts = useMemo(() => {
    const adminAccounts = whatsAppAdminProfile ? [whatsAppAdminProfile] : [];
    const subAccounts = normalizedWhatsAppConfigSearchQuery
      ? whatsAppSubAccounts.filter((account) => (account.username || '').toLowerCase().includes(normalizedWhatsAppConfigSearchQuery))
      : whatsAppSubAccounts;
    return [...adminAccounts, ...subAccounts];
  }, [normalizedWhatsAppConfigSearchQuery, whatsAppAdminProfile, whatsAppSubAccounts]);

  useEffect(() => {
    if (!sessionReady) {
      setWhatsAppUseAdminForAll(null);
      return;
    }

    if (!canConfigureWhatsAppSource) {
      setWhatsAppUseAdminForAll(null);
      return;
    }

    if (whatsAppSubAccounts.length === 0) {
      setWhatsAppUseAdminForAll(false);
      return;
    }

    const allUsingAdmin = whatsAppSubAccounts.every(
      (account) => normalizeWhatsAppNumberSource(account.whatsapp_number_source) === 'admin'
    );
    const allUsingSelf = whatsAppSubAccounts.every(
      (account) => normalizeWhatsAppNumberSource(account.whatsapp_number_source) === 'self'
    );

    if (allUsingAdmin) {
      setWhatsAppUseAdminForAll(true);
    } else if (allUsingSelf) {
      setWhatsAppUseAdminForAll(false);
    } else {
      setWhatsAppUseAdminForAll(false);
    }
  }, [canConfigureWhatsAppSource, sessionReady, whatsAppSubAccounts]);

  const handleUpdateWhatsAppSource = useCallback(async (
    source: WhatsAppNumberSource,
    options: { profileId?: string; applyToAll?: boolean } = {}
  ) => {
    if (!canConfigureWhatsAppSource) return;

    const updatingKey = options.applyToAll ? `all:${source}` : `${options.profileId || 'unknown'}:${source}`;
    setWhatsAppUpdatingKey(updatingKey);
    setWhatsAppConfigError('');

    try {
      let currentSession = (await supabase.auth.getSession()).data.session;
      if (!currentSession?.access_token) {
        const refreshed = await supabase.auth.refreshSession();
        currentSession = refreshed.data.session ?? currentSession;
      }

      if (!currentSession) {
        router.replace('/register');
        return;
      }

      const response = await fetch('/api/admin/sub-accounts', {
        method: 'PATCH',
        credentials: 'include',
        headers: mergeHeaders(
          {
            'Content-Type': 'application/json',
            ...(currentSession.access_token ? { Authorization: `Bearer ${currentSession.access_token}` } : {}),
          },
          activeProfileId,
        ),
        body: JSON.stringify({
          profileId: options.profileId,
          applyToAll: options.applyToAll === true,
          whatsapp_number_source: source,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to update WhatsApp settings');
      }

      // No need for refetchProfiles - data updates will come from context refresh
    } catch (error) {
      setWhatsAppConfigError(error instanceof Error ? error.message : 'Failed to update WhatsApp settings');
    } finally {
      setWhatsAppUpdatingKey('');
    }
  }, [activeProfileId, canConfigureWhatsAppSource, router]);

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#ffffff', minHeight: '100vh', fontFamily: LAO_FONT, paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ padding: '20px 15px 10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'sticky', top: 0, background: '#ffffff', zIndex: 100, borderBottom: '1px solid #eef2f7' }}>
        <button
          onClick={() => router.push('/profile')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: 0, position: 'absolute', left: 15 }}
          aria-label="Back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1c1e21', margin: 0 }}>ຕັ້ງຄ່າເບີ WhatsApp</h1>
      </div>

      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #eef2f7' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid #d1d5db',
            borderRadius: '12px',
            padding: '9px 12px',
            background: '#f8fafc',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            value={whatsAppConfigSearchQuery}
            onChange={(event) => setWhatsAppConfigSearchQuery(event.target.value)}
            placeholder="ຄົ້ນຫາບັນຊີ"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '15px',
              color: '#111827',
            }}
          />
        </div>
      </div>

      <div style={{ padding: '8px 14px', borderBottom: '1px solid #eef2f7', background: '#fcfcfd' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', flex: 1 }}>
            ໃຊ້ເບີ Admin ກັບທຸກ Sub account
          </div>
          <button
            type="button"
            disabled={Boolean(whatsAppUpdatingKey) || !canConfigureWhatsAppSource || whatsAppUseAdminForAll == null}
            onClick={() => {
              if (whatsAppUseAdminForAll == null) return;
              const newSource = whatsAppUseAdminForAll ? 'self' : 'admin';
              handleUpdateWhatsAppSource(newSource, { applyToAll: true });
            }}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: Boolean(whatsAppUpdatingKey) || !canConfigureWhatsAppSource || whatsAppUseAdminForAll == null ? 'not-allowed' : 'pointer',
              opacity: Boolean(whatsAppUpdatingKey) || !canConfigureWhatsAppSource || whatsAppUseAdminForAll == null ? 0.6 : 1,
              padding: 0,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 46,
                height: 26,
                borderRadius: 999,
                background: whatsAppUseAdminForAll === true ? '#16a34a' : '#d1d5db',
                position: 'relative',
                transition: 'background 0.2s ease',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 3,
                  left: whatsAppUseAdminForAll === true ? 24 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s ease',
                }}
              />
            </div>
          </button>
        </div>
      </div>

      <div data-sub-account-scroll="1" data-whatsapp-config-scroll="1" style={{ padding: '6px 0 10px' }}>
        {whatsAppConfigError ? (
          <div style={{ margin: '8px 14px', padding: '10px 12px', borderRadius: '12px', border: '1px solid #fecaca', background: '#fff1f2', color: '#be123c', fontSize: '13px' }}>
            {whatsAppConfigError}
          </div>
        ) : null}
        {filteredWhatsAppAccounts.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>ບໍ່ພົບບັນຊີ</div>
        ) : (
          filteredWhatsAppAccounts.map((account) => {
            const isAdminAccount = account.id === whatsAppAdminProfile?.id;
            const accountSource = normalizeWhatsAppNumberSource(account.whatsapp_number_source);
            const isUsingAdmin = isAdminAccount || accountSource === 'admin';
            const accountPhone = formatStoredWhatsAppPhone(account.phone || '');
            const toggleDisabled = isAdminAccount || Boolean(whatsAppUpdatingKey) || !canConfigureWhatsAppSource;
            const pendingSelfKey = `${account.id}:self`;
            const pendingAdminKey = `${account.id}:admin`;
            const isPending = whatsAppUpdatingKey === pendingSelfKey || whatsAppUpdatingKey === pendingAdminKey;

            return (
              <div key={account.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', borderBottom: '1px solid #f3f4f6' }}>
                <Avatar avatarUrl={account.avatar_url || ''} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                    {account.username || 'Unnamed'} {isAdminAccount ? <span style={{ color: '#2563eb' }}>Admin</span> : null}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {accountPhone || 'ບໍ່ມີເບີ WhatsApp'}
                  </div>
                </div>
                {isAdminAccount ? (
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', borderRadius: '999px', padding: '4px 8px' }}>ບັນຊີຫລັກ</div>
                ) : (
                  <button
                    type="button"
                    disabled={toggleDisabled}
                    onClick={() => handleUpdateWhatsAppSource(isUsingAdmin ? 'self' : 'admin', { profileId: account.id })}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: toggleDisabled ? 'not-allowed' : 'pointer',
                      opacity: toggleDisabled ? 0.6 : 1,
                      padding: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 26,
                        borderRadius: 999,
                        background: isUsingAdmin ? '#16a34a' : '#d1d5db',
                        position: 'relative',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 3,
                          left: isUsingAdmin ? 24 : 3,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          transition: 'left 0.2s ease',
                        }}
                      />
                    </div>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {!canConfigureWhatsAppSource ? (
        <div style={{ padding: '10px 16px 16px', color: '#6b7280', fontSize: '13px' }}>
          ໜ້ານີ້ສຳລັບ Admin ແລະ Sub account ເທົ່ານັ້ນ
        </div>
      ) : null}

    </main>
  );
}
