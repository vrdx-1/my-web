'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { memo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LAO_PROVINCES, LAO_FONT } from '@/utils/constants';

const PRICE_MIN_BOUND = 0;
const PRICE_MAX_BOUND = 1_000_000_000;
const PRICE_INPUT_MAX_BOUND = 90_000_000_000;
const PRICE_ROW_BASE_WIDTH = 300;
const PRICE_ROW_MAX_WIDTH = 460;
const PRICE_BASE_MAX_TEXT = '1,000,000,000';
const PRICE_DEFAULT_MIN = 100_000_000;
const PRICE_DEFAULT_MAX = 500_000_000;
const PRICE_THRESHOLD_TIER = 1_000_000_000;
const PRICE_STEP_LOW = 10_000_000;
const PRICE_STEP_HIGH = 100_000_000;

function clampPrice(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snapPriceToTier(value: number) {
  const step = value > PRICE_THRESHOLD_TIER ? PRICE_STEP_HIGH : PRICE_STEP_LOW;
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
  onClose: () => void;
  onApplyFilters: (filters: { province: string; minPriceKip: number | null; maxPriceKip: number | null }) => void;
}

function HomeProvincePickerPortalBase(props: HomeProvincePickerPortalProps) {
  const {
    showProvincePicker,
    isAnimating,
    pickerRef,
    selectedProvince,
    minPriceKip,
    maxPriceKip,
    onClose,
    onApplyFilters,
  } = props;

  const [mounted, setMounted] = useState(false);
  const [draftProvince, setDraftProvince] = useState('');
  const [draftMinPriceKip, setDraftMinPriceKip] = useState(PRICE_DEFAULT_MIN);
  const [draftMaxPriceKip, setDraftMaxPriceKip] = useState(PRICE_DEFAULT_MAX);
  const [maxPriceUnlimited, setMaxPriceUnlimited] = useState(false);
  const [isSliderHandlesSwapped, setIsSliderHandlesSwapped] = useState(false);
  const [isEditingMinPrice, setIsEditingMinPrice] = useState(false);
  const [isEditingMaxPrice, setIsEditingMaxPrice] = useState(false);
  const [minPriceInputText, setMinPriceInputText] = useState('');
  const [maxPriceInputText, setMaxPriceInputText] = useState('');
  const [showProvincePopup, setShowProvincePopup] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const isScrollLockedRef = useRef(false);
  const lockedScrollYRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showProvincePicker) return;
    setDraftProvince(selectedProvince);
    const nextMin = normalizeMinFromFilter(minPriceKip);
    const nextMax = normalizeMaxFromFilter(maxPriceKip);
    setDraftMinPriceKip(Math.min(nextMin, nextMax));
    setDraftMaxPriceKip(Math.max(nextMin, nextMax));
    setMaxPriceUnlimited(false);
    setIsSliderHandlesSwapped(false);
    setIsEditingMinPrice(false);
    setIsEditingMaxPrice(false);
    setMinPriceInputText('');
    setMaxPriceInputText('');
    setShowProvincePopup(false);
  }, [selectedProvince, minPriceKip, maxPriceKip, showProvincePicker]);

  useEffect(() => {
    if (!mounted) return;

    const shouldLockScroll = showProvincePicker || showProvincePopup;
    const body = document.body;
    const html = document.documentElement;

    if (shouldLockScroll && !isScrollLockedRef.current) {
      lockedScrollYRef.current = window.scrollY;
      body.style.position = 'fixed';
      body.style.top = `-${lockedScrollYRef.current}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
      isScrollLockedRef.current = true;
    }

    if (!shouldLockScroll && isScrollLockedRef.current) {
      const restoreY = lockedScrollYRef.current;
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.overflow = '';
      html.style.overflow = '';
      window.scrollTo(0, restoreY);
      isScrollLockedRef.current = false;
    }

    return () => {
      if (!isScrollLockedRef.current) return;
      const restoreY = lockedScrollYRef.current;
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.overflow = '';
      html.style.overflow = '';
      window.scrollTo(0, restoreY);
      isScrollLockedRef.current = false;
    };
  }, [mounted, showProvincePicker, showProvincePopup]);

  const handleCancel = () => {
    onClose();
  };

  const handleSearch = () => {
    onApplyFilters({
      province: draftProvince,
      minPriceKip: draftMinPriceKip <= PRICE_MIN_BOUND ? null : draftMinPriceKip,
      maxPriceKip: maxPriceUnlimited ? null : draftMaxPriceKip,
    });
  };

  const sliderMinValue = clampPrice(draftMinPriceKip, PRICE_MIN_BOUND, PRICE_MAX_BOUND);
  const sliderMaxValue = maxPriceUnlimited
    ? PRICE_MAX_BOUND
    : clampPrice(draftMaxPriceKip, PRICE_MIN_BOUND, PRICE_MAX_BOUND);
  const sliderPrimaryThumbValue = isSliderHandlesSwapped ? sliderMaxValue : sliderMinValue;
  const sliderSecondaryThumbValue = isSliderHandlesSwapped ? sliderMinValue : sliderMaxValue;
  const maxInputDisplayText = maxPriceUnlimited ? '' : draftMaxPriceKip.toLocaleString('en-US');
  const extraMaxChars = Math.max(0, maxInputDisplayText.length - PRICE_BASE_MAX_TEXT.length);
  const priceRowWidth = Math.min(PRICE_ROW_MAX_WIDTH, PRICE_ROW_BASE_WIDTH + extraMaxChars * 24);
  const minPercent = ((sliderMinValue - PRICE_MIN_BOUND) / (PRICE_MAX_BOUND - PRICE_MIN_BOUND)) * 100;
  const maxPercent = ((sliderMaxValue - PRICE_MIN_BOUND) / (PRICE_MAX_BOUND - PRICE_MIN_BOUND)) * 100;

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
        transition: 'opacity 0.15s ease-out',
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
          transition: 'transform 0.28s ease-out, opacity 0.2s ease-out',
          pointerEvents: showProvincePicker ? 'auto' : 'none',
        }}
      >
        <div
          style={{
            padding: '12px 16px 10px',
            minHeight: 52,
            boxSizing: 'border-box',
            fontSize: '16px',
            lineHeight: '1.3',
            borderBottom: '1px solid #eceff3',
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
            padding: '14px 16px 12px',
            borderBottom: '1px solid #f2f4f7',
            flexShrink: 0,
          }}
        >
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
              justifyContent: 'space-between',
              gap: 12,
              cursor: 'pointer',
              fontFamily: LAO_FONT,
              color: '#111111',
              fontSize: '16px',
              textAlign: 'left',
            }}
          >
            <span>ເລືອກແຂວງ</span>
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
            padding: '14px 16px 14px',
            borderBottom: '1px solid #f2f4f7',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 10,
              fontFamily: LAO_FONT,
              color: '#111111',
              fontSize: '16px',
            }}
          >
            <span>ຊ່ວງລາຄາ</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
                flex: '0 0 auto',
                width: `min(86vw, ${priceRowWidth}px)`,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  flex: '0 0 42%',
                  minWidth: 0,
                }}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={isEditingMinPrice ? minPriceInputText : (draftMinPriceKip > 0 ? draftMinPriceKip.toLocaleString('en-US') : '')}
                  placeholder="0"
                  onFocus={() => {
                    setIsEditingMinPrice(true);
                    setMinPriceInputText('');
                  }}
                  onChange={(event) => {
                    const parsed = parseDigitsInput(event.target.value);
                    if (parsed == null) {
                      setMinPriceInputText('');
                      return;
                    }
                    const next = clampPrice(parsed, PRICE_MIN_BOUND, draftMaxPriceKip);
                    setDraftMinPriceKip(next);
                    setIsSliderHandlesSwapped(false);
                    setMinPriceInputText(next.toLocaleString('en-US'));
                  }}
                  onBlur={() => {
                    setIsEditingMinPrice(false);
                    setMinPriceInputText('');
                  }}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid #d0d5dd',
                    padding: '0 42px 0 10px',
                    fontFamily: LAO_FONT,
                    fontSize: 13,
                    color: '#111111',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontFamily: LAO_FONT,
                    fontSize: 13,
                    color: '#667085',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ກີບ
                </span>
              </div>
              <span style={{ fontFamily: LAO_FONT, fontSize: 13, color: '#98a2b3' }}>-</span>
              <div
                style={{
                  position: 'relative',
                  flex: '1 1 auto',
                  minWidth: 0,
                }}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={isEditingMaxPrice ? maxPriceInputText : (maxPriceUnlimited ? '' : draftMaxPriceKip.toLocaleString('en-US'))}
                  placeholder="ບໍ່ຈຳກັດ"
                  onFocus={() => {
                    setIsEditingMaxPrice(true);
                    setMaxPriceInputText('');
                  }}
                  onChange={(event) => {
                    const parsed = parseDigitsInput(event.target.value);
                    if (parsed == null) {
                      setMaxPriceInputText('');
                      return;
                    }
                    const next = clampPrice(parsed, draftMinPriceKip, PRICE_INPUT_MAX_BOUND);
                    setMaxPriceUnlimited(false);
                    setDraftMaxPriceKip(next);
                    setIsSliderHandlesSwapped(false);
                    setMaxPriceInputText(next.toLocaleString('en-US'));
                  }}
                  onBlur={() => {
                    if (maxPriceInputText.trim().length === 0) {
                      setMaxPriceUnlimited(true);
                      setDraftMaxPriceKip(PRICE_MAX_BOUND);
                    }
                    setIsEditingMaxPrice(false);
                    setMaxPriceInputText('');
                  }}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid #d0d5dd',
                    padding: '0 42px 0 10px',
                    fontFamily: LAO_FONT,
                    fontSize: 13,
                    color: '#111111',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontFamily: LAO_FONT,
                    fontSize: 13,
                    color: '#667085',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ກີບ
                </span>
              </div>
            </div>
          </div>
          <div className="home-price-slider" style={{ position: 'relative', height: 30 }}>
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
              min={PRICE_MIN_BOUND}
              max={PRICE_MAX_BOUND}
              step={PRICE_STEP_LOW}
              value={sliderPrimaryThumbValue}
              onChange={(event) => {
                const raw = Number(event.target.value);
                const snapped = snapPriceToTier(raw);
                const next = clampPrice(snapped, PRICE_MIN_BOUND, PRICE_MAX_BOUND);
                if (!isSliderHandlesSwapped) {
                  if (next > sliderMaxValue) {
                    setDraftMinPriceKip(sliderMaxValue);
                    setDraftMaxPriceKip(next);
                    setMaxPriceUnlimited(next >= PRICE_MAX_BOUND);
                    setIsSliderHandlesSwapped(true);
                    return;
                  }
                  setDraftMinPriceKip(next);
                  return;
                }

                if (next < sliderMinValue) {
                  setDraftMaxPriceKip(sliderMinValue);
                  setDraftMinPriceKip(next);
                  setMaxPriceUnlimited(sliderMinValue >= PRICE_MAX_BOUND);
                  setIsSliderHandlesSwapped(false);
                  return;
                }

                if (next >= PRICE_MAX_BOUND) {
                  setMaxPriceUnlimited(true);
                  setDraftMaxPriceKip(PRICE_MAX_BOUND);
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
              min={PRICE_MIN_BOUND}
              max={PRICE_MAX_BOUND}
              step={PRICE_STEP_LOW}
              value={sliderSecondaryThumbValue}
              onChange={(event) => {
                const raw = Number(event.target.value);
                const snapped = snapPriceToTier(raw);
                const next = clampPrice(snapped, PRICE_MIN_BOUND, PRICE_MAX_BOUND);
                if (!isSliderHandlesSwapped) {
                  if (next < sliderMinValue) {
                    setDraftMinPriceKip(next);
                    setDraftMaxPriceKip(sliderMinValue);
                    setMaxPriceUnlimited(sliderMinValue >= PRICE_MAX_BOUND);
                    setIsSliderHandlesSwapped(true);
                    return;
                  }

                  if (next >= PRICE_MAX_BOUND) {
                    setMaxPriceUnlimited(true);
                    setDraftMaxPriceKip(PRICE_MAX_BOUND);
                    return;
                  }

                  setMaxPriceUnlimited(false);
                  setDraftMaxPriceKip(next);
                  return;
                }

                if (next > sliderMaxValue) {
                  setDraftMaxPriceKip(next);
                  setDraftMinPriceKip(sliderMaxValue);
                  setMaxPriceUnlimited(next >= PRICE_MAX_BOUND);
                  setIsSliderHandlesSwapped(false);
                  return;
                }

                setDraftMinPriceKip(next);
              }}
              className="home-price-range home-price-range-max"
              aria-label="Max price"
            />
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }} />
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
            style={{
              position: 'absolute',
              right: 8,
              top: `${(triggerRect?.bottom ?? 140) + 8}px`,
              width: 'min(208px, 70vw)',
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