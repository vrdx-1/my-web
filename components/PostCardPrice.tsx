'use client'

import React from 'react';
import { createPortal } from 'react-dom';
import { mergeHeaders } from '@/utils/activeProfile';

interface PostCardPriceProps {
  post: any;
  priceValue: number | null;
  currencySymbol: string;
  priceText: string;
  isOwner: boolean;
  onPriceClick?: (post: any) => void;
  showPriceEstimatePopup: boolean;
  setShowPriceEstimatePopup: (show: boolean) => void;
  estimatedLines: Array<{ symbol: string; amount: string }>;
  onSetShowChangePriceModal: () => void;
  activeProfileId: string;
  session: any;
}

export function PostCardPrice({
  post,
  priceValue,
  currencySymbol: _currencySymbol,
  priceText,
  isOwner,
  onPriceClick,
  showPriceEstimatePopup,
  setShowPriceEstimatePopup,
  estimatedLines,
  onSetShowChangePriceModal,
  activeProfileId,
  session,
}: PostCardPriceProps) {
  const priceEstimatePopupRef = React.useRef<HTMLDivElement | null>(null);
  const [priceEstimatePopupPosition, setPriceEstimatePopupPosition] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const priceChipBackground = showPriceEstimatePopup ? '#ffffff' : 'transparent';
  const priceChipBoxShadow = showPriceEstimatePopup ? '0 12px 24px rgba(15, 23, 42, 0.08)' : 'none';
  const priceChipBorder = '1px solid #d1d5db';

  React.useEffect(() => {
    if (!showPriceEstimatePopup || typeof window === 'undefined') return;

    const handleScrollClose = () => {
      setShowPriceEstimatePopup(false);
    };

    window.addEventListener('scroll', handleScrollClose, { passive: true });
    window.addEventListener('touchmove', handleScrollClose, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollClose);
      window.removeEventListener('touchmove', handleScrollClose);
    };
  }, [showPriceEstimatePopup, setShowPriceEstimatePopup]);

  React.useEffect(() => {
    if (!showPriceEstimatePopup) {
      setPriceEstimatePopupPosition(null);
      return;
    }

    const updatePopupPosition = () => {
      const anchor = priceEstimatePopupRef.current;
      if (!anchor || typeof window === 'undefined') return;

      const rect = anchor.getBoundingClientRect();
      const popupWidth = 250;
      const horizontalMargin = 12;
      const maxLeft = Math.max(horizontalMargin, window.innerWidth - popupWidth - horizontalMargin);

      setPriceEstimatePopupPosition({
        top: rect.bottom + 8,
        left: Math.min(Math.max(rect.left, horizontalMargin), maxLeft),
      });
    };

    updatePopupPosition();
    window.addEventListener('resize', updatePopupPosition, { passive: true });

    return () => {
      window.removeEventListener('resize', updatePopupPosition);
    };
  }, [showPriceEstimatePopup]);

  return (
    <>
      <div
        ref={priceEstimatePopupRef}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          minWidth: 0,
          maxWidth: '100%',
          zIndex: showPriceEstimatePopup ? 1001 : 1,
        }}
      >
        {isOwner || onPriceClick ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onPriceClick) {
                onPriceClick(post);
                return;
              }
              onSetShowChangePriceModal();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: priceChipBackground,
              appearance: 'none',
              WebkitAppearance: 'none',
              padding: '8px 16px',
              minHeight: '34px',
              borderRadius: '12px',
              color: '#1c1e21',
              border: priceChipBorder,
              boxSizing: 'border-box',
              boxShadow: priceChipBoxShadow,
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              minWidth: 0,
              maxWidth: '100%',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                color: '#1c1e21',
                fontSize: '16px',
                lineHeight: '21px',
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {priceText}
            </span>
          </button>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: priceChipBackground,
              padding: '8px 16px',
              minHeight: '34px',
              borderRadius: '12px',
              color: '#1c1e21',
              border: priceChipBorder,
              boxSizing: 'border-box',
              boxShadow: priceChipBoxShadow,
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              minWidth: 0,
              maxWidth: '100%',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                color: '#1c1e21',
                fontSize: '16px',
                lineHeight: '21px',
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {priceText}
            </span>
          </span>
        )}

        <button
          type="button"
          aria-label="ສະແດງອັດຕາແລກປ່ຽນໂດຍປະມານ"
          onClick={(e) => {
            e.stopPropagation();
            if (!priceValue || priceValue <= 0) return;
            setShowPriceEstimatePopup((prev) => {
              if (!prev) {
                void fetch('/api/analytics/exchange-rate-popup-click', {
                  method: 'POST',
                  headers: mergeHeaders(
                    {
                      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                    },
                    activeProfileId,
                  ),
                  credentials: 'include',
                  keepalive: true,
                }).catch(() => {});
              }
              return !prev;
            });
          }}
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '10px',
            border: 'none',
            background: 'transparent',
            color: '#6b7280',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: priceValue && priceValue > 0 ? 'pointer' : 'not-allowed',
            opacity: priceValue && priceValue > 0 ? 1 : 0.6,
            padding: 0,
          }}
        >
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {showPriceEstimatePopup && priceValue && priceValue > 0 && priceEstimatePopupPosition && typeof document !== 'undefined' && createPortal(
        <>
          <div
            aria-hidden="true"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onTouchMove={(e) => {
              e.stopPropagation();
              setShowPriceEstimatePopup(false);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowPriceEstimatePopup(false);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 999,
            }}
          />
          <div
            data-price-estimate-popup="true"
            style={{
              position: 'fixed',
              top: priceEstimatePopupPosition.top,
              left: priceEstimatePopupPosition.left,
              minWidth: '250px',
              background: '#fff',
              border: 'none',
              borderRadius: '16px',
              boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
              padding: '16px 18px',
              zIndex: 1002,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ fontSize: '20px', lineHeight: '26px', fontWeight: 700, color: '#C2410C' }}>
              ອັດຕາແລກປ່ຽນໂດຍປະມານ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {estimatedLines.map((line) => (
                <div
                  key={line.symbol}
                  style={{
                    fontSize: '16px',
                    lineHeight: '21px',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  {line.amount === '-' ? line.amount : `${line.amount} ${line.symbol}`}
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
