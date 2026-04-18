'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { commonStyles } from '@/utils/commonStyles';

interface PrivateShop {
  id: string;
  shop_name: string | null;
  shop_phone: string | null;
}

const CREATE_POST_PRIVATE_SHOP_STORAGE_KEY_PREFIX = 'create_post_private_shop';
const CREATE_POST_PRIVATE_SHOP_UPDATED_EVENT = 'create-post-private-shop-updated';

function getStoredActiveProfileId(authUserId: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(`active_profile_${authUserId}`);
  } catch {
    return null;
  }
}

function getCreatePostPrivateShopStorageKey(profileId: string): string {
  return `${CREATE_POST_PRIVATE_SHOP_STORAGE_KEY_PREFIX}_${profileId}`;
}

const menuItemContentStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
} as const;

const menuItemIconStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#4a4d52',
  flexShrink: 0,
} as const;

const LineIcon = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ display: 'block' }}
  >
    {children}
  </svg>
);

const editIcon = (
  <LineIcon>
    <path d="M12 20h9" />
    <path d="M17.5 3.5a2.12 2.12 0 1 1 3 3L9 18l-4 1 1-4 11.5-11.5z" />
  </LineIcon>
);

const deleteIcon = (
  <LineIcon>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </LineIcon>
);

