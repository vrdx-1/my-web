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
                      opacity: 1,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    title="ເປີດ WhatsApp"
                    aria-label="ເປີດ WhatsApp"
                  >
                    <svg viewBox="0 0 24 24" width={28} height={28} fill="currentColor" aria-hidden>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                </div>
              ) : null}
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
