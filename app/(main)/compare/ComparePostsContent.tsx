'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useComparePosts } from '@/contexts/ComparePostsContext';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { mergeHeaders } from '@/utils/activeProfile';
import {
  DEFAULT_EXCHANGE_RATES,
  getApproxPriceValue,
  toEstimatedPrices,
  type ExchangeRates,
} from '@/utils/exchangeRates';
import { CompactPhotoGrid } from '@/components/compare/CompactPhotoGrid';
import { CompareIcon } from '@/components/icons/CompareIcon';
import { SuccessPopup } from '@/components/modals/SuccessPopup';

let ratesCache: ExchangeRates | null = null;
let ratesLoadedAt = 0;
let ratesInFlight: Promise<ExchangeRates> | null = null;

async function getLatestExchangeRates(): Promise<ExchangeRates> {
  const now = Date.now();
  if (ratesCache && now - ratesLoadedAt < 5_000) {
    return ratesCache;
  }

  if (ratesInFlight) {
    return ratesInFlight;
  }

  ratesInFlight = (async () => {
    const response = await fetch('/api/exchange-rates/latest', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });

    const json = await response.json().catch(() => ({}));
    const nextRates = (json as { rates?: ExchangeRates }).rates ?? DEFAULT_EXCHANGE_RATES;
    ratesCache = nextRates;
    ratesLoadedAt = Date.now();
    return nextRates;
  })().finally(() => {
    ratesInFlight = null;
  });

  return ratesInFlight;
}

