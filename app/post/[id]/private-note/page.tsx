'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

interface PrivateNoteData {
  shop_name: string;
  shop_phone: string;
}

export default function PostPrivateNotePage() {
  const router = useRouter();
  const params = useParams();
  const postId = (params?.id as string) || '';
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<PrivateNoteData | null>(null);
  const [notAllowed, setNotAllowed] = useState(false);

  useEffect(() => {
    async function load() {
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

      const { data: car, error: carErr } = await supabase
        .from('cars')
        .select('user_id, private_shop_id')
        .eq('id', postId)
        .maybeSingle();

      if (carErr || !car || car.user_id !== uid) {
        setNotAllowed(true);
        setLoading(false);
        return;
      }

      if (!car.private_shop_id) {
        setNote(null);
        setLoading(false);
        return;
      }

      const { data: shop, error: shopErr } = await supabase
        .from('user_private_shops')
        .select('shop_name, shop_phone')
        .eq('id', car.private_shop_id)
        .eq('user_id', uid)
        .maybeSingle();

      if (shopErr || !shop) {
        setNote(null);
      } else {
        setNote({
          shop_name: shop.shop_name,
          shop_phone: shop.shop_phone,
        });
      }

      setLoading(false);
    }

    void load();
  }, [postId]);

  const goBack = () => {
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

  if (notAllowed) {
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
            onClick={goBack}
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
          onClick={goBack}
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

      <div
        style={{
          flex: 1,
          padding: '16px',
          fontSize: '15px',
          color: '#111',
          display: 'flex',
          flexDirection: 'column',
          ...(note
            ? {}
            : {
                alignItems: 'center',
                justifyContent: 'center',
              }),
        }}
      >
        {note ? (
          <>
            <div style={{ marginBottom: '8px', fontWeight: 600 }}>ຮ້ານ:</div>
            <div style={{ marginBottom: '16px' }}>{note.shop_name}</div>
            <div style={{ marginBottom: '8px', fontWeight: 600 }}>ເບີໂທຮ້ານ:</div>
            <div>{note.shop_phone}</div>
          </>
        ) : (
          <div style={{ fontSize: '14px', color: '#4a4d52' }}>
            ບໍ່ມີໂນດສ່ວນຕົວສຳລັບໂພສນີ້
          </div>
        )}
      </div>
    </div>
  );
}

