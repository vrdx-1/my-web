'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_EXCHANGE_RATES,
  getApproxPriceValue,
  toEstimatedPrices,
  type ExchangeRates,
} from '@/utils/exchangeRates';
import { PostCardMenu } from '@/components/PostCardMenu';
import { CompactPhotoGrid } from '@/components/compare/CompactPhotoGrid';
import { CompactFeedSkeleton } from '@/components/compare/CompactFeedSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { FeedWithPreload } from '@/components/FeedWithPreload';
import { SuccessPopup } from '@/components/modals/SuccessPopup';
import { ChangePostPriceModal } from '@/components/modals/ChangePostPriceModal';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { isPostOwner } from '@/utils/postUtils';

interface SavedCompactFeedBlockProps {
  showSkeleton: boolean;
  skeletonCount: number;
  posts: any[];
  session: any;
  activeMenuState: string | null;
  isMenuAnimating: boolean;
  menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
  onShare: (post: any) => void;
  onDeletePost: (postId: string) => void;
  onReport: (post: any) => void;
  onRepost?: (postId: string) => void | Promise<void>;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
  hideBoost?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  lastPostElementRef?: (node: HTMLElement | null) => void;
  onRemoveSave: (postId: string) => void;
  onLocalUpdate?: (postId: string, data: Record<string, unknown>) => void;
}

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

