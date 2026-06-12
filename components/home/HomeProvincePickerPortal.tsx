'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { memo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LAO_PROVINCES, LAO_FONT } from '@/utils/constants';
import type { HomePriceSortOrder } from '@/contexts/HomeProvinceContext';
import { DEFAULT_EXCHANGE_RATES, type CurrencySymbol } from '@/utils/exchangeRates';

const PRICE_MIN_BOUND = 0;
const PRICE_MAX_BOUND = 1_000_000_000;
const PRICE_INPUT_MAX_BOUND = 90_000_000_000;
const PRICE_ROW_BASE_WIDTH = 300;
const PRICE_ROW_MAX_WIDTH = 460;
const PRICE_BASE_MAX_TEXT = '1,000,000,000';
const PRICE_DEFAULT_MIN = 100_000_000;
const PRICE_DEFAULT_MAX = 500_000_000;
const PRICE_BUTTON_STEP = 10_000_000;
const PRICE_THRESHOLD_TIER = 1_000_000_000;
const PRICE_STEP_LOW = 10_000_000;
const PRICE_STEP_HIGH = 100_000_000;
const PRICE_STEP_THB = 10_000;
const PRICE_STEP_USD = 1_000;
const FILTER_OPTION_TEXT_SIZE = 16;
const FILTER_OPTION_TEXT_COLOR = '#111111';
const FILTER_SEARCH_BUTTON_BLUE = '#1877f2';
const FILTER_SEARCH_BUTTON_DISABLED_BG = '#c6ccd6';
const FILTER_ACCENT_BLUE = FILTER_SEARCH_BUTTON_BLUE;
const FILTER_PROVINCE_SELECTED_BLUE = '#0f5fcc';
const FILTER_RANGE_INACTIVE_COLOR = '#98a2b3';
const CURRENCY_OPTIONS: CurrencySymbol[] = ['₭', '$', '฿'];

function toLakFromCurrency(value: number, currency: CurrencySymbol) {
  if (currency === '฿') return value * DEFAULT_EXCHANGE_RATES.thb_to_lak;
  if (currency === '$') return value * DEFAULT_EXCHANGE_RATES.usd_to_lak;
  return value;
}

function fromLakToCurrency(valueLak: number, currency: CurrencySymbol) {
  if (currency === '฿') return valueLak * DEFAULT_EXCHANGE_RATES.lak_to_thb;
  if (currency === '$') return valueLak * DEFAULT_EXCHANGE_RATES.lak_to_usd;
  return valueLak;
}

