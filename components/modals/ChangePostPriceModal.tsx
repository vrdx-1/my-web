'use client'

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { ButtonSpinner } from '@/components/LoadingSpinner';

type Currency = '₭' | '฿' | '$';

interface ChangePostPriceModalProps {
  isOpen: boolean;
  postId: string;
  price: number | string | null | undefined;
  currency: Currency | null | undefined;
  onClose: () => void;
  onSaved: (changes?: { price: number | null; price_currency: Currency }) => void;
}

function normalizePrice(value: number | string | null | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.max(0, Math.trunc(value)));
  if (typeof value === 'string') return value.replace(/\D/g, '');
  return '';
}

export const ChangePostPriceModal = React.memo<ChangePostPriceModalProps>(({
  isOpen,
  postId,
  price,
  currency,
  onClose,
  onSaved,
}) => {
  const currencyOptions = useMemo<Currency[]>(() => ['₭', '฿', '$'], []);
  const [carPrice, setCarPrice] = useState(() => normalizePrice(price));
  const [carCurrency, setCarCurrency] = useState<Currency>(currency === '฿' || currency === '$' ? currency : '₭');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setCarPrice(normalizePrice(price));
    setCarCurrency(currency === '฿' || currency === '$' ? currency : '₭');
    setIsSaving(false);
    setSaveError('');
  }, [currency, isOpen, price, postId]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const normalizedInitialPrice = normalizePrice(price);
  const normalizedInitialCurrency = currency === '฿' || currency === '$' ? currency : '₭';
  const hasChanges = carPrice !== normalizedInitialPrice || carCurrency !== normalizedInitialCurrency;

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const normalizedDigits = carPrice.replace(/\D/g, '');
      const nextPrice = normalizedDigits ? Number(normalizedDigits) : null;
      const { error } = await supabase
        .from('cars')
        .update({
          price: nextPrice && Number.isFinite(nextPrice) ? nextPrice : null,
          price_currency: carCurrency,
        })
        .eq('id', postId);

      if (error) throw error;

      window.dispatchEvent(new CustomEvent('post:updated', { detail: { postId } }));
      onClose();
      onSaved({
        price: nextPrice && Number.isFinite(nextPrice) ? nextPrice : null,
        price_currency: carCurrency,
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'ບໍ່ສາມາດປ່ຽນລາຄາໄດ້');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
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
          maxWidth: '340px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center', color: '#111111' }}>
          ປ່ຽນລາຄາ
        </h3>

        {saveError ? (
          <div style={{ color: '#d93025', fontSize: '13px', marginBottom: '12px', lineHeight: 1.4 }}>
            {saveError}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            padding: '10px 12px',
            borderRadius: '14px',
            border: '1px solid #d0d7de',
            background: '#ffffff',
            marginBottom: '16px',
          }}
        >
          <input
            type="text"
            inputMode="numeric"
            value={carPrice ? Number(carPrice).toLocaleString('en-US') : ''}
            onChange={(e) => {
              setSaveError('');
              const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
              setCarPrice(digitsOnly);
            }}
            placeholder="ໃສ່ລາຄາ"
            style={{
              minWidth: '160px',
              width: 'clamp(160px, 44vw, 240px)',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '18px',
              lineHeight: '24px',
              fontWeight: 700,
              color: '#111111',
              padding: '2px 0',
            }}
          />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {currencyOptions.map((option) => {
              const isActive = carCurrency === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setSaveError('');
                    setCarCurrency(option);
                  }}
                  style={{
                    border: 'none',
                    borderRadius: '999px',
                    minWidth: '38px',
                    minHeight: '38px',
                    padding: '8px 12px',
                    background: isActive ? '#1877f2' : '#ffffff',
                    color: isActive ? '#ffffff' : '#4a4d52',
                    fontSize: '16px',
                    lineHeight: '18px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: isActive ? 'none' : 'inset 0 0 0 1px #d0d7de',
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#e4e6eb',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#1c1e21',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            ຍົກເລີກ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: hasChanges ? '#1877f2' : '#b0b3b8',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#fff',
              cursor: !hasChanges || isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <ButtonSpinner />
              </span>
            ) : 'ບັນທຶກ'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

ChangePostPriceModal.displayName = 'ChangePostPriceModal';