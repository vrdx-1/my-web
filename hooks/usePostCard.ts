'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { useRouter } from 'next/navigation';
import { isPostOwner } from '@/utils/postUtils';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { mergeHeaders } from '@/utils/activeProfile';
import {
  DEFAULT_EXCHANGE_RATES,
  getApproxPriceValue,
  toEstimatedPrices,
  type ExchangeRates,
} from '@/utils/exchangeRates';
import { supabase } from '@/lib/supabase';

let ratesCache: ExchangeRates | null = null;
let ratesCacheLoadedAt = 0;
let ratesRequestInFlight: Promise<ExchangeRates> | null = null;

async function getLatestExchangeRates(): Promise<ExchangeRates> {
  const now = Date.now();
  if (ratesCache && now - ratesCacheLoadedAt < 5_000) {
    return ratesCache;
  }

  if (ratesRequestInFlight) {
    return ratesRequestInFlight;
  }

  ratesRequestInFlight = (async () => {
    const res = await fetch('/api/exchange-rates/latest', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));
    const nextRates = (json as { rates?: ExchangeRates })?.rates;
    const normalized = nextRates ?? DEFAULT_EXCHANGE_RATES;

    ratesCache = normalized;
    ratesCacheLoadedAt = Date.now();
    return normalized;
  })().finally(() => {
    ratesRequestInFlight = null;
  });

  return ratesRequestInFlight;
}

interface UsePostCardOptions {
  post: any;
  session: any;
  onRepost?: (postId: string, options?: { silentSuccessPopup?: boolean }) => void | Promise<void>;
  exchangeRatesOverride?: ExchangeRates | null;
}

export function usePostCard({ post, session, onRepost, exchangeRatesOverride = null }: UsePostCardOptions) {
  const router = useRouter();
  const { activeProfileId, authUserId, availableProfiles } = useSessionAndProfile();

  const isOwner = isPostOwner(post, session, activeProfileId, authUserId, availableProfiles);
  const activeProfile = React.useMemo(
    () =>
      availableProfiles.find((profile) => profile.id === activeProfileId) ??
      availableProfiles.find((profile) => profile.id === authUserId) ??
      null,
    [activeProfileId, authUserId, availableProfiles],
  );
  const isAdminSubAccount = Boolean(
    activeProfile?.is_sub_account &&
      (activeProfile?.parent_admin_id || activeProfile?.role === 'admin'),
  );
  const isRecommendPost = post.status === 'recommend';
  const canQuickRepost =
    isAdminSubAccount && isOwner && isRecommendPost && typeof onRepost === 'function';
  const isSoldPost = post.status === 'sold';

  // Modal state
  const [showMarkSoldConfirm, setShowMarkSoldConfirm] = React.useState(false);
  const [showSoldInfo, setShowSoldInfo] = React.useState(false);
  const [showChangePriceModal, setShowChangePriceModal] = React.useState(false);
  const [showChangePriceSuccess, setShowChangePriceSuccess] = React.useState(false);
  const [showBoostStatusPopup, setShowBoostStatusPopup] = React.useState(false);
  const [boostStatusPopupStatus, setBoostStatusPopupStatus] = React.useState<string | null>(null);
  const [boostStatusPopupExpiresAt, setBoostStatusPopupExpiresAt] = React.useState<string | null>(null);
  const [isQuickReposting, setIsQuickReposting] = React.useState(false);
  const [showPriceEstimatePopup, setShowPriceEstimatePopup] = React.useState(false);
  const [soldInfoCenterPosition, setSoldInfoCenterPosition] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [cardExchangeRates, setCardExchangeRates] = React.useState<ExchangeRates>(
    exchangeRatesOverride ?? DEFAULT_EXCHANGE_RATES,
  );
  const [isTogglingStatus, setIsTogglingStatus] = React.useState(false);

  const cardRef = React.useRef<HTMLDivElement | null>(null);

  // Computed price values
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

  const currencySymbol =
    post.price_currency === '฿' || post.price_currency === '$' ? post.price_currency : '₭';

  const priceText =
    priceValue && priceValue > 0
      ? `${priceValue.toLocaleString('en-US')} ${currencySymbol}`
      : 'ບໍ່ລະບຸລາຄາ';

  const normalizedCaption = React.useMemo(() => {
    const rawCaption = typeof post.caption === 'string' ? post.caption : '';
    return rawCaption.replace(/\s+$/u, '');
  }, [post.caption]);

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
    return toEstimatedPrices(post.price, currencySymbol, cardExchangeRates);
  }, [cardExchangeRates, currencySymbol, post]);

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

  // Callbacks
  const computeSoldInfoCenterPosition = React.useCallback(() => {
    if (typeof window === 'undefined') return null;
    const cardEl = cardRef.current;
    if (!cardEl) return null;
    const rect = cardEl.getBoundingClientRect();
    return { left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 };
  }, []);

  const openSoldInfoPopup = React.useCallback(() => {
    const position = computeSoldInfoCenterPosition();
    if (position) setSoldInfoCenterPosition(position);
    setShowSoldInfo(true);
  }, [computeSoldInfoCenterPosition]);

  const handleBoostClick = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('post_boosts')
        .select('status, expires_at, created_at')
        .eq('post_id', post.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const latest = data?.[0] as { status?: string | null; expires_at?: string | null } | undefined;
      if (!latest?.status) {
        router.push(`/boost_post?id=${post.id}`);
        return;
      }

      const latestStatus = String(latest.status);
      const latestExpiresAt = latest.expires_at ?? null;
      const isSuccessAndExpired =
        latestStatus === 'success' &&
        !!latestExpiresAt &&
        new Date(latestExpiresAt).getTime() <= Date.now();

      if (latestStatus === 'reject') {
        setBoostStatusPopupStatus('reject');
        setBoostStatusPopupExpiresAt(null);
        setShowBoostStatusPopup(true);
        return;
      }

      if (latestStatus === 'success' && !isSuccessAndExpired) {
        setBoostStatusPopupStatus('success');
        setBoostStatusPopupExpiresAt(latestExpiresAt);
        setShowBoostStatusPopup(true);
        return;
      }

      router.push(`/boost_post?id=${post.id}`);
    } catch {
      router.push(`/boost_post?id=${post.id}`);
    }
  }, [post.id, router]);

  const handleQuickRepost = React.useCallback(async () => {
    if (!canQuickRepost || typeof onRepost !== 'function' || isQuickReposting) return;
    setIsQuickReposting(true);
    try {
      await onRepost(post.id, { silentSuccessPopup: true });
    } finally {
      setIsQuickReposting(false);
    }
  }, [canQuickRepost, isQuickReposting, onRepost, post.id]);

  const trackWhatsAppClick = React.useCallback(
    (targetProfileId: string, postId: string) => {
      const payload: Record<string, string> = {
        source: 'post_card_bottom',
        targetProfileId,
        postId,
      };

      const accessToken = session?.access_token ?? '';

      if (!session?.user?.id) {
        const guestToken = getPrimaryGuestToken();
        if (guestToken) payload.guestToken = guestToken;
      }

      const body = JSON.stringify(payload);

      if (
        !accessToken &&
        typeof navigator !== 'undefined' &&
        typeof navigator.sendBeacon === 'function'
      ) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon('/api/analytics/whatsapp-click', blob);
        return;
      }

      void fetch('/api/analytics/whatsapp-click', {
        method: 'POST',
        headers: mergeHeaders(
          {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          activeProfileId,
        ),
        credentials: 'include',
        body,
        keepalive: true,
      }).catch(() => {});
    },
    [activeProfileId, session?.access_token, session?.user?.id],
  );

  // Effects
  React.useEffect(() => {
    if (exchangeRatesOverride) {
      setCardExchangeRates(exchangeRatesOverride);
      return;
    }
    let active = true;
    getLatestExchangeRates()
      .then((rates) => {
        if (!active) return;
        setCardExchangeRates(rates);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [exchangeRatesOverride]);

  React.useEffect(() => {
    if (!showSoldInfo || typeof window === 'undefined') {
      setSoldInfoCenterPosition(null);
      return;
    }
    const updatePosition = () => {
      const position = computeSoldInfoCenterPosition();
      setSoldInfoCenterPosition(position ?? null);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition, { passive: true });
    return () => window.removeEventListener('resize', updatePosition);
  }, [computeSoldInfoCenterPosition, showSoldInfo]);

  return {
    // Derived values
    activeProfileId,
    isOwner,
    canQuickRepost,
    isSoldPost,
    normalizedCaption,
    priceValue,
    currencySymbol,
    priceText,
    estimatedLines,
    // Refs
    cardRef,
    // State
    showMarkSoldConfirm, setShowMarkSoldConfirm,
    showSoldInfo, setShowSoldInfo,
    showChangePriceModal, setShowChangePriceModal,
    showChangePriceSuccess, setShowChangePriceSuccess,
    showBoostStatusPopup, setShowBoostStatusPopup,
    boostStatusPopupStatus,
    boostStatusPopupExpiresAt,
    isQuickReposting,
    showPriceEstimatePopup, setShowPriceEstimatePopup,
    soldInfoCenterPosition,
    isTogglingStatus, setIsTogglingStatus,
    // Handlers
    handleBoostClick,
    handleQuickRepost,
    openSoldInfoPopup,
    trackWhatsAppClick,
  };
}