function toRoundedInt(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function getPriceBoundsForCurrency(currency: CurrencySymbol) {
  const maxBound = toRoundedInt(fromLakToCurrency(PRICE_MAX_BOUND, currency));
  const inputMaxBound = toRoundedInt(fromLakToCurrency(PRICE_INPUT_MAX_BOUND, currency));
  const defaultMin = toRoundedInt(fromLakToCurrency(PRICE_DEFAULT_MIN, currency));
  const defaultMax = toRoundedInt(fromLakToCurrency(PRICE_DEFAULT_MAX, currency));
  const buttonStep = currency === '฿'
    ? PRICE_STEP_THB
    : currency === '$'
      ? PRICE_STEP_USD
      : Math.max(1, toRoundedInt(fromLakToCurrency(PRICE_BUTTON_STEP, currency)));
  const thresholdTier = toRoundedInt(fromLakToCurrency(PRICE_THRESHOLD_TIER, currency));
  const stepLow = currency === '฿'
    ? PRICE_STEP_THB
    : currency === '$'
      ? PRICE_STEP_USD
      : Math.max(1, toRoundedInt(fromLakToCurrency(PRICE_STEP_LOW, currency)));
  const stepHigh = currency === '฿'
    ? PRICE_STEP_THB
    : currency === '$'
      ? PRICE_STEP_USD
      : Math.max(1, toRoundedInt(fromLakToCurrency(PRICE_STEP_HIGH, currency)));

  return {
    minBound: 0,
    maxBound,
    inputMaxBound,
    defaultMin,
    defaultMax,
    buttonStep,
    thresholdTier,
    stepLow,
    stepHigh,
    unitLabel: currency,
  };
}

function clampPrice(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snapPriceToTier(value: number, thresholdTier: number, stepLow: number, stepHigh: number) {
  const step = value > thresholdTier ? stepHigh : stepLow;
  return Math.round(value / step) * step;
}

function snapToNearestPriceStep(
  value: number,
  bounds: {
    minBound: number;
    inputMaxBound: number;
    thresholdTier: number;
    stepLow: number;
    stepHigh: number;
  },
) {
  const rounded = toRoundedInt(value);
  const snapped = snapPriceToTier(rounded, bounds.thresholdTier, bounds.stepLow, bounds.stepHigh);
  return clampPrice(snapped, bounds.minBound, bounds.inputMaxBound);
}

function normalizeMinFromFilter(value: number | null) {
  if (value == null) return PRICE_DEFAULT_MIN;
  return clampPrice(value, PRICE_MIN_BOUND, PRICE_INPUT_MAX_BOUND);
}

function normalizeMaxFromFilter(value: number | null) {
  if (value == null) return PRICE_DEFAULT_MAX;
  return clampPrice(value, PRICE_MIN_BOUND, PRICE_INPUT_MAX_BOUND);
}

function formatPriceLabel(value: number) {
  return `${value.toLocaleString('en-US')} ກີບ`;
}

function parseDigitsInput(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? numeric : null;
}

function SelectedCheckBadge() {
  return (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: FILTER_ACCENT_BLUE,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(24,119,242,0.35)',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

export interface HomeProvincePickerPortalProps {
  showProvincePicker: boolean;
  isAnimating: boolean;
  pickerRef: React.RefObject<HTMLDivElement | null>;
  selectedProvince: string;
  minPriceKip: number | null;
  maxPriceKip: number | null;
  priceSortOrder: HomePriceSortOrder;
  displayCurrency: CurrencySymbol;
  onClose: () => void;
  onApplyFilters: (filters: {
    province: string;
    minPriceKip: number | null;
    maxPriceKip: number | null;
    minPriceDisplay: number | null;
    maxPriceDisplay: number | null;
    priceSortOrder: HomePriceSortOrder;
    displayCurrency: CurrencySymbol;
  }) => void;
}

function HomeProvincePickerPortalBase(props: HomeProvincePickerPortalProps) {
  const {
    showProvincePicker,
    isAnimating,
    pickerRef,
    selectedProvince,
    minPriceKip,
    maxPriceKip,
    priceSortOrder,
    displayCurrency,
    onClose,
    onApplyFilters,
  } = props;

  const [mounted, setMounted] = useState(false);
  const [draftProvince, setDraftProvince] = useState('');
  const [draftCurrency, setDraftCurrency] = useState<CurrencySymbol>('₭');
  const [draftMinPriceKip, setDraftMinPriceKip] = useState(PRICE_DEFAULT_MIN);
  const [draftMaxPriceKip, setDraftMaxPriceKip] = useState(PRICE_DEFAULT_MAX);
  const [draftPriceSortOrder, setDraftPriceSortOrder] = useState<HomePriceSortOrder>('');
  const [isPriceRangeCustomized, setIsPriceRangeCustomized] = useState(false);
  const [maxPriceUnlimited, setMaxPriceUnlimited] = useState(false);
  const [isSliderHandlesSwapped, setIsSliderHandlesSwapped] = useState(false);
  const [isEditingMinPrice, setIsEditingMinPrice] = useState(false);
  const [isEditingMaxPrice, setIsEditingMaxPrice] = useState(false);
  const [minPriceInputText, setMinPriceInputText] = useState('');
  const [maxPriceInputText, setMaxPriceInputText] = useState('');
  const [showProvincePopup, setShowProvincePopup] = useState(false);
  const [showCurrencyPopup, setShowCurrencyPopup] = useState(false);
  const [showSelectFilterWarning, setShowSelectFilterWarning] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const [currencyTriggerRect, setCurrencyTriggerRect] = useState<DOMRect | null>(null);
  const isScrollLockedRef = useRef(false);
  const lockedScrollYRef = useRef(0);
  const priceBounds = getPriceBoundsForCurrency(draftCurrency);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showProvincePicker) return;
    setDraftProvince(selectedProvince);
    setDraftCurrency(displayCurrency);
    const nextBounds = getPriceBoundsForCurrency(displayCurrency);
    const nextMinLak = normalizeMinFromFilter(minPriceKip);
    const nextMaxLak = normalizeMaxFromFilter(maxPriceKip);
    const nextMin = snapToNearestPriceStep(fromLakToCurrency(nextMinLak, displayCurrency), nextBounds);
    const nextMax = snapToNearestPriceStep(fromLakToCurrency(nextMaxLak, displayCurrency), nextBounds);
    setDraftMinPriceKip(Math.min(nextMin, nextMax));
    setDraftMaxPriceKip(Math.max(nextMin, nextMax));
    setDraftPriceSortOrder(priceSortOrder);
    setIsPriceRangeCustomized(minPriceKip != null || maxPriceKip != null);
    // Keep "no filter selected yet" showing default finite range (100M-500M).
    // Unlimited max is only shown when user explicitly applied an open-ended range.
    setMaxPriceUnlimited(maxPriceKip == null && minPriceKip != null);
    setIsSliderHandlesSwapped(false);
    setIsEditingMinPrice(false);
    setIsEditingMaxPrice(false);
    setMinPriceInputText('');
    setMaxPriceInputText('');
    setShowProvincePopup(false);
    setShowCurrencyPopup(false);
    setShowSelectFilterWarning(false);
  }, [selectedProvince, minPriceKip, maxPriceKip, priceSortOrder, displayCurrency, showProvincePicker]);

  // Effect 1: body scroll lock — only triggered by the outer filter open/close.
  // Must NOT depend on sub-popup states so that opening showProvincePopup / showCurrencyPopup
  // does not trigger a cleanup→unlock→relock cycle (which lets iOS momentum scroll fire briefly).
  useEffect(() => {
    if (!mounted || !showProvincePicker) return;
    const body = document.body;
    const html = document.documentElement;
    lockedScrollYRef.current = window.scrollY;
    body.style.position = 'fixed';
    body.style.top = `-${lockedScrollYRef.current}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    isScrollLockedRef.current = true;
    return () => {
      const restoreY = lockedScrollYRef.current;
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.overflow = '';
      body.style.overscrollBehavior = '';
      html.style.overflow = '';
      html.style.overscrollBehavior = '';
      window.scrollTo(0, restoreY);
      isScrollLockedRef.current = false;
    };
  }, [mounted, showProvincePicker]);

  // Effect 2: touchmove/wheel prevention — allows scrolling inside the picker/popups
  // but blocks background scroll. Runs independently from body lock so sub-popup toggles
  // never cause a scroll-unlock cycle.
  useEffect(() => {
    if (!mounted) return;
    const shouldPrevent = showProvincePicker || showProvincePopup || showCurrencyPopup;
    if (!shouldPrevent) return;
    const stopBackgroundScroll = (event: TouchEvent | WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const insidePopup = target.closest('[data-home-province-picker], [data-home-province-popup], [data-home-currency-popup]');
      const insideScrollable = target.closest('[data-home-scrollable]');
      if (!insidePopup || !insideScrollable) {
        event.preventDefault();
      }
    };
    document.addEventListener('touchmove', stopBackgroundScroll, { passive: false, capture: true });
    document.addEventListener('wheel', stopBackgroundScroll, { passive: false, capture: true });
    return () => {
      document.removeEventListener('touchmove', stopBackgroundScroll, true);
      document.removeEventListener('wheel', stopBackgroundScroll, true);
    };
  }, [mounted, showProvincePicker, showProvincePopup, showCurrencyPopup]);

  const handleCancel = () => {
    onClose();
  };

  const hasAnySelectedFilter = draftProvince.trim().length > 0 || isPriceRangeCustomized || draftPriceSortOrder !== '';

  const showMissingFilterWarning = () => {
    setShowSelectFilterWarning(true);
  };

  const handleSearch = () => {
    if (!hasAnySelectedFilter) {
      showMissingFilterWarning();
      return;
    }
    const minPriceLak = toLakFromCurrency(draftMinPriceKip, draftCurrency);
    const maxPriceLak = toLakFromCurrency(draftMaxPriceKip, draftCurrency);
    const shouldApplyPriceRange = isPriceRangeCustomized;
    const minPriceDisplay = shouldApplyPriceRange
      ? (draftMinPriceKip <= priceBounds.minBound ? null : toRoundedInt(draftMinPriceKip))
      : null;
    const maxPriceDisplay = shouldApplyPriceRange
      ? (maxPriceUnlimited ? null : toRoundedInt(draftMaxPriceKip))
      : null;
    onApplyFilters({
      province: draftProvince,
      minPriceKip: shouldApplyPriceRange
        ? (draftMinPriceKip <= priceBounds.minBound ? null : toRoundedInt(minPriceLak))
        : null,
      maxPriceKip: shouldApplyPriceRange
        ? (maxPriceUnlimited ? null : toRoundedInt(maxPriceLak))
        : null,
      minPriceDisplay,
      maxPriceDisplay,
      priceSortOrder: draftPriceSortOrder,
      displayCurrency: draftCurrency,
    });
  };

  const handleResetFilters = () => {
    setShowSelectFilterWarning(false);
    onApplyFilters({
      province: '',
      minPriceKip: null,
      maxPriceKip: null,
      minPriceDisplay: null,
      maxPriceDisplay: null,
      priceSortOrder: '',
      displayCurrency: draftCurrency,
    });
  };

  const sliderMinValue = clampPrice(draftMinPriceKip, priceBounds.minBound, priceBounds.maxBound);
  const sliderMaxValue = maxPriceUnlimited
    ? priceBounds.maxBound
    : clampPrice(draftMaxPriceKip, priceBounds.minBound, priceBounds.maxBound);
  const currencyPopupWidth = 120;
  const currencyPopupViewportPadding = 12;
  const provincePopupViewportPadding = 28;
  const provincePopupMinVisibleHeight = 260;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 844;
  const priceRowMaxWidth = Math.min(420, Math.max(260, viewportWidth - 52));
  const priceSeparatorWidth = 10;
  const priceRowGap = 8;
  const inputBoxMinWidth = Math.floor((priceRowMaxWidth - priceSeparatorWidth - priceRowGap * 2) / 2);
  const inputTextWidth = Math.max(90, inputBoxMinWidth - 24);
  const currencyPopupLeft = currencyTriggerRect
    ? Math.max(
      currencyPopupViewportPadding,
      Math.min(
        currencyTriggerRect.left + currencyTriggerRect.width / 2 - currencyPopupWidth / 2,
        viewportWidth - currencyPopupWidth - currencyPopupViewportPadding,
      ),
    )
    : 16;
  const provincePopupTopBase = triggerRect ? triggerRect.bottom + 8 : 140;
  const provincePopupTop = Math.max(
    provincePopupViewportPadding,
    Math.min(
      provincePopupTopBase,
      viewportHeight - provincePopupMinVisibleHeight - provincePopupViewportPadding,
    ),
  );
  const provincePopupMaxHeight = Math.max(
    provincePopupMinVisibleHeight,
    viewportHeight - provincePopupTop - provincePopupViewportPadding,
  );
  const sliderPrimaryThumbValue = isSliderHandlesSwapped ? sliderMaxValue : sliderMinValue;
  const sliderSecondaryThumbValue = isSliderHandlesSwapped ? sliderMinValue : sliderMaxValue;
  const priceRangeAccentColor = isPriceRangeCustomized ? FILTER_ACCENT_BLUE : FILTER_RANGE_INACTIVE_COLOR;
  const priceRangeAccentShadow = isPriceRangeCustomized
    ? '0 1px 3px rgba(24, 119, 242, 0.4)'
    : '0 1px 2px rgba(15, 23, 42, 0.18)';
  const maxInputDisplayText = maxPriceUnlimited ? '' : draftMaxPriceKip.toLocaleString('en-US');  const extraMaxChars = Math.max(0, maxInputDisplayText.length - PRICE_BASE_MAX_TEXT.length);
  const priceRowWidth = Math.min(PRICE_ROW_MAX_WIDTH, PRICE_ROW_BASE_WIDTH + extraMaxChars * 24);
  const minPercent = ((sliderMinValue - priceBounds.minBound) / (priceBounds.maxBound - priceBounds.minBound)) * 100;
  const maxPercent = ((sliderMaxValue - priceBounds.minBound) / (priceBounds.maxBound - priceBounds.minBound)) * 100;

  const handleDecreaseMinPrice = () => {
    const next = clampPrice(draftMinPriceKip - priceBounds.buttonStep, priceBounds.minBound, draftMaxPriceKip);
    setIsPriceRangeCustomized(true);
    setDraftMinPriceKip(next);
  };

  const handleIncreaseMaxPrice = () => {
    const currentMax = maxPriceUnlimited ? draftMaxPriceKip : draftMaxPriceKip;
    const next = clampPrice(currentMax + priceBounds.buttonStep, draftMinPriceKip, priceBounds.inputMaxBound);
    setIsPriceRangeCustomized(true);
    setMaxPriceUnlimited(false);
    setDraftMaxPriceKip(next);
  };

  const handleCurrencyChange = (nextCurrency: CurrencySymbol) => {
    if (nextCurrency === draftCurrency) return;

    const currentMinLak = toLakFromCurrency(draftMinPriceKip, draftCurrency);
    const currentMaxLak = toLakFromCurrency(draftMaxPriceKip, draftCurrency);
    const nextBounds = getPriceBoundsForCurrency(nextCurrency);

    const nextMin = snapToNearestPriceStep(fromLakToCurrency(currentMinLak, nextCurrency), nextBounds);
    const nextMaxFromLak = snapToNearestPriceStep(fromLakToCurrency(currentMaxLak, nextCurrency), nextBounds);

    setDraftCurrency(nextCurrency);
    setDraftMinPriceKip(Math.min(nextMin, nextMaxFromLak));
    setDraftMaxPriceKip(maxPriceUnlimited ? nextBounds.maxBound : Math.max(nextMin, nextMaxFromLak));
    setIsSliderHandlesSwapped(false);
    setMinPriceInputText('');
    setMaxPriceInputText('');
    setIsEditingMinPrice(false);
    setIsEditingMaxPrice(false);
  };

  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        pointerEvents: 'none',
        visibility: showProvincePicker ? 'visible' : 'hidden',
        opacity: showProvincePicker ? 1 : 0,
        transition: 'none',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 10001,
          pointerEvents: showProvincePicker ? 'auto' : 'none',
          touchAction: 'none',
        }}
        onClick={onClose}
      />
      <div
        ref={pickerRef}
        data-home-province-picker
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: '85vh',
          background: '#fff',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.2)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          zIndex: 10002,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transform: showProvincePicker && !isAnimating ? 'translateY(0)' : 'translateY(100%)',
          opacity: showProvincePicker && !isAnimating ? 1 : 0,
          transition: 'none',
          pointerEvents: showProvincePicker ? 'auto' : 'none',
        }}
      >
        <div
          style={{
            padding: '16px 16px 14px',
            minHeight: 64,
            boxSizing: 'border-box',
            fontSize: '16px',
            lineHeight: '1.3',
            fontFamily: LAO_FONT,
            color: '#111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleCancel}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              color: '#000',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="Back"
          >
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{ fontSize: '21px', fontWeight: 700 }}>ຕົວກອງ</span>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            style={{
              width: 36,
              height: 36,
              opacity: 0,
              pointerEvents: 'none',
            }}
          >
            .
          </button>
        </div>
        <div
          data-home-scrollable
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
        >
        <div
          style={{
            margin: '12px 16px 0',
            padding: '16px',
            background: '#ffffff',
            border: '1px solid #d0d5dd',
            borderRadius: 16,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: LAO_FONT,
              fontSize: '18px',
              fontWeight: 700,
              color: '#111111',
              marginBottom: 10,
            }}
          >
            ເລືອກແຂວງ
          </div>
          <button
            type="button"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setTriggerRect(rect);
              setShowProvincePopup(true);
            }}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              cursor: 'pointer',
              fontFamily: LAO_FONT,
              color: FILTER_OPTION_TEXT_COLOR,
              fontSize: `${FILTER_OPTION_TEXT_SIZE}px`,
              textAlign: 'left',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 500,
                color: draftProvince ? FILTER_PROVINCE_SELECTED_BLUE : FILTER_OPTION_TEXT_COLOR,
              }}
            >
              {draftProvince || 'ທຸກແຂວງ'}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                style={{ display: 'block', transform: 'translateY(1px)' }}
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
        <div
          style={{
            margin: '12px 16px 0',
            padding: '16px',
            background: '#ffffff',
            border: '1px solid #d0d5dd',
            borderRadius: 16,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontFamily: LAO_FONT,
                fontSize: '18px',
                fontWeight: 700,
                color: '#111111',
              }}
            >
              ກຳນົດຊ່ວງລາຄາ
            </span>
            <div
              style={{
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setCurrencyTriggerRect(rect);
                  setShowCurrencyPopup(true);
                }}
                aria-label="Select price currency"
              style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  fontFamily: LAO_FONT,
                  color: FILTER_OPTION_TEXT_COLOR,
                  fontSize: `${FILTER_OPTION_TEXT_SIZE}px`,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ fontWeight: 500 }}>{draftCurrency}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0,
              marginBottom: 10,
              fontFamily: LAO_FONT,
              color: '#111111',
              fontSize: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: priceRowGap,
                width: priceRowMaxWidth,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flex: '0 0 auto',
                  width: inputBoxMinWidth,
                  minWidth: 0,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid #d0d5dd',
                  padding: '0 8px 0 10px',
                  boxSizing: 'border-box',
                }}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={isEditingMinPrice ? minPriceInputText : (draftMinPriceKip > 0 ? draftMinPriceKip.toLocaleString('en-US') : '')}
                  placeholder="0"
                  onFocus={() => {
                    setIsEditingMinPrice(true);
                    setMinPriceInputText(draftMinPriceKip > 0 ? draftMinPriceKip.toLocaleString('en-US') : '');
                  }}
                  onChange={(event) => {
                    const parsed = parseDigitsInput(event.target.value);
                    if (parsed == null) {
                      setMinPriceInputText('');
                      return;
                    }
                    const next = clampPrice(parsed, priceBounds.minBound, draftMaxPriceKip);
                    setIsPriceRangeCustomized(true);
                    setDraftMinPriceKip(next);
                    setIsSliderHandlesSwapped(false);
                    setMinPriceInputText(next.toLocaleString('en-US'));
                  }}
                  onBlur={() => {
                    setIsEditingMinPrice(false);
                    setMinPriceInputText('');
                  }}
                  style={{
                    width: inputTextWidth,
                    minWidth: 0,
                    height: 30,
                    border: 'none',
                    padding: 0,
                    fontFamily: LAO_FONT,
                    fontSize: 13,
                    color: '#111111',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: 'transparent',
                  }}
                />
                <span style={{ fontFamily: LAO_FONT, fontSize: 13, color: FILTER_OPTION_TEXT_COLOR, pointerEvents: 'none', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>
                  {priceBounds.unitLabel}
                </span>
              </div>
              <span style={{ flexShrink: 0, width: 10, height: 2, background: '#98a2b3', borderRadius: 999, display: 'inline-block' }} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flex: '0 0 auto',
                  width: inputBoxMinWidth,
                  minWidth: 0,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid #d0d5dd',
                  padding: '0 8px 0 10px',
                  boxSizing: 'border-box',
                }}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={isEditingMaxPrice ? maxPriceInputText : (maxPriceUnlimited ? '' : draftMaxPriceKip.toLocaleString('en-US'))}
                  placeholder="ບໍ່ຈຳກັດ"
                  onFocus={() => {
                    setIsEditingMaxPrice(true);
                    setMaxPriceInputText(maxPriceUnlimited ? '' : draftMaxPriceKip.toLocaleString('en-US'));
                  }}
                  onChange={(event) => {
                    const parsed = parseDigitsInput(event.target.value);
                    if (parsed == null) {
                      setMaxPriceInputText('');
                      return;
                    }
                    const next = clampPrice(parsed, draftMinPriceKip, priceBounds.inputMaxBound);
                    setIsPriceRangeCustomized(true);
                    setMaxPriceUnlimited(false);
                    setDraftMaxPriceKip(next);
                    setIsSliderHandlesSwapped(false);
                    setMaxPriceInputText(next.toLocaleString('en-US'));
                  }}
                  onBlur={() => {
                    if (maxPriceInputText.trim().length === 0) {
                      setIsPriceRangeCustomized(true);
                      setMaxPriceUnlimited(true);
                      setDraftMaxPriceKip(priceBounds.maxBound);
                    }
                    setIsEditingMaxPrice(false);
                    setMaxPriceInputText('');
                  }}
                  style={{
                    width: inputTextWidth,
                    minWidth: 0,
                    height: 30,
                    border: 'none',
                    padding: 0,
                    fontFamily: LAO_FONT,
                    fontSize: 13,
                    color: '#111111',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: 'transparent',
                  }}
                />
                <span style={{ fontFamily: LAO_FONT, fontSize: 13, color: FILTER_OPTION_TEXT_COLOR, pointerEvents: 'none', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>
                  {priceBounds.unitLabel}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={handleDecreaseMinPrice}
              aria-label="Decrease minimum price"
              style={{
                width: 38,
                height: 38,
                color: '#475467',
                border: '1px solid #d0d5dd',
                background: '#f8fafc',
                padding: 0,
                borderRadius: 999,
                cursor: 'pointer',
                userSelect: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 12h12"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div
              className="home-price-slider"
              style={{
                position: 'relative',
                height: 30,
                flex: 1,
                ['--price-accent-color' as any]: priceRangeAccentColor,
                ['--price-accent-shadow' as any]: priceRangeAccentShadow,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: 4,
                  borderRadius: 999,
                  background: '#dbe2ea',
                  transform: 'translateY(-50%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: `${minPercent}%`,
                  width: `${Math.max(maxPercent - minPercent, 0)}%`,
                  height: 4,
                  borderRadius: 999,
                  background: priceRangeAccentColor,
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                type="range"
                min={priceBounds.minBound}
                max={priceBounds.maxBound}
                step={priceBounds.stepLow}
                value={sliderPrimaryThumbValue}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  const snapped = snapPriceToTier(raw, priceBounds.thresholdTier, priceBounds.stepLow, priceBounds.stepHigh);
                  const next = clampPrice(snapped, priceBounds.minBound, priceBounds.maxBound);
                  if (!isSliderHandlesSwapped) {
                    if (next > sliderMaxValue) {
                      setIsPriceRangeCustomized(true);
                      setDraftMinPriceKip(sliderMaxValue);
                      setDraftMaxPriceKip(next);
                      setMaxPriceUnlimited(next >= priceBounds.maxBound);
                      setIsSliderHandlesSwapped(true);
                      return;
                    }
                    setIsPriceRangeCustomized(true);
                    setDraftMinPriceKip(next);
                    return;
                  }

                  if (next < sliderMinValue) {
                    setIsPriceRangeCustomized(true);
                    setDraftMaxPriceKip(sliderMinValue);
                    setDraftMinPriceKip(next);
                    setMaxPriceUnlimited(sliderMinValue >= priceBounds.maxBound);
                    setIsSliderHandlesSwapped(false);
                    return;
                  }

                  if (next >= priceBounds.maxBound) {
                    setIsPriceRangeCustomized(true);
                    setMaxPriceUnlimited(true);
                    setDraftMaxPriceKip(priceBounds.maxBound);
                    return;
                  }

                  setIsPriceRangeCustomized(true);
                  setMaxPriceUnlimited(false);
                  setDraftMaxPriceKip(next);
                }}
                className="home-price-range home-price-range-min"
                aria-label="Min price"
              />
              <input
                type="range"
                min={priceBounds.minBound}
                max={priceBounds.maxBound}
                step={priceBounds.stepLow}
                value={sliderSecondaryThumbValue}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  const snapped = snapPriceToTier(raw, priceBounds.thresholdTier, priceBounds.stepLow, priceBounds.stepHigh);
                  const next = clampPrice(snapped, priceBounds.minBound, priceBounds.maxBound);
                  if (!isSliderHandlesSwapped) {
                    if (next < sliderMinValue) {
                      setIsPriceRangeCustomized(true);
                      setDraftMinPriceKip(next);
                      setDraftMaxPriceKip(sliderMinValue);
                      setMaxPriceUnlimited(sliderMinValue >= priceBounds.maxBound);
                      setIsSliderHandlesSwapped(true);
                      return;
                    }

                    if (next >= priceBounds.maxBound) {
                      setIsPriceRangeCustomized(true);
                      setMaxPriceUnlimited(true);
                      setDraftMaxPriceKip(priceBounds.maxBound);
                      return;
                    }

                    setIsPriceRangeCustomized(true);
                    setMaxPriceUnlimited(false);
                    setDraftMaxPriceKip(next);
                    return;
                  }

                  if (next > sliderMaxValue) {
                    setIsPriceRangeCustomized(true);
                    setDraftMaxPriceKip(next);
                    setDraftMinPriceKip(sliderMaxValue);
                    setMaxPriceUnlimited(next >= priceBounds.maxBound);
                    setIsSliderHandlesSwapped(false);
                    return;
                  }

                  setIsPriceRangeCustomized(true);
                  setDraftMinPriceKip(next);
                }}
                className="home-price-range home-price-range-max"
                aria-label="Max price"
              />
            </div>
            <button
              type="button"
              onClick={handleIncreaseMaxPrice}
              aria-label="Increase maximum price"
              style={{
                width: 38,
                height: 38,
                color: '#475467',
                border: '1px solid #d0d5dd',
                background: '#f8fafc',
                padding: 0,
                borderRadius: 999,
                cursor: 'pointer',
                userSelect: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 6v12M6 12h12"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <div
          style={{
            margin: '12px 16px 0',
            padding: '16px',
            background: '#ffffff',
            border: '1px solid #d0d5dd',
            borderRadius: 16,
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              fontFamily: LAO_FONT,
              fontSize: '18px',
              fontWeight: 700,
              color: '#111111',
              marginBottom: 12,
              textAlign: 'left',
            }}
          >
            ຈັດລຽງຕາມ
          </div>
          <div
            role="group"
            aria-label="Sort order"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              width: '100%',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => setDraftPriceSortOrder('asc')}
              aria-pressed={draftPriceSortOrder === 'asc'}
              style={{
                width: 'auto',
                border: 'none',
                borderRadius: 12,
                padding: '10px 8px',
                fontFamily: LAO_FONT,
                fontSize: FILTER_OPTION_TEXT_SIZE,
                fontWeight: 500,
                cursor: 'pointer',
                background: draftPriceSortOrder === 'asc' ? '#e7f3ff' : '#ffffff',
                color: FILTER_OPTION_TEXT_COLOR,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span>ລາຄາຖືກສຸດກ່ອນ</span>
              {draftPriceSortOrder === 'asc' ? (
                <SelectedCheckBadge />
              ) : (
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '1.5px solid #cbd5e1',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setDraftPriceSortOrder('desc')}
              aria-pressed={draftPriceSortOrder === 'desc'}
              style={{
                width: 'auto',
                border: 'none',
                borderRadius: 12,
                padding: '10px 8px',
                fontFamily: LAO_FONT,
                fontSize: FILTER_OPTION_TEXT_SIZE,
                fontWeight: 500,
                cursor: 'pointer',
                background: draftPriceSortOrder === 'desc' ? '#e7f3ff' : '#ffffff',
                color: FILTER_OPTION_TEXT_COLOR,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span>ລາຄາແພງສຸດກ່ອນ</span>
              {draftPriceSortOrder === 'desc' ? (
                <SelectedCheckBadge />
              ) : (
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '1.5px solid #cbd5e1',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setDraftPriceSortOrder('latest')}
              aria-pressed={draftPriceSortOrder === 'latest'}
              style={{
                width: 'auto',
                border: 'none',
                borderRadius: 12,
                padding: '10px 8px',
                fontFamily: LAO_FONT,
                fontSize: FILTER_OPTION_TEXT_SIZE,
                fontWeight: 500,
                cursor: 'pointer',
                background: draftPriceSortOrder === 'latest' ? '#e7f3ff' : '#ffffff',
                color: FILTER_OPTION_TEXT_COLOR,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span>ໂພສໃໝ່ລ່າສຸດກ່ອນ</span>
              {draftPriceSortOrder === 'latest' ? (
                <SelectedCheckBadge />
              ) : (
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '1.5px solid #cbd5e1',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
              )}
            </button>
          </div>
        </div>
        <div style={{ height: 20, flexShrink: 0 }} />
        </div>
        <div
          style={{
            padding: '8px 16px calc(44px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
            background: '#fff',
          }}
        >
          <button
            type="button"
            onClick={handleResetFilters}
            style={{
              border: '1px solid #d0d5dd',
              background: '#f8fafc',
              color: '#344054',
              borderRadius: 999,
              padding: '0 24px',
              height: 52,
              fontFamily: LAO_FONT,
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1,
              cursor: 'pointer',
              minWidth: 176,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ລ້າງຕົວກອງ
          </button>
          <button
            type="button"
            onClick={handleSearch}
            aria-disabled={!hasAnySelectedFilter}
            style={{
              border: 'none',
              background: hasAnySelectedFilter ? FILTER_SEARCH_BUTTON_BLUE : FILTER_SEARCH_BUTTON_DISABLED_BG,
              color: '#fff',
              borderRadius: 999,
              padding: '0 24px',
              height: 52,
              fontFamily: LAO_FONT,
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1,
              cursor: hasAnySelectedFilter ? 'pointer' : 'not-allowed',
              minWidth: 176,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: hasAnySelectedFilter ? 1 : 0.95,
            }}
          >
            ຄົ້ນຫາ
          </button>
        </div>
      </div>

      {showProvincePopup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10003,
            pointerEvents: 'auto',
          }}
        >
          <div
            onClick={() => setShowProvincePopup(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.2)',
              touchAction: 'none',
            }}
          />
          <div
            data-home-province-popup
            data-home-scrollable
            style={{
              position: 'absolute',
              left: triggerRect ? `${triggerRect.left + triggerRect.width / 2}px` : '50%',
              top: `${provincePopupTop}px`,
              transform: 'translateX(-50%)',
              width: 'min(240px, 72vw)',
              maxHeight: `${provincePopupMaxHeight}px`,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            <div
              onClick={() => {
                setDraftProvince('');
                setShowProvincePopup(false);
              }}
              style={{
                padding: '10px 14px',
                minHeight: 42,
                boxSizing: 'border-box',
                fontSize: '16px',
                lineHeight: '1.3',
                background: draftProvince === '' ? '#e7f3ff' : '#fff',
                cursor: 'pointer',
                fontFamily: LAO_FONT,
                color: '#111111',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexShrink: 0,
              }}
            >
              <span>ທຸກແຂວງ</span>
              {draftProvince === '' && <SelectedCheckBadge />}
            </div>
            {LAO_PROVINCES.map((province) => (
              <div
                key={province}
                onClick={() => {
                  setDraftProvince(province);
                  setShowProvincePopup(false);
                }}
                style={{
                  padding: '8px 14px',
                  minHeight: 40,
                  boxSizing: 'border-box',
                  fontSize: '15px',
                  lineHeight: '1.3',
                  background: draftProvince === province ? '#e7f3ff' : '#fff',
                  cursor: 'pointer',
                  fontFamily: LAO_FONT,
                  color: '#111111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span>{province}</span>
                {draftProvince === province && <SelectedCheckBadge />}
              </div>
            ))}
          </div>
        </div>
      )}

      {showCurrencyPopup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10004,
            pointerEvents: 'auto',
          }}
        >
          <div
            onClick={() => setShowCurrencyPopup(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.2)',
              touchAction: 'none',
            }}
          />
          <div
            data-home-currency-popup
            style={{
              position: 'absolute',
              left: `${currencyPopupLeft}px`,
              top: currencyTriggerRect ? `${currencyTriggerRect.bottom + 8}px` : '160px',
              width: `${currencyPopupWidth}px`,
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >            {CURRENCY_OPTIONS.map((currency) => (
              <div
                key={currency}
                onClick={() => {
                  handleCurrencyChange(currency);
                  setShowCurrencyPopup(false);
                }}
                style={{
                  padding: '10px 14px',
                  minHeight: 40,
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  lineHeight: '1.3',
                  background: draftCurrency === currency ? '#e7f3ff' : '#fff',
                  cursor: 'pointer',
                  fontFamily: LAO_FONT,
                  color: '#111111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span>{currency}</span>
                {draftCurrency === currency && <SelectedCheckBadge />}
              </div>
            ))}
          </div>
        </div>
      )}

      {showSelectFilterWarning && (
        <div
          onClick={() => setShowSelectFilterWarning(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 10005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            pointerEvents: 'auto',
            touchAction: 'manipulation',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '320px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <p
              style={{
                fontSize: '16px',
                marginBottom: '20px',
                textAlign: 'center',
                color: '#111111',
                fontFamily: LAO_FONT,
              }}
            >
              ກະລຸນາເລືອກຕົວກອງກ່ອນ
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowSelectFilterWarning(false)}
                style={{
                  padding: '10px 24px',
                  background: FILTER_SEARCH_BUTTON_BLUE,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: LAO_FONT,
                  touchAction: 'manipulation',
                }}
              >
                ຕົກລົງ
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        .home-price-range {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 30px;
          margin: 0;
          background: transparent;
          pointer-events: none;
          -webkit-appearance: none;
          appearance: none;
        }

        .home-price-range::-webkit-slider-runnable-track {
          height: 4px;
          background: transparent;
        }

        .home-price-range::-moz-range-track {
          height: 4px;
          background: transparent;
        }

        .home-price-range::-webkit-slider-thumb {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: #ffffff;
          border: 2px solid var(--price-accent-color);
          box-shadow: var(--price-accent-shadow);
          pointer-events: auto;
          cursor: pointer;
          -webkit-appearance: none;
          margin-top: -8px;
        }

        .home-price-range::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: #ffffff;
          border: 2px solid var(--price-accent-color);
          box-shadow: var(--price-accent-shadow);
          pointer-events: auto;
          cursor: pointer;
        }

        .home-price-range-max {
          z-index: 2;
        }

        .home-price-range-min {
          z-index: 3;
        }
      `}</style>
    </div>,
    document.body,
  );
}

export const HomeProvincePickerPortal = memo(HomeProvincePickerPortalBase);