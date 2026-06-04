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
const FILTER_OPTION_TEXT_SIZE = 16;
const FILTER_OPTION_TEXT_COLOR = '#111111';
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
  const buttonStep = Math.max(1, toRoundedInt(fromLakToCurrency(PRICE_BUTTON_STEP, currency)));
  const thresholdTier = toRoundedInt(fromLakToCurrency(PRICE_THRESHOLD_TIER, currency));
  const stepLow = Math.max(1, toRoundedInt(fromLakToCurrency(PRICE_STEP_LOW, currency)));
  const stepHigh = Math.max(1, toRoundedInt(fromLakToCurrency(PRICE_STEP_HIGH, currency)));

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
        background: '#1877f2',
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
  onClose: () => void;
  onApplyFilters: (filters: {
    province: string;
    minPriceKip: number | null;
    maxPriceKip: number | null;
    priceSortOrder: HomePriceSortOrder;
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
    onClose,
    onApplyFilters,
  } = props;

  const [mounted, setMounted] = useState(false);
  const [draftProvince, setDraftProvince] = useState('');
  const [draftCurrency, setDraftCurrency] = useState<CurrencySymbol>('₭');
  const [draftMinPriceKip, setDraftMinPriceKip] = useState(PRICE_DEFAULT_MIN);
  const [draftMaxPriceKip, setDraftMaxPriceKip] = useState(PRICE_DEFAULT_MAX);
  const [draftPriceSortOrder, setDraftPriceSortOrder] = useState<HomePriceSortOrder>('');
  const [maxPriceUnlimited, setMaxPriceUnlimited] = useState(false);
  const [isSliderHandlesSwapped, setIsSliderHandlesSwapped] = useState(false);
  const [isEditingMinPrice, setIsEditingMinPrice] = useState(false);
  const [isEditingMaxPrice, setIsEditingMaxPrice] = useState(false);
  const [minPriceInputText, setMinPriceInputText] = useState('');
  const [maxPriceInputText, setMaxPriceInputText] = useState('');
  const [showProvincePopup, setShowProvincePopup] = useState(false);
  const [showCurrencyPopup, setShowCurrencyPopup] = useState(false);
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
    const nextMinLak = normalizeMinFromFilter(minPriceKip);
    const nextMaxLak = normalizeMaxFromFilter(maxPriceKip);
    const nextMin = clampPrice(
      toRoundedInt(fromLakToCurrency(nextMinLak, draftCurrency)),
      priceBounds.minBound,
      priceBounds.inputMaxBound,
    );
    const nextMax = clampPrice(
      toRoundedInt(fromLakToCurrency(nextMaxLak, draftCurrency)),
      priceBounds.minBound,
      priceBounds.inputMaxBound,
    );
    setDraftMinPriceKip(Math.min(nextMin, nextMax));
    setDraftMaxPriceKip(Math.max(nextMin, nextMax));
    setDraftPriceSortOrder(priceSortOrder);
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
  }, [selectedProvince, minPriceKip, maxPriceKip, priceSortOrder, showProvincePicker, draftCurrency, priceBounds.inputMaxBound, priceBounds.minBound]);

  useEffect(() => {
    if (!mounted) return;

    const shouldLockScroll = showProvincePicker || showProvincePopup || showCurrencyPopup;
    const body = document.body;
    const html = document.documentElement;
    const stopBackgroundScroll = (event: TouchEvent | WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const insidePopup = target.closest('[data-home-province-picker], [data-home-province-popup], [data-home-currency-popup]');
      if (!insidePopup) {
        event.preventDefault();
      }
    };

    if (shouldLockScroll && !isScrollLockedRef.current) {
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
    }

    if (shouldLockScroll) {
      document.addEventListener('touchmove', stopBackgroundScroll, { passive: false });
      document.addEventListener('wheel', stopBackgroundScroll, { passive: false });
    }

    if (!shouldLockScroll && isScrollLockedRef.current) {
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
    }

    return () => {
      document.removeEventListener('touchmove', stopBackgroundScroll);
      document.removeEventListener('wheel', stopBackgroundScroll);
      if (!isScrollLockedRef.current) return;
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
  }, [mounted, showProvincePicker, showProvincePopup, showCurrencyPopup]);

  const handleCancel = () => {
    onClose();
  };

  const handleSearch = () => {
    const minPriceLak = toLakFromCurrency(draftMinPriceKip, draftCurrency);
    const maxPriceLak = toLakFromCurrency(draftMaxPriceKip, draftCurrency);
    onApplyFilters({
      province: draftProvince,
      minPriceKip: draftMinPriceKip <= priceBounds.minBound ? null : toRoundedInt(minPriceLak),
      maxPriceKip: maxPriceUnlimited ? null : toRoundedInt(maxPriceLak),
      priceSortOrder: draftPriceSortOrder,
    });
  };

  const handleResetFilters = () => {
    onApplyFilters({
      province: '',
      minPriceKip: null,
      maxPriceKip: null,
      priceSortOrder: '',
    });
  };

  const sliderMinValue = clampPrice(draftMinPriceKip, priceBounds.minBound, priceBounds.maxBound);
  const sliderMaxValue = maxPriceUnlimited
    ? priceBounds.maxBound
    : clampPrice(draftMaxPriceKip, priceBounds.minBound, priceBounds.maxBound);
  const currencyPopupWidth = 120;
  const currencyPopupViewportPadding = 12;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
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
  const sliderPrimaryThumbValue = isSliderHandlesSwapped ? sliderMaxValue : sliderMinValue;
  const sliderSecondaryThumbValue = isSliderHandlesSwapped ? sliderMinValue : sliderMaxValue;
  const maxInputDisplayText = maxPriceUnlimited ? '' : draftMaxPriceKip.toLocaleString('en-US');  const extraMaxChars = Math.max(0, maxInputDisplayText.length - PRICE_BASE_MAX_TEXT.length);
  const priceRowWidth = Math.min(PRICE_ROW_MAX_WIDTH, PRICE_ROW_BASE_WIDTH + extraMaxChars * 24);
  const minPercent = ((sliderMinValue - priceBounds.minBound) / (priceBounds.maxBound - priceBounds.minBound)) * 100;
  const maxPercent = ((sliderMaxValue - priceBounds.minBound) / (priceBounds.maxBound - priceBounds.minBound)) * 100;

  const handleDecreaseMinPrice = () => {
    const next = clampPrice(draftMinPriceKip - priceBounds.buttonStep, priceBounds.minBound, draftMaxPriceKip);
    setDraftMinPriceKip(next);
  };

  const handleIncreaseMaxPrice = () => {
    const currentMax = maxPriceUnlimited ? draftMaxPriceKip : draftMaxPriceKip;
    const next = clampPrice(currentMax + priceBounds.buttonStep, draftMinPriceKip, priceBounds.inputMaxBound);
    setMaxPriceUnlimited(false);
    setDraftMaxPriceKip(next);
  };

  const handleCurrencyChange = (nextCurrency: CurrencySymbol) => {
    if (nextCurrency === draftCurrency) return;

    const currentMinLak = toLakFromCurrency(draftMinPriceKip, draftCurrency);
    const currentMaxLak = toLakFromCurrency(draftMaxPriceKip, draftCurrency);
    const nextBounds = getPriceBoundsForCurrency(nextCurrency);

    const nextMin = clampPrice(
      toRoundedInt(fromLakToCurrency(currentMinLak, nextCurrency)),
      nextBounds.minBound,
      nextBounds.inputMaxBound,
    );
    const nextMaxFromLak = clampPrice(
      toRoundedInt(fromLakToCurrency(currentMaxLak, nextCurrency)),
      nextBounds.minBound,
      nextBounds.inputMaxBound,
    );

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
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontSize: '18px',
              color: '#111111',
              fontFamily: LAO_FONT,
              fontWeight: 400,
              cursor: 'pointer',
            }}
          >
            ຍົກເລີກ
          </button>
          <span style={{ fontSize: '21px', fontWeight: 700 }}>ຕົວກອງ</span>
          <button
            type="button"
            onClick={handleSearch}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontSize: '18px',
              color: '#1877f2',
              fontFamily: LAO_FONT,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ຄົ້ນຫາ
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
              }}
            >
              {draftProvince || 'ທຸກແຂວງ'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
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
                    setMaxPriceUnlimited(false);
                    setDraftMaxPriceKip(next);
                    setIsSliderHandlesSwapped(false);
                    setMaxPriceInputText(next.toLocaleString('en-US'));
                  }}
                  onBlur={() => {
                    if (maxPriceInputText.trim().length === 0) {
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
            <div className="home-price-slider" style={{ position: 'relative', height: 30, flex: 1 }}>
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
                  background: '#1877f2',
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
                      setDraftMinPriceKip(sliderMaxValue);
                      setDraftMaxPriceKip(next);
                      setMaxPriceUnlimited(next >= priceBounds.maxBound);
                      setIsSliderHandlesSwapped(true);
                      return;
                    }
                    setDraftMinPriceKip(next);
                    return;
                  }

                  if (next < sliderMinValue) {
                    setDraftMaxPriceKip(sliderMinValue);
                    setDraftMinPriceKip(next);
                    setMaxPriceUnlimited(sliderMinValue >= priceBounds.maxBound);
                    setIsSliderHandlesSwapped(false);
                    return;
                  }

                  if (next >= priceBounds.maxBound) {
                    setMaxPriceUnlimited(true);
                    setDraftMaxPriceKip(priceBounds.maxBound);
                    return;
                  }

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
                      setDraftMinPriceKip(next);
                      setDraftMaxPriceKip(sliderMinValue);
                      setMaxPriceUnlimited(sliderMinValue >= priceBounds.maxBound);
                      setIsSliderHandlesSwapped(true);
                      return;
                    }

                    if (next >= priceBounds.maxBound) {
                      setMaxPriceUnlimited(true);
                      setDraftMaxPriceKip(priceBounds.maxBound);
                      return;
                    }

                    setMaxPriceUnlimited(false);
                    setDraftMaxPriceKip(next);
                    return;
                  }

                  if (next > sliderMaxValue) {
                    setDraftMaxPriceKip(next);
                    setDraftMinPriceKip(sliderMaxValue);
                    setMaxPriceUnlimited(next >= priceBounds.maxBound);
                    setIsSliderHandlesSwapped(false);
                    return;
                  }

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
            ຈັດລຽງຕາມລາຄາ
          </div>
          <div
            role="group"
            aria-label="Price sort order"
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
              <span>ສະແດງລາຄາຖືກສຸດກ່ອນ</span>
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
              <span>ສະແດງລາຄາແພງສຸດກ່ອນ</span>
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
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }} />
        <div
          style={{
            padding: '12px 16px calc(48px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            justifyContent: 'center',
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
              padding: '10px 18px',
              fontFamily: LAO_FONT,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: 140,
            }}
          >
            ລ້າງຕົວກອງ
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
            }}
          />
          <div
            data-home-province-popup
            style={{
              position: 'absolute',
              left: triggerRect ? `${triggerRect.left + triggerRect.width / 2}px` : '50%',
              top: triggerRect ? `${triggerRect.bottom + 8}px` : '140px',
              transform: 'translateX(-50%)',
              width: 'min(240px, 72vw)',
              maxHeight: '70vh',
              overflowY: 'auto',
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
          border: 2px solid #1877f2;
          box-shadow: 0 1px 3px rgba(24, 119, 242, 0.4);
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
          border: 2px solid #1877f2;
          box-shadow: 0 1px 3px rgba(24, 119, 242, 0.4);
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