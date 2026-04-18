'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

interface PrivateShop {
  id: string;
  shop_name: string | null;
  shop_phone: string | null;
}

function getStoredActiveProfileId(authUserId: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(`active_profile_${authUserId}`);
  } catch {
    return null;
  }
}

export default function PostPrivateNotePage() {
  const router = useRouter();
  const params = useParams();
  const postId = (params?.id as string) || '';
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPrivateShopId, setCurrentPrivateShopId] = useState<string | null>(null);
  const [shops, setShops] = useState<PrivateShop[]>([]);
  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notAllowed, setNotAllowed] = useState(false);

  const getHiddenStorageKey = (profileId: string) => `create_post_hidden_private_shops_${profileId}`;
  const getLastUsedStorageKey = (profileId: string) => `create_post_last_used_private_shop_${profileId}`;

  useEffect(() => {
    async function init() {
      if (!postId) {
        setLoading(false);
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) {
        setNotAllowed(true);
        setLoading(false);
        return;
      }
      setAuthUserId(uid);

      const effectiveProfileId = getStoredActiveProfileId(uid) || uid;
      setOwnerProfileId(effectiveProfileId);

      const { data: car, error: carError } = await supabase
        .from('cars')
        .select('user_id, private_shop_id')
        .eq('id', postId)
        .maybeSingle();

      if (carError || !car || String(car.user_id) !== String(effectiveProfileId)) {
        setNotAllowed(true);
        setLoading(false);
        return;
      }

      const attachedShopId = typeof car.private_shop_id === 'string' ? car.private_shop_id : null;
      setCurrentPrivateShopId(attachedShopId);
      setSelectedId(attachedShopId);

      let hiddenIds: string[] = [];
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(getHiddenStorageKey(effectiveProfileId));
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              hiddenIds = parsed.filter((item): item is string => typeof item === 'string');
            }
          } catch {
            hiddenIds = [];
          }
        }
      }

      const { data, error } = await supabase
        .from('user_private_shops')
        .select('id, shop_name, shop_phone')
        .eq('user_id', effectiveProfileId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const visibleShops = (data as PrivateShop[]).filter(
          (shop) => !hiddenIds.includes(shop.id) || shop.id === attachedShopId,
        );

        if (typeof window !== 'undefined') {
          const lastUsedId = window.localStorage.getItem(getLastUsedStorageKey(effectiveProfileId));
          if (lastUsedId) {
            const idx = visibleShops.findIndex((shop) => shop.id === lastUsedId);
            if (idx > 0) {
              const next = [...visibleShops];
              const [item] = next.splice(idx, 1);
              next.unshift(item);
              setShops(next);
            } else {
              setShops(visibleShops);
            }
          } else {
            setShops(visibleShops);
          }
        } else {
          setShops(visibleShops);
        }
      }

      setLoading(false);
    }

    void init();
  }, [postId]);

  const attachPrivateShopToPost = async (privateShopId: string | null) => {
    if (!postId || !ownerProfileId) return false;

    const { error } = await supabase
      .from('cars')
      .update({ private_shop_id: privateShopId })
      .eq('id', postId)
      .eq('user_id', ownerProfileId);

    if (error) {
      setSaveError(error.message || 'ບັນທຶກບໍ່ສຳເລັດ');
      return false;
    }

    setCurrentPrivateShopId(privateShopId);
    return true;
  };

  const handleSaveShop = async (): Promise<PrivateShop | null> => {
    if (!ownerProfileId) return null;
    const hasNote = Boolean(shopName.trim());
    const hasPhone = Boolean(shopPhone.trim());
    if (!hasNote && !hasPhone) return null;

    setSaving(true);
    const { data, error } = await supabase
      .from('user_private_shops')
      .insert({
        user_id: ownerProfileId,
        shop_name: hasNote ? shopName.trim() : null,
        shop_phone: hasPhone ? `85620${shopPhone.trim()}` : null,
      })
      .select('id, shop_name, shop_phone')
      .maybeSingle();

    setSaving(false);
    if (error || !data) {
      setSaveError(error?.message || 'ບັນທຶກບໍ່ສຳເລັດ');
      return null;
    }

    const created = data as PrivateShop;
    setShops((prev) => [created, ...prev.filter((shop) => shop.id !== created.id)]);
    return created;
  };

  const handleApplyAndBack = async () => {
    setSaveError(null);
    const hasNote = Boolean(shopName.trim());
    const hasPhone = Boolean(shopPhone.trim());

    if (!hasNote && !hasPhone && selectedId) {
      if (typeof window !== 'undefined' && ownerProfileId) {
        window.localStorage.setItem(getLastUsedStorageKey(ownerProfileId), selectedId);
      }
      const success = await attachPrivateShopToPost(selectedId);
      if (!success) return;
      router.back();
      return;
    }

    if (!hasNote && !hasPhone) {
      router.back();
      return;
    }

    const created = await handleSaveShop();
    if (!created) return;

    if (typeof window !== 'undefined' && ownerProfileId) {
      window.localStorage.setItem(getLastUsedStorageKey(ownerProfileId), created.id);
    }

    const success = await attachPrivateShopToPost(created.id);
    if (!success) return;
      
    router.back();
  };

  if (loading) {
    return (
      <div
        style={{
          ...LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: '#65676b' }}>ກຳລັງໂຫລດ...</span>
      </div>
    );
  }

  if (notAllowed || !authUserId || !ownerProfileId) {
    return (
      <div style={LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX}>
        <div
          style={{
            padding: '10px 15px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '5px',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h3
            style={{
              flex: 1,
              textAlign: 'center',
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#111',
            }}
          >
            ໂນດສ່ວນຕົວ
          </h3>
          <div style={{ width: '40px' }} />
        </div>
        <div style={{ padding: '16px', fontSize: '14px', color: '#4a4d52' }}>
          ບໍ່ມີສິດເຂົ້າເບິ່ງໂນດຂອງໂພສນີ້.
        </div>
      </div>
    );
  }

  const canShowCompleteButton = Boolean(shopName.trim()) || Boolean(shopPhone.trim()) || Boolean(selectedId);

  return (
    <div style={LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX}>
      <div
        style={{
          padding: '10px 15px',
          display: 'flex',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: '#fff',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '5px',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h3
          style={{
            flex: 1,
            textAlign: 'center',
            margin: 0,
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#111',
          }}
        >
          ໂນດສ່ວນຕົວ
        </h3>
        {canShowCompleteButton ? (
          <button
            type="button"
            onClick={handleApplyAndBack}
            style={{
              padding: '6px 12px',
              background: '#1877f2',
              border: 'none',
              borderRadius: '20px',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
            disabled={saving}
          >
            {saving ? 'ກຳລັງບັນທຶກ...' : 'ສຳເລັດ'}
          </button>
        ) : (
          <div style={{ width: '40px' }} />
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 15px 90px' }}>
        {saveError ? (
          <div
            style={{
              marginBottom: '12px',
              padding: '10px 12px',
              background: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#cf1322',
            }}
          >
            {saveError}
          </div>
        ) : null}

        {currentPrivateShopId && shops.some((shop) => shop.id === currentPrivateShopId) ? (
          <div
            style={{
              marginBottom: '12px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '13px',
              color: '#475569',
            }}
          >
            ໂນດທີ່ກຳລັງໃຊ້ກັບໂພສນີ້ຖືກເລືອກໄວ້ແລ້ວ
          </div>
        ) : null}

        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            value={shopName}
            onChange={(e) => {
              setSelectedId(null);
              setShopName(e.target.value);
            }}
            placeholder="ມີພຽງແຕ່ທ່ານເທົ່ານັ້ນທີ່ເຫັນໂນດນີ້"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #d0d0d0',
              fontSize: '16px',
              marginBottom: '10px',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #d0d0d0',
              background: '#fff',
            }}
          >
            <span
              style={{
                fontSize: '16px',
                marginRight: '1px',
                fontWeight: 600,
              }}
            >
              020
            </span>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  fontSize: '16px',
                }}
              >
                <span style={{ fontWeight: 600, color: '#111111' }}>{shopPhone}</span>
                <span style={{ color: '#b0b0b0' }}>{'x'.repeat(8 - shopPhone.length)}</span>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                value={shopPhone + 'x'.repeat(8 - shopPhone.length)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const digitsOnly = raw.replace(/\D/g, '').slice(0, 8);
                  setSelectedId(null);
                  setShopPhone(digitsOnly);
                }}
                onKeyDown={(e) => {
                  const key = e.key;
                  if (key === 'Backspace' && shopPhone.length > 0) {
                    setSelectedId(null);
                    setShopPhone(shopPhone.slice(0, -1));
                    e.preventDefault();
                  } else if (key.length === 1 && /[0-9]/.test(key) && shopPhone.length < 8) {
                    setSelectedId(null);
                    setShopPhone(shopPhone + key);
                    e.preventDefault();
                  }
                }}
                maxLength={8}
                style={{
                  position: 'relative',
                  flex: 1,
                  minWidth: 0,
                  padding: 0,
                  border: 'none',
                  outline: 'none',
                  fontSize: '16px',
                  color: 'transparent',
                  caretColor: '#111111',
                  background: 'transparent',
                }}
              />
            </div>
          </div>
        </div>

        {shops.length > 0 ? (
          <div style={{ marginTop: '16px' }}>
            <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
              ໂນດທີ່ເຄີຍໃຊ້
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {shops.map((shop) => {
                const isSelected = shop.id === selectedId;
                return (
                  <button
                    key={shop.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(shop.id);
                      setShopName('');
                      setShopPhone('');
                      setSaveError(null);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '2px',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #1877f2' : '1px solid #e0e0e0',
                      background: isSelected ? '#eef3ff' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#111111' }}>
                      {shop.shop_name ?? '—'}
                    </span>
                    {shop.shop_phone ? (
                      <span style={{ fontSize: '13px', color: '#4a4d52' }}>
                        {shop.shop_phone.startsWith('85620') && shop.shop_phone.length === 13
                          ? `020${shop.shop_phone.slice(5)}`
                          : shop.shop_phone}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