function SavedCompactPostRow({
  post,
  exchangeRates,
  session,
  activeProfileId,
  authUserId,
  availableProfiles,
  activeMenuState,
  isMenuAnimating,
  menuButtonRefs,
  onRemoveSave,
  onShare,
  onDeletePost,
  onReport,
  onRepost,
  onSetActiveMenu,
  onSetMenuAnimating,
  hideBoost,
  onLocalUpdate,
}: {
  post: any;
  exchangeRates: ExchangeRates;
  session: any;
  activeProfileId?: string | null;
  authUserId?: string | null;
  availableProfiles?: any[];
  activeMenuState: string | null;
  isMenuAnimating: boolean;
  menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
  onRemoveSave: (postId: string) => void;
  onShare: (post: any) => void;
  onDeletePost: (postId: string) => void;
  onReport: (post: any) => void;
  onRepost?: (postId: string) => void | Promise<void>;
  onSetActiveMenu: (postId: string | null) => void;
  onSetMenuAnimating: (animating: boolean) => void;
  hideBoost?: boolean;
  onLocalUpdate?: (postId: string, data: Record<string, unknown>) => void;
}) {
  const router = useRouter();
  const isOwner = React.useMemo(
    () => isPostOwner(post, session, activeProfileId, authUserId, availableProfiles ?? []),
    [activeProfileId, authUserId, availableProfiles, post, session],
  );
  const [isCaptionExpanded, setIsCaptionExpanded] = React.useState(false);
  const [showPricePopup, setShowPricePopup] = React.useState(false);
  const [showChangePriceModal, setShowChangePriceModal] = React.useState(false);
  const [showChangePriceSuccess, setShowChangePriceSuccess] = React.useState(false);
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

      const popupWidth = 220;
      const horizontalMargin = 8;
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
              {isOwner ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChangePriceModal(true);
                  }}
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
                    cursor: 'pointer',
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
                </button>
              ) : (
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
              )}

              <button
                type="button"
                aria-label="ສະແດງອັດຕາແລກປ່ຽນໂດຍປະມານ"
                onClick={() => {
                  if (!priceValue || priceValue <= 0) return;
                  setShowPricePopup((prev) => !prev);
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

            <div style={{ marginTop: '-2px' }}>
              <PostCardMenu
                post={post}
                session={session}
                activeProfileId={activeProfileId}
                isOwner={isOwner}
                hideBoost={hideBoost ?? false}
                activeMenuState={activeMenuState}
                isMenuAnimating={isMenuAnimating}
                menuButtonRefs={menuButtonRefs}
                onSave={onRemoveSave}
                saveLabel="ຍົກເລີກບັນທຶກ"
                onShare={onShare}
                onDeletePost={onDeletePost}
                onReport={onReport}
                onRepost={onRepost}
                onSetActiveMenu={onSetActiveMenu}
                onSetMenuAnimating={onSetMenuAnimating}
              />
            </div>
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
              width: 220,
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
              padding: '12px 14px',
              zIndex: 1202,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 16, lineHeight: '21px', fontWeight: 700, color: '#C2410C' }}>
              ອັດຕາແລກປ່ຽນໂດຍປະມານ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {estimatedLines.map((line) => (
                <div
                  key={line.symbol}
                  style={{
                    fontSize: 14,
                    lineHeight: '18px',
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

      <ChangePostPriceModal
        isOpen={showChangePriceModal}
        postId={post.id}
        price={post.price}
        currency={post.price_currency}
        onClose={() => setShowChangePriceModal(false)}
        onSaved={(changes) => {
          if (changes && onLocalUpdate) {
            onLocalUpdate(post.id, changes);
          }
          setShowChangePriceSuccess(true);
        }}
      />

      {showChangePriceSuccess && (
        <SuccessPopup
          message="ປ່ຽນລາຄາສຳເລັດ"
          onClose={() => setShowChangePriceSuccess(false)}
        />
      )}
    </div>
  );
}

export function SavedCompactFeedBlock({
  showSkeleton,
  skeletonCount,
  posts,
  session,
  activeMenuState,
  isMenuAnimating,
  menuButtonRefs,
  onShare,
  onDeletePost,
  onReport,
  onRepost,
  onSetActiveMenu,
  onSetMenuAnimating,
  hideBoost = false,
  loadingMore = false,
  hasMore = true,
  lastPostElementRef,
  onRemoveSave,
  onLocalUpdate,
}: SavedCompactFeedBlockProps) {
  const { activeProfileId, authUserId, availableProfiles } = useSessionAndProfile();
  const [exchangeRates, setExchangeRates] = React.useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);

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

  if (showSkeleton) {
    return (
      <FeedWithPreload showSkeleton={false} skeletonCount={skeletonCount}>
        <CompactFeedSkeleton count={skeletonCount} />
      </FeedWithPreload>
    );
  }

  if (posts.length === 0) {
    return (
      <FeedWithPreload showSkeleton={false} skeletonCount={skeletonCount}>
        {loadingMore ? null : <EmptyState message="ຍັງບໍ່ມີລາຍການ" variant="default" />}
      </FeedWithPreload>
    );
  }

  const showNoMoreOnly = !hasMore && !loadingMore;
  const bottomSlot = (
    <div
      key="compact-feed-bottom-slot"
      style={{
        minHeight: showNoMoreOnly ? 120 : loadingMore ? undefined : 88,
        height: showNoMoreOnly ? 120 : loadingMore ? undefined : 88,
        display: 'flex',
        alignItems: 'center',
        justifyContent: showNoMoreOnly ? 'flex-start' : 'center',
        paddingTop: showNoMoreOnly ? 28 : 0,
        flexShrink: 0,
        width: '100%',
        boxSizing: 'border-box',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {loadingMore ? <CompactFeedSkeleton count={1} withOuterPadding={false} /> : null}
      <span
        style={{
          fontSize: '13px',
          color: '#111111',
          visibility: showNoMoreOnly ? 'visible' : 'hidden',
          display: showNoMoreOnly ? 'block' : 'none',
          width: '100%',
          textAlign: 'center',
        }}
      >
        ບໍ່ມີລາຍການເພີ່ມເຕີມ
      </span>
    </div>
  );

  return (
    <FeedWithPreload showSkeleton={false} skeletonCount={skeletonCount}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 12px 0' }}>
        {posts.map((post, index) => {
          const postId = String(post.id);
          return (
            <div
              key={`${postId}-${index}`}
              ref={index === posts.length - 1 ? lastPostElementRef : undefined}
            >
              <SavedCompactPostRow
                post={post}
                exchangeRates={exchangeRates}
                session={session}
                activeProfileId={activeProfileId}
                authUserId={authUserId}
                availableProfiles={availableProfiles}
                activeMenuState={activeMenuState}
                isMenuAnimating={isMenuAnimating}
                menuButtonRefs={menuButtonRefs}
                onRemoveSave={onRemoveSave}
                onShare={onShare}
                onDeletePost={onDeletePost}
                onReport={onReport}
                onRepost={onRepost}
                onSetActiveMenu={onSetActiveMenu}
                onSetMenuAnimating={onSetMenuAnimating}
                hideBoost={hideBoost}
                onLocalUpdate={onLocalUpdate}
              />
            </div>
          );
        })}
        {bottomSlot}
      </div>
    </FeedWithPreload>
  );
}