export default function CreatePostPrivateNotePage() {
  const router = useRouter();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(null);
  const [shops, setShops] = useState<PrivateShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeMenuShopId, setActiveMenuShopId] = useState<string | null>(null);
  const [menuAnimating, setMenuAnimating] = useState(false);
  const menuButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [editingShopName, setEditingShopName] = useState('');
  const [editingShopPhone, setEditingShopPhone] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [hiddenShopIds, setHiddenShopIds] = useState<string[]>([]);

  const getHiddenStorageKey = (profileId: string) => `create_post_hidden_private_shops_${profileId}`;
  const getLastUsedStorageKey = (profileId: string) => `create_post_last_used_private_shop_${profileId}`;

  const persistLastUsedPrivateShop = (profileId: string, shop: PrivateShop) => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(getLastUsedStorageKey(profileId), shop.id);
  };

  const readStoredPrivateShop = (profileId: string | null) => {
    if (typeof window === 'undefined' || !profileId) return null;

    try {
      const raw = window.sessionStorage.getItem(getCreatePostPrivateShopStorageKey(profileId));
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<PrivateShop>;
      return typeof parsed.id === 'string' ? parsed : null;
    } catch {
      window.sessionStorage.removeItem(getCreatePostPrivateShopStorageKey(profileId));
      return null;
    }
  };

  const writeStoredPrivateShop = (profileId: string | null, shop: PrivateShop) => {
    if (typeof window === 'undefined' || !profileId) return;

    window.sessionStorage.setItem(
      getCreatePostPrivateShopStorageKey(profileId),
      JSON.stringify({
        id: shop.id,
        shop_name: shop.shop_name,
        shop_phone: shop.shop_phone,
      }),
    );
    window.dispatchEvent(new Event(CREATE_POST_PRIVATE_SHOP_UPDATED_EVENT));
  };

  const clearStoredPrivateShop = (profileId: string | null) => {
    if (typeof window === 'undefined' || !profileId) return;

    window.sessionStorage.removeItem(getCreatePostPrivateShopStorageKey(profileId));
    window.dispatchEvent(new Event(CREATE_POST_PRIVATE_SHOP_UPDATED_EVENT));
  };

  const getPhoneTail = (phone: string | null | undefined) => {
    const rawPhone = phone ?? '';
    if (rawPhone.startsWith('85620')) return rawPhone.slice(5, 13);
    if (rawPhone.startsWith('020')) return rawPhone.slice(3, 11);
    return rawPhone.replace(/\D/g, '').slice(0, 8);
  };

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) {
        setLoading(false);
        return;
      }
      setAuthUserId(uid);
      const effectiveProfileId = getStoredActiveProfileId(uid) || uid;
      setOwnerProfileId(effectiveProfileId);

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
      setHiddenShopIds(hiddenIds);

      const { data, error } = await supabase
        .from('user_private_shops')
        .select('id, shop_name, shop_phone')
        .eq('user_id', effectiveProfileId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const visibleShops = (data as PrivateShop[]).filter((shop) => !hiddenIds.includes(shop.id));
        const storedShop = readStoredPrivateShop(effectiveProfileId);
        if (typeof window !== 'undefined') {
          const lastUsedId = window.localStorage.getItem(getLastUsedStorageKey(effectiveProfileId));
          if (lastUsedId) {
            const idx = visibleShops.findIndex((shop) => shop.id === lastUsedId);
            if (idx > 0) {
              const next = [...visibleShops];
              const [item] = next.splice(idx, 1);
              next.unshift(item);
              setShops(next);
              if (storedShop?.id && next.some((shop) => shop.id === storedShop.id)) {
                setSelectedId(storedShop.id);
              } else if (storedShop?.id) {
                clearStoredPrivateShop(effectiveProfileId);
              }
            } else {
              setShops(visibleShops);
              if (storedShop?.id && visibleShops.some((shop) => shop.id === storedShop.id)) {
                setSelectedId(storedShop.id);
              } else if (storedShop?.id) {
                clearStoredPrivateShop(effectiveProfileId);
              }
            }
          } else {
            setShops(visibleShops);
            if (storedShop?.id && visibleShops.some((shop) => shop.id === storedShop.id)) {
              setSelectedId(storedShop.id);
            } else if (storedShop?.id) {
              clearStoredPrivateShop(effectiveProfileId);
            }
          }
        } else {
          setShops(visibleShops);
        }
      }

      setLoading(false);
    }

    void init();
  }, []);

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
      .select()
      .maybeSingle();

    setSaving(false);
    if (error) {
      setSaveError(error.message || 'ບັນທຶກບໍ່ສຳເລັດ');
      return null;
    }
    if (!data) return null;
    setSaveError(null);
    const created = data as PrivateShop;
    setShops((prev) => [created, ...prev]);
    return created;
  };

  const handleApplyAndBack = async () => {
    setSaveError(null);
    const hasNote = Boolean(shopName.trim());
    const hasPhone = Boolean(shopPhone.trim());

    if (!hasNote && !hasPhone && selectedId) {
      const selectedShop = shops.find((shop) => shop.id === selectedId);
      if (selectedShop && typeof window !== 'undefined') {
        if (ownerProfileId) {
          persistLastUsedPrivateShop(ownerProfileId, selectedShop);
        }
        writeStoredPrivateShop(ownerProfileId, selectedShop);
      }
      router.back();
      return;
    }

    if (!hasNote && !hasPhone) {
      router.back();
      return;
    }

    // ทุกครั้งที่กด "ສຳເລັດ" ให้สร้าง record ใหม่ในตารางเสมอ (กรอกโน้ตอย่างเดียว เบอร์อย่างเดียว หรือทั้งคู่ ก็บันทึกได้ — ส่วนที่ไม่กรอกเป็น null)
    const created = await handleSaveShop();
    if (!created) return;
    if (typeof window !== 'undefined') {
      if (ownerProfileId) {
        persistLastUsedPrivateShop(ownerProfileId, created);
      }
      writeStoredPrivateShop(ownerProfileId, created);
    }
    router.back();
  };

  const handleConfirmDeleteShop = async () => {
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    if (!id) return;
    setShops((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      clearStoredPrivateShop(ownerProfileId);
    }
    if (activeMenuShopId === id) setActiveMenuShopId(null);
    if (editingShopId === id) setEditingShopId(null);

    setHiddenShopIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      if (typeof window !== 'undefined' && ownerProfileId) {
        window.localStorage.setItem(getHiddenStorageKey(ownerProfileId), JSON.stringify(next));
      }
      return next;
    });
  };

  const closeMenuWithAnimation = () => {
    setMenuAnimating(true);
    setTimeout(() => {
      setActiveMenuShopId(null);
      setMenuAnimating(false);
    }, 220);
  };

  const handleMenuClick = (shopId: string) => {
    if (activeMenuShopId === shopId) {
      closeMenuWithAnimation();
      return;
    }
    setActiveMenuShopId(shopId);
    setMenuAnimating(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMenuAnimating(false);
      });
    });
  };

  const handleOpenEditShop = (shop: PrivateShop) => {
    setEditingShopId(shop.id);
    setEditingShopName(shop.shop_name ?? '');
    setEditingShopPhone(getPhoneTail(shop.shop_phone));
    setEditError(null);
    closeMenuWithAnimation();
  };

  const handleSaveEditedShop = async () => {
    if (!editingShopId || !ownerProfileId) return;
    const trimmedName = editingShopName.trim();
    const trimmedPhone = editingShopPhone.trim();
    const hasNote = Boolean(trimmedName);
    const hasPhone = Boolean(trimmedPhone);

    if (!hasNote && !hasPhone) {
      setEditError('ກະລຸນາປ້ອນໂນດ ຫຼື ເບີໂທ');
      return;
    }

    setEditSaving(true);
    const { data, error } = await supabase
      .from('user_private_shops')
      .update({
        shop_name: hasNote ? trimmedName : null,
        shop_phone: hasPhone ? `85620${trimmedPhone}` : null,
      })
      .eq('id', editingShopId)
      .eq('user_id', ownerProfileId)
      .select('id, shop_name, shop_phone')
      .maybeSingle();

    setEditSaving(false);
    if (error || !data) {
      setEditError(error?.message || 'ແກ້ໄຂບໍ່ສຳເລັດ');
      return;
    }

    const updated = data as PrivateShop;
    setShops((prev) => prev.map((shop) => (shop.id === editingShopId ? updated : shop)));

    if (selectedId === editingShopId) {
      writeStoredPrivateShop(ownerProfileId, updated);
    }

    setEditingShopId(null);
    setEditError(null);
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

  if (!authUserId || !ownerProfileId) {
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
          ຕ້ອງລ໋ອກອິນກ່ອນຈຶ່ງໃຊ້ຟັງຊັນນີ້ໄດ້. ທ່ານຍັງສາມາດໂພສໄດ້ຕາມປົກກະຕິໂດຍບໍ່ໃສ່ໂນດ.
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
              cursor: 'pointer',
            }}
          >
            ສຳເລັດ
          </button>
        ) : (
          <div style={{ width: '40px' }} />
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 15px 90px' }}>
        {saveError && (
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
        )}
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

        {shops.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
              ໂນດທີ່ເຄີຍໃຊ້
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {shops.map((shop) => {
                const isSelected = shop.id === selectedId;
                return (
                  <div
                    key={shop.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #1877f2' : '1px solid #e0e0e0',
                      background: isSelected ? '#eef3ff' : '#fff',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(shop.id);
                        setShopName('');
                        setShopPhone('');
                        setSaveError(null);
                        if (typeof window !== 'undefined') {
                          if (ownerProfileId) {
                            window.localStorage.setItem(getLastUsedStorageKey(ownerProfileId), shop.id);
                          }
                          writeStoredPrivateShop(ownerProfileId, shop);
                        }
                      }}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '14px',
                          marginBottom: '2px',
                        }}
                      >
                        {shop.shop_name ?? '—'}
                      </div>
                      {shop.shop_phone && (
                        <div style={{ fontSize: '13px', color: '#4a4d52' }}>
                          {shop.shop_phone.startsWith('85620') && shop.shop_phone.length === 13
                            ? `020${shop.shop_phone.slice(5)}`
                            : shop.shop_phone}
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      ref={(el) => {
                        menuButtonRefs.current[shop.id] = el;
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuClick(shop.id);
                      }}
                      data-menu-button
                      style={{
                        flexShrink: 0,
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        padding: '6px',
                        touchAction: 'manipulation',
                      }}
                      aria-label="ເປີດເມນູໂນດ"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#9ea2a7" aria-hidden>
                        <circle cx="5" cy="12" r="2.5" />
                        <circle cx="12" cy="12" r="2.5" />
                        <circle cx="19" cy="12" r="2.5" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {activeMenuShopId && (() => {
        const buttonEl = menuButtonRefs.current[activeMenuShopId];
        const rect = buttonEl?.getBoundingClientRect();
        const menuTop = rect ? rect.bottom + 4 : 0;
        const menuRight = rect ? window.innerWidth - rect.right : 0;
        const currentShop = shops.find((shop) => shop.id === activeMenuShopId) ?? null;

        if (!currentShop) return null;

        const dropdown = (
          <div style={{ position: 'fixed', inset: 0, zIndex: 2600, pointerEvents: 'none' }}>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.3)',
                zIndex: 2601,
                pointerEvents: 'auto',
              }}
              onClick={closeMenuWithAnimation}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                right: `${menuRight}px`,
                top: `${menuTop}px`,
                background: '#ffffff',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                borderRadius: '8px',
                zIndex: 2602,
                width: '230px',
                overflow: 'hidden',
                touchAction: 'manipulation',
                transform: menuAnimating ? 'translateY(-10px) scale(0.95)' : 'translateY(0) scale(1)',
                opacity: menuAnimating ? 0 : 1,
                transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
                pointerEvents: 'auto',
              }}
            >
              <div onClick={() => handleOpenEditShop(currentShop)} style={commonStyles.menuItem}>
                <span style={menuItemContentStyle}>
                  <span style={menuItemIconStyle}>{editIcon}</span>
                  <span>ແກ້ໄຂໂນດ</span>
                </span>
              </div>
              <div
                onClick={() => {
                  setDeleteConfirmId(currentShop.id);
                  closeMenuWithAnimation();
                }}
                style={commonStyles.menuItemLast}
              >
                <span style={menuItemContentStyle}>
                  <span style={menuItemIconStyle}>{deleteIcon}</span>
                  <span>ລົບໂນດ</span>
                </span>
              </div>
            </div>
          </div>
        );

        if (typeof document !== 'undefined' && document.body) {
          return createPortal(dropdown, document.body);
        }
        return dropdown;
      })()}

      {deleteConfirmId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 2500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '320px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', color: '#111111' }}>
              ທ່ານຕ້ອງການລົບໂນດບໍ
            </h3>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#e4e6eb',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#1c1e21',
                  cursor: 'pointer',
                }}
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteShop}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#1877f2',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                ລົບ
              </button>
            </div>
          </div>
        </div>
      )}

      {editingShopId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 2700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => {
            setEditingShopId(null);
            setEditError(null);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '16px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '14px', textAlign: 'center', color: '#111111' }}>
              ແກ້ໄຂໂນດ
            </h3>

            {editError && (
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
                {editError}
              </div>
            )}

            <input
              type="text"
              value={editingShopName}
              onChange={(e) => setEditingShopName(e.target.value)}
              placeholder="ແກ້ໄຂໂນດ"
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
                marginBottom: '14px',
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
                  <span style={{ fontWeight: 600, color: '#111111' }}>{editingShopPhone}</span>
                  <span style={{ color: '#b0b0b0' }}>{'x'.repeat(8 - editingShopPhone.length)}</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={editingShopPhone + 'x'.repeat(8 - editingShopPhone.length)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const digitsOnly = raw.replace(/\D/g, '').slice(0, 8);
                    setEditingShopPhone(digitsOnly);
                  }}
                  onKeyDown={(e) => {
                    const key = e.key;
                    if (key === 'Backspace' && editingShopPhone.length > 0) {
                      setEditingShopPhone(editingShopPhone.slice(0, -1));
                      e.preventDefault();
                    } else if (key.length === 1 && /[0-9]/.test(key) && editingShopPhone.length < 8) {
                      setEditingShopPhone(editingShopPhone + key);
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

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => {
                  setEditingShopId(null);
                  setEditError(null);
                }}
                disabled={editSaving}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#e4e6eb',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#1c1e21',
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  opacity: editSaving ? 0.7 : 1,
                }}
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={handleSaveEditedShop}
                disabled={editSaving}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#1877f2',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#fff',
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  opacity: editSaving ? 0.7 : 1,
                }}
              >
                ບັນທຶກ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

