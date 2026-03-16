'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

interface PrivateShop {
  id: string;
  shop_name: string | null;
  shop_phone: string | null;
}

export default function CreatePostPrivateNotePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [shops, setShops] = useState<PrivateShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) {
        setLoading(false);
        return;
      }
      setUserId(uid);

      const { data, error } = await supabase
        .from('user_private_shops')
        .select('id, shop_name, shop_phone')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setShops(data as PrivateShop[]);
      }

      setLoading(false);
    }

    void init();
  }, []);

  const handleSaveShop = async (): Promise<PrivateShop | null> => {
    if (!userId) return null;
    const hasNote = Boolean(shopName.trim());
    const hasPhone = Boolean(shopPhone.trim());
    if (!hasNote && !hasPhone) return null;
    setSaving(true);
    const { data, error } = await supabase
      .from('user_private_shops')
      .insert({
        user_id: userId,
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
    if (!hasNote && !hasPhone) {
      router.back();
      return;
    }

    // ทุกครั้งที่กด "ສຳເລັດ" ให้สร้าง record ใหม่ในตารางเสมอ (กรอกโน้ตอย่างเดียว เบอร์อย่างเดียว หรือทั้งคู่ ก็บันทึกได้ — ส่วนที่ไม่กรอกเป็น null)
    const created = await handleSaveShop();
    if (!created) return;
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        'create_post_private_shop',
        JSON.stringify({
          id: created.id,
          shop_name: created.shop_name,
          shop_phone: created.shop_phone,
        }),
      );
    }
    router.back();
  };

  const handleConfirmDeleteShop = async () => {
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    if (!id || !userId) return;
    await supabase.from('user_private_shops').delete().eq('id', id).eq('user_id', userId);
    setShops((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
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

  if (!userId) {
    return (
      <div style={LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX}>
        <div
          style={{
            padding: '10px 15px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
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

  return (
    <div style={LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX}>
      <div
        style={{
          padding: '10px 15px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #f0f0f0',
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
            onChange={(e) => setShopName(e.target.value)}
            placeholder="ມີພຽງແຕ່ທ່ານເທົ່ານັ້ນທີ່ເຫັນໂນດນີ້"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #d0d0d0',
              fontSize: '14px',
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
                fontSize: '14px',
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
                  fontSize: '14px',
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
                  setShopPhone(digitsOnly);
                }}
                onKeyDown={(e) => {
                  const key = e.key;
                  if (key === 'Backspace' && shopPhone.length > 0) {
                    setShopPhone(shopPhone.slice(0, -1));
                    e.preventDefault();
                  } else if (key.length === 1 && /[0-9]/.test(key) && shopPhone.length < 8) {
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
                  fontSize: '14px',
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
                        setShopName(shop.shop_name ?? '');
                        const rawPhone = shop.shop_phone ?? '';
                        const tail = rawPhone.startsWith('85620') ? rawPhone.slice(5) : rawPhone.startsWith('020') ? rawPhone.slice(3) : rawPhone.replace(/\D/g, '');
                        setShopPhone(tail.slice(0, 8));
                        setShops((prev) => {
                          const idx = prev.findIndex((s) => s.id === shop.id);
                          if (idx <= 0) return prev;
                          const next = [...prev];
                          const [item] = next.splice(idx, 1);
                          next.unshift(item);
                          return next;
                        });
                        if (typeof window !== 'undefined') {
                          window.sessionStorage.setItem(
                            'create_post_private_shop',
                            JSON.stringify({
                              id: shop.id,
                              shop_name: shop.shop_name,
                              shop_phone: shop.shop_phone,
                            }),
                          );
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(shop.id);
                      }}
                      style={{
                        flexShrink: 0,
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '20px',
                        lineHeight: 1,
                        color: '#65676b',
                      }}
                      aria-label="ລົບລາຍການ"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

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
              ທ່ານຕ້ອງການລົບລາຍການອອກບໍ
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
    </div>
  );
}

