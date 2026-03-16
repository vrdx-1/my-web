'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

interface PrivateShop {
  id: string;
  shop_name: string;
  shop_phone: string;
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

      if (typeof window !== 'undefined') {
        const raw = window.sessionStorage.getItem('create_post_private_shop');
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { id: string };
            setSelectedId(parsed.id);
          } catch {
            // ignore
          }
        }
      }

      setLoading(false);
    }

    void init();
  }, []);

  const handleSaveShop = async () => {
    if (!userId) return;
    if (!shopName.trim() || !shopPhone.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('user_private_shops')
      .insert({
        user_id: userId,
        shop_name: shopName.trim(),
        shop_phone: shopPhone.trim(),
      })
      .select()
      .maybeSingle();

    setSaving(false);
    if (error || !data) return;

    setShops((prev) => [data as PrivateShop, ...prev]);
    setShopName('');
    setShopPhone('');
  };

  const handleApplyAndBack = () => {
    if (!selectedId) {
      router.back();
      return;
    }
    const selected = shops.find((s) => s.id === selectedId);
    if (typeof window !== 'undefined' && selected) {
      window.sessionStorage.setItem(
        'create_post_private_shop',
        JSON.stringify({
          id: selected.id,
          shop_name: selected.shop_name,
          shop_phone: selected.shop_phone,
        }),
      );
    }
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
          ບັນທຶກ
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 15px 90px' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>ຊື່ຮ້ານ</div>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="ຊື່ຮ້ານ..."
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #d0d0d0',
              fontSize: '14px',
              marginBottom: '10px',
            }}
          />
          <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
            ເບີໂທຮ້ານ
          </div>
          <input
            type="tel"
            value={shopPhone}
            onChange={(e) => setShopPhone(e.target.value)}
            placeholder="020..."
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #d0d0d0',
              fontSize: '14px',
            }}
          />
          <button
            type="button"
            disabled={saving || !shopName.trim() || !shopPhone.trim()}
            onClick={handleSaveShop}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '20px',
              border: 'none',
              background: saving ? '#a0bff5' : '#1877f2',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກຮ້ານໃໝ່'}
          </button>
        </div>

        <div>
          <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
            ຮ້ານຂອງທ່ານ
          </div>
          {shops.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#888' }}>
              ຍັງບໍ່ມີຮ້ານທີ່ບັນທຶກໄວ້. ກະລຸນາພິມຂ້າງເທິງແລ້ວກົດບັນທຶກ.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {shops.map((shop) => {
                const isSelected = shop.id === selectedId;
                return (
                  <button
                    key={shop.id}
                    type="button"
                    onClick={() => setSelectedId(shop.id)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #1877f2' : '1px solid #e0e0e0',
                      background: isSelected ? '#eef3ff' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        marginBottom: '2px',
                      }}
                    >
                      {shop.shop_name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#4a4d52' }}>
                      {shop.shop_phone}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

