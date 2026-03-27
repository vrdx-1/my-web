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
            <div style={{ marginBottom: note.shop_phone ? '12px' : 0 }}>{note.shop_name}</div>
            {note.shop_phone ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>
                {note.shop_phone.startsWith('85620') && note.shop_phone.length === 13
                  ? `020${note.shop_phone.slice(5)}`
                  : note.shop_phone}
              </span>
                <a
                  href={`https://wa.me/${note.shop_phone.replace(/\D/g, '').replace(/^0/, '856')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    margin: '-8px',
                    color: '#25D366',
                    textDecoration: 'none',
                    minWidth: 44,
                    minHeight: 44,
                  }}
                  title="ເປີດ WhatsApp"
                  aria-label="ເປີດ WhatsApp"
                >
                  <svg viewBox="0 0 24 24" width={28} height={28} fill="currentColor" aria-hidden>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
              </div>
            ) : null}
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

