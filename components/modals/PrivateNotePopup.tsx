'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

interface PrivateNoteData {
  shop_name: string;
  shop_phone: string;
}

interface PrivateNotePopupProps {
  show: boolean;
  postId: string;
  session: any;
  onClose: () => void;
}

export const PrivateNotePopup = React.memo<PrivateNotePopupProps>(
  ({ show, postId, session, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [note, setNote] = useState<PrivateNoteData | null>(null);

    useEffect(() => {
      if (!show || !postId) return;
      const uid = session?.user?.id ?? null;
      if (!uid) {
        setNote(null);
        setLoading(false);
        return;
      }

      let cancelled = false;
      setLoading(true);

      (async () => {
        const { data: car, error: carErr } = await supabase
          .from('cars')
          .select('user_id, private_shop_id')
          .eq('id', postId)
          .maybeSingle();

        if (cancelled || carErr || !car || car.user_id !== uid) {
          if (!cancelled) {
            setNote(null);
            setLoading(false);
          }
          return;
        }

        if (!car.private_shop_id) {
          if (!cancelled) {
            setNote(null);
            setLoading(false);
          }
          return;
        }

        const { data: shop, error: shopErr } = await supabase
          .from('user_private_shops')
          .select('shop_name, shop_phone')
          .eq('id', car.private_shop_id)
          .eq('user_id', uid)
          .maybeSingle();

        if (cancelled) return;
        if (shopErr || !shop) {
          setNote(null);
        } else {
          setNote({
            shop_name: shop.shop_name,
            shop_phone: shop.shop_phone,
          });
        }
        setLoading(false);
      })();

      return () => {
        cancelled = true;
      };
    }, [show, postId, session?.user?.id]);

    if (!show) return null;

    const content = (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 6000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '320px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              margin: 0,
              textAlign: 'center',
              color: '#111111',
            }}
          >
            ໂນດສ່ວນຕົວ
          </h3>

          {loading ? (
            <div style={{ fontSize: '14px', color: '#4a4d52' }}>ກຳລັງໂຫລດ...</div>
          ) : note ? (
            <div
              style={{
                width: '100%',
                fontSize: '15px',
                color: '#111',
                textAlign: 'left',
              }}
            >
              <div style={{ marginBottom: '8px', fontWeight: 600 }}>ຮ້ານ:</div>
              <div style={{ marginBottom: '12px' }}>{note.shop_name}</div>
              <div style={{ marginBottom: '8px', fontWeight: 600 }}>ເບີໂທຮ້ານ:</div>
              <div>{note.shop_phone}</div>
            </div>
          ) : (
            <div style={{ fontSize: '14px', color: '#4a4d52', textAlign: 'center' }}>
              ບໍ່ມີໂນດສ່ວນຕົວສຳລັບໂພສນີ້
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
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
            ຕົກລົງ
          </button>
        </div>
      </div>
    );

    if (typeof document !== 'undefined' && document.body) {
      return createPortal(content, document.body);
    }
    return content;
  }
);

PrivateNotePopup.displayName = 'PrivateNotePopup';