function ComparePageHeader({
  count,
  onClearAll,
}: {
  count: number;
  onClearAll: () => void;
}) {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; right: number } | null>(null);
  const isDisabled = count === 0;
  const menuTextColor = isDisabled ? '#9ca3af' : '#000000';
  const menuIconColor = isDisabled ? '#9ca3af' : '#4a4d52';

  React.useEffect(() => {
    if (!isMenuOpen || typeof window === 'undefined') return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition, { passive: true });
    window.addEventListener('scroll', () => setIsMenuOpen(false), { passive: true });

    return () => {
      window.removeEventListener('resize', updatePosition);
    };
  }, [isMenuOpen]);

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          zIndex: 90,
          background: '#ffffff',
          borderBottom: '1px solid #eef2f7',
        }}
      >
        <div
          style={{
            height: 64,
            padding: '0 16px',
            display: 'grid',
            gridTemplateColumns: '44px 1fr 44px',
            alignItems: 'center',
          }}
        >
          <div aria-hidden="true" />
          <h1
            style={{
              margin: 0,
              textAlign: 'center',
              fontSize: 19,
              lineHeight: '24px',
              fontWeight: 800,
              color: '#111827',
            }}
          >
            ລາຍການປຽບທຽບ
          </h1>
          <button
            ref={buttonRef}
            type="button"
            aria-label="ເປີດເມນູລາຍການປຽບທຽບ"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            style={{
              width: 40,
              height: 40,
              justifySelf: 'end',
              border: 'none',
              background: 'transparent',
              color: '#4b5563',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="2.1" />
              <circle cx="12" cy="12" r="2.1" />
              <circle cx="19" cy="12" r="2.1" />
            </svg>
          </button>
        </div>
      </header>

      {isMenuOpen && position && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 2200 }}>
          <div
            onClick={() => setIsMenuOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.18)' }}
          />
          <div
            style={{
              position: 'absolute',
              top: position.top,
              right: position.right,
              width: 240,
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onClearAll();
              }}
              disabled={isDisabled}
              style={{
                width: '100%',
                border: 'none',
                background: '#ffffff',
                textAlign: 'left',
                padding: '14px 18px',
                fontSize: 17,
                fontWeight: 'normal',
                color: menuTextColor,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                minHeight: 50,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                lineHeight: '24px',
                fontFamily: 'inherit',
                opacity: 1,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: menuIconColor,
                  flexShrink: 0,
                  opacity: 1,
                }}
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: 'block' }}
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </span>
              <span>ລົບລາຍການທັງໝົດ</span>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function ComparePostRow({
  post,
  exchangeRates,
  activeProfileId,
  sessionAccessToken,
  onRemove,
}: {
  post: any;
  exchangeRates: ExchangeRates;
  activeProfileId: string | null;
  sessionAccessToken?: string;
  onRemove: () => void;
}) {
  const router = useRouter();
  const [isCaptionExpanded, setIsCaptionExpanded] = React.useState(false);
  const [showPricePopup, setShowPricePopup] = React.useState(false);
  const [popupPosition, setPopupPosition] = React.useState<{ top: number; left: number } | null>(null);
  const popupAnchorRef = React.useRef<HTMLDivElement | null>(null);

  const normalizedCaption = React.useMemo(() => {
    const rawCaption = typeof post.caption === 'string' ? post.caption : '';
    return rawCaption.replace(/\s+$/u, '');
  }, [post.caption]);

  const priceValue = React.useMemo(() => {
    const rawPrice = post.price;
    if (typeof rawPrice === 'number' && Number.isFinite(rawPrice)) return rawPrice;
    if (typeof rawPrice === 'string') {
      const digitsOnly = rawPrice.replace(/\D/g, '');
      if (!digitsOnly) return null;
      const parsed = Number(digitsOnly);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }, [post.price]);

  const currencySymbol = post.price_currency === '฿' || post.price_currency === '$'
    ? post.price_currency
    : '₭';
  const priceText = priceValue && priceValue > 0
    ? `${priceValue.toLocaleString('en-US')} ${currencySymbol}`
    : 'ບໍ່ລະບຸລາຄາ';

  const estimatedPrices = React.useMemo(() => {
    const approxLak = getApproxPriceValue(post, '₭');
    const approxThb = getApproxPriceValue(post, '฿');
    const approxUsd = getApproxPriceValue(post, '$');

    if (approxLak != null || approxThb != null || approxUsd != null) {
      return {
        approx_price_lak: approxLak,
        approx_price_thb: approxThb,
        approx_price_usd: approxUsd,
      };
    }

    return toEstimatedPrices(post.price, currencySymbol, exchangeRates);
  }, [currencySymbol, exchangeRates, post]);

  const estimateCurrencies = React.useMemo(() => {
    if (currencySymbol === '$') return ['₭', '฿'] as const;
    if (currencySymbol === '฿') return ['₭', '$'] as const;
    return ['$', '฿'] as const;
  }, [currencySymbol]);

  const estimatedLines = React.useMemo(() => {
    const map: Record<'₭' | '฿' | '$', number | null> = {
      '₭': estimatedPrices.approx_price_lak,
      '฿': estimatedPrices.approx_price_thb,
      '$': estimatedPrices.approx_price_usd,
    };

    return estimateCurrencies.map((symbol) => {
      const value = map[symbol];
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return { symbol, amount: '-' };
      }

      return {
        symbol,
        amount: value.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
      };
    });
  }, [estimateCurrencies, estimatedPrices.approx_price_lak, estimatedPrices.approx_price_thb, estimatedPrices.approx_price_usd]);

  React.useEffect(() => {
    if (!showPricePopup || typeof window === 'undefined') return;

    const updatePopupPosition = () => {
      const rect = popupAnchorRef.current?.getBoundingClientRect();
      if (!rect) {
        setPopupPosition(null);
        return;
      }

      const popupWidth = 250;
      const horizontalMargin = 12;
      const maxLeft = Math.max(horizontalMargin, window.innerWidth - popupWidth - horizontalMargin);

      setPopupPosition({
        top: rect.bottom + 8,
        left: Math.min(Math.max(rect.left, horizontalMargin), maxLeft),
      });
    };

    const closePopup = () => setShowPricePopup(false);

    updatePopupPosition();
    window.addEventListener('resize', updatePopupPosition, { passive: true });
    window.addEventListener('scroll', closePopup, { passive: true });
    window.addEventListener('touchmove', closePopup, { passive: true });

    return () => {
      window.removeEventListener('resize', updatePopupPosition);
      window.removeEventListener('scroll', closePopup);
      window.removeEventListener('touchmove', closePopup);
    };
  }, [showPricePopup]);

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 24,
        border: '1px solid #e7edf5',
        boxShadow: '0 14px 28px rgba(15, 23, 42, 0.06)',
        padding: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        <CompactPhotoGrid
          images={post.images || []}
          size={98}
          layout={post.layout || 'default'}
          onClick={() => router.push(`/post/${post.id}`)}
        />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div
              ref={popupAnchorRef}
              style={{
                minWidth: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 36,
                  borderRadius: 12,
                  border: '1px solid #d1d5db',
                  background: showPricePopup ? '#ffffff' : 'transparent',
                  boxShadow: showPricePopup ? '0 12px 24px rgba(15, 23, 42, 0.08)' : 'none',
                  padding: '8px 14px',
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    lineHeight: '21px',
                    fontWeight: 700,
                    color: '#111827',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {priceText}
                </span>
              </div>

              <button
                type="button"
                aria-label="ສະແດງອັດຕາແລກປ່ຽນໂດຍປະມານ"
                onClick={() => {
                  if (!priceValue || priceValue <= 0) return;
                  setShowPricePopup((prev) => {
                    if (!prev) {
                      void fetch('/api/analytics/exchange-rate-popup-click', {
                        method: 'POST',
                        headers: mergeHeaders(
                          {
                            ...(sessionAccessToken ? { Authorization: `Bearer ${sessionAccessToken}` } : {}),
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
                  width: 30,
                  height: 30,
                  borderRadius: 10,
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
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true">
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <button
              type="button"
              aria-label="ລົບອອກຈາກລາຍການປຽບທຽບ"
              onClick={onRemove}
              style={{
                width: 28,
                height: 28,
                flexShrink: 0,
                border: 'none',
                background: 'transparent',
                color: '#374151',
                fontSize: 30,
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              ×
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCaptionExpanded((prev) => !prev)}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              padding: 0,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              textAlign: 'left',
              color: '#111827',
              cursor: normalizedCaption ? 'pointer' : 'default',
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 14,
                lineHeight: '20px',
                fontWeight: 500,
                display: '-webkit-box',
                WebkitLineClamp: isCaptionExpanded ? 'unset' : 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                color: normalizedCaption ? '#111827' : '#9ca3af',
              }}
            >
              {normalizedCaption || 'ບໍ່ມີ caption'}
            </span>
            <span
              aria-hidden="true"
              style={{
                width: 24,
                height: 24,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                transform: isCaptionExpanded ? 'translateY(24px) rotate(180deg)' : 'translateY(24px) rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </div>
      </div>

      {showPricePopup && popupPosition && priceValue && priceValue > 0 && typeof document !== 'undefined' && createPortal(
        <>
          <div
            onClick={() => setShowPricePopup(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              background: 'rgba(0, 0, 0, 0.3)',
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: popupPosition.top,
              left: popupPosition.left,
              minWidth: 250,
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
              padding: '16px 18px',
              zIndex: 1202,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 20, lineHeight: '26px', fontWeight: 700, color: '#C2410C' }}>
              ອັດຕາແລກປ່ຽນໂດຍປະມານ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {estimatedLines.map((line) => (
                <div
                  key={line.symbol}
                  style={{
                    fontSize: 16,
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
        document.body,
      )}
    </div>
  );
}

export function ComparePostsContent() {
  const { postIds, count, loaded, clearAll, removePost, markAllViewed } = useComparePosts();
  const { session, activeProfileId } = useSessionAndProfile();
  const pathname = usePathname();
  const [posts, setPosts] = React.useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = React.useState(false);
  const [exchangeRates, setExchangeRates] = React.useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);
  const [showClearAllSuccess, setShowClearAllSuccess] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    getLatestExchangeRates()
      .then((rates) => {
        if (!active) return;
        setExchangeRates(rates);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!loaded || pathname !== '/compare') return;
    void markAllViewed();
  }, [loaded, markAllViewed, pathname, postIds]);

  React.useEffect(() => {
    if (!loaded) return;

    if (postIds.length === 0) {
      setPosts([]);
      setLoadingPosts(false);
      return;
    }

    let active = true;
    setLoadingPosts(true);

    void supabase
      .from('cars')
      .select('*, profiles!cars_user_id_fkey(*)')
      .in('id', postIds)
      .then(({ data, error }) => {
        if (!active) return;

        if (error || !data) {
          setPosts([]);
          setLoadingPosts(false);
          return;
        }

        const order = new Map(postIds.map((postId, index) => [postId, index]));
        const nextPosts = [...data].sort((left, right) => {
          const leftOrder = order.get(String(left.id)) ?? Number.MAX_SAFE_INTEGER;
          const rightOrder = order.get(String(right.id)) ?? Number.MAX_SAFE_INTEGER;
          return leftOrder - rightOrder;
        });

        setPosts(nextPosts);
        setLoadingPosts(false);
      });

    return () => {
      active = false;
    };
  }, [loaded, postIds]);

  const showEmpty = loaded && !loadingPosts && postIds.length === 0;
  const showLoadingSkeleton = !loaded || (loadingPosts && posts.length === 0);

  return (
    <main style={{ minHeight: '100vh', background: '#f7f9fc' }}>
      <ComparePageHeader
        count={count}
        onClearAll={() => {
          if (count === 0) return;
          void clearAll().then(() => {
            setShowClearAllSuccess(true);
          });
        }}
      />

      <div style={{ height: 64 }} aria-hidden />

      <div style={{ padding: '14px 12px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {showLoadingSkeleton ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              style={{
                height: 122,
                borderRadius: 24,
                background: 'linear-gradient(90deg, #eef2f7 25%, #f7f9fc 50%, #eef2f7 75%)',
                backgroundSize: '200% 100%',
                animation: 'photo-grid-shimmer 1.5s ease-in-out infinite',
                border: '1px solid #e7edf5',
              }}
            />
          ))
        ) : null}

        {showEmpty ? (
          <div
            style={{
              marginTop: 28,
              background: '#ffffff',
              borderRadius: 28,
              padding: '28px 20px',
              border: '1px solid #e7edf5',
              boxShadow: '0 14px 28px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: '#eef4fb',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1877f2',
              }}
            >
              <CompareIcon size={32} color="currentColor" />
            </div>
            <div style={{ fontSize: 18, lineHeight: '24px', fontWeight: 700, color: '#6b7280' }}>
              ຍັງບໍ່ມີລາຍການປຽບທຽບ
            </div>
          </div>
        ) : null}

        {posts.map((post) => (
          <ComparePostRow
            key={post.id}
            post={post}
            exchangeRates={exchangeRates}
            activeProfileId={activeProfileId}
            sessionAccessToken={session?.access_token}
            onRemove={() => {
              const nextPostId = String(post.id);
              setPosts((prev) => prev.filter((item) => String(item.id) !== nextPostId));
              void removePost(nextPostId);
            }}
          />
        ))}
      </div>

      {showClearAllSuccess && (
        <SuccessPopup
          message="ລົບສຳເລັດ"
          onClose={() => setShowClearAllSuccess(false)}
        />
      )}
    </main>
  );
}