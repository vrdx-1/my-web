'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LAO_FONT } from '@/utils/constants';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { useHomeProvince } from '@/contexts/HomeProvinceContext';
import { useMainTabScroll } from '@/contexts/MainTabScrollContext';
import { HomeProvincePickerPortal } from '@/components/home/HomeProvincePickerPortal';
import { useSessionProfileContext } from '@/contexts/SessionProfileContext';
import { getOrCreateGuestToken } from '@/utils/guestToken';
import { mergeHeaders } from '@/utils/activeProfile';
import type { CurrencySymbol } from '@/utils/exchangeRates';
import type { HomePriceSortOrder } from '@/contexts/HomeProvinceContext';

/** ให้ปุ่มฟิลเตอร์และแถบค้น co สูงเท่าโลโก้ใน header */
const CONTROL_SIZE = LAYOUT_CONSTANTS.HEADER_LOGO_SIZE + 6;
const ICON_SIZE = 21;
const SEARCH_BAR_GAP = 10;
const FILTER_ICON_SIZE = 19;
/**
 * แท็บค้นหา (ยาว ซ้ายเกือบติดโลโก้ ขวาเกือบติดปุ่มฟิลเตอร์) และปุ่มฟิลเตอร์ province สำหรับ Header หน้า Home
 */
export function HomeHeaderSearchAndFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const homeProvince = useHomeProvince();
  const mainTabScroll = useMainTabScroll();
  const selectedProvince = homeProvince?.selectedProvince ?? '';
  const minPriceKip = homeProvince?.minPriceKip ?? null;
  const maxPriceKip = homeProvince?.maxPriceKip ?? null;
  const minPriceDisplay = homeProvince?.minPriceDisplay ?? null;
  const maxPriceDisplay = homeProvince?.maxPriceDisplay ?? null;
  const priceSortOrder = homeProvince?.priceSortOrder ?? '';
  const displayCurrency = homeProvince?.displayCurrency ?? '₭';
  const hasActiveFilters = selectedProvince.trim().length > 0 || minPriceKip != null || maxPriceKip != null || priceSortOrder !== '';
  const setSelectedProvince = homeProvince?.setSelectedProvince;
  const setPriceRange = homeProvince?.setPriceRange;
  const setPriceSortOrder = homeProvince?.setPriceSortOrder;
  const setDisplayCurrency = homeProvince?.setDisplayCurrency;
  const { session, activeProfileId } = useSessionProfileContext() ?? {};

  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  /** แสดงคำค้นและแขวงเสมอ (ไม่ใช้ mounted เพื่อไม่ให้ guest เห็นแถบค้นว่างชั่วคราว) */
  const queryToShow = searchQuery;

  /** เมื่อผู้ใช้เปลี่ยนหรือแก้ไขคำค้นหา (URL ?q= เปลี่ยน) ให้ฟิลเตอร์กลับเป็น "ທຸກແຂວງ" */
  useEffect(() => {
    setSelectedProvince?.('');
    setPriceRange?.(null, null);
    setPriceSortOrder?.('');
  }, [searchQuery, setSelectedProvince, setPriceRange, setPriceSortOrder]);

  const handleSearchClick = useCallback(() => {
    mainTabScroll?.saveCurrentScroll('/home');
    // iOS Safari จะแสดงแป้นพิมพ์เฉพาะเมื่อ focus() อยู่ใน user gesture event เท่านั้น
    // เมื่อ router.push นำทางไปหน้าใหม่ กว่า useLayoutEffect จะ focus() input จริงก็พ้น gesture ไปแล้ว
    // แก้โดย: สร้าง temp input แล้ว focus() ทันทีใน handler นี้ (ยังอยู่ใน gesture context)
    // → iOS เปิดแป้นพิมพ์ขึ้นมา, พอหน้า search mount และ focus input จริง แป้นพิมพ์ยังอยู่
    if (typeof window !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      const tempInput = document.createElement('input');
      tempInput.setAttribute('type', 'text');
      tempInput.setAttribute('inputmode', 'search');
      tempInput.style.cssText =
        'position:fixed;top:-200px;left:-200px;opacity:0;width:1px;height:1px;font-size:16px;';
      document.body.appendChild(tempInput);
      tempInput.focus();
      // ลบออกหลังหน้าใหม่ mount และ focus input จริงแล้ว (~800ms เพียงพอ)
      setTimeout(() => {
        if (document.body.contains(tempInput)) document.body.removeChild(tempInput);
      }, 800);
    }
    const q = searchQuery?.trim() ?? '';
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search', { scroll: false });
  }, [mainTabScroll, router, searchQuery]);

  const handleFilterClick = useCallback(() => {
    if (showProvincePicker) return;
    // เปิดทันทีแบบไม่มี animation เพื่อให้ตอบสนองเร็วที่สุด
    setIsAnimating(false);
    setShowProvincePicker(true);
  }, [showProvincePicker]);

  const closePicker = useCallback(() => {
    // ปิดทันทีแบบไม่มี animation เพื่อให้ตอบสนองเร็วที่สุด
    setShowProvincePicker(false);
    setIsAnimating(false);
  }, []);

  const handleApplyFilters = useCallback((filters: {
    province: string;
    minPriceKip: number | null;
    maxPriceKip: number | null;
    minPriceDisplay: number | null;
    maxPriceDisplay: number | null;
    priceSortOrder: HomePriceSortOrder;
    displayCurrency: CurrencySymbol;
  }) => {
    setSelectedProvince?.(filters.province);
    setPriceRange?.(
      filters.minPriceKip,
      filters.maxPriceKip,
      filters.minPriceDisplay,
      filters.maxPriceDisplay,
    );
    setPriceSortOrder?.(filters.priceSortOrder);
    setDisplayCurrency?.(filters.displayCurrency);
    closePicker();

    // บันทึกประวัติการใช้ตัวกรอง (fire-and-forget)
    try {
      const accessToken = session?.access_token ?? '';
      const guestToken = !session?.user ? getOrCreateGuestToken() : '';
      fetch('/api/filter/log', {
        method: 'POST',
        credentials: 'include',
        headers: mergeHeaders(
          {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...(guestToken ? { 'x-guest-token': guestToken } : {}),
          },
          activeProfileId,
        ),
        body: JSON.stringify({
          province: filters.province || undefined,
          min_price_kip: filters.minPriceDisplay ?? undefined,
          max_price_kip: filters.maxPriceDisplay ?? undefined,
          display_currency: (filters.minPriceDisplay != null || filters.maxPriceDisplay != null) ? filters.displayCurrency : undefined,
          price_sort_order: filters.priceSortOrder === 'asc' || filters.priceSortOrder === 'desc'
            ? filters.priceSortOrder
            : undefined,
          latest_post_first: filters.priceSortOrder === 'latest' ? true : undefined,
          guest_token: guestToken || undefined,
        }),
      }).catch(() => {});
    } catch {
      // fire-and-forget — ไม่บล็อก UI
    }
  }, [activeProfileId, closePicker, session, setDisplayCurrency, setPriceRange, setPriceSortOrder, setSelectedProvince]);

  return (
    <>
      <div
        style={{
          flex: '1 1 0%',
          flexBasis: 0,
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: SEARCH_BAR_GAP,
          paddingLeft: 0,
          paddingRight: 0,
          overflow: 'hidden',
        }}
      >
        {/* แท็บค้นหา — ยาวจากซ้ายเกือบติดโลโก้ ถึงขวาเกือบติดปุ่มฟิลเตอร์, มีไอคอน + "ຄົ້ນຫາ" */}
        <button
          type="button"
          onClick={handleSearchClick}
          aria-label="Search"
          style={{
            flex: '1 1 0%',
            flexBasis: 0,
            minWidth: 0,
            width: '100%',
            maxWidth: '100%',
            height: `${CONTROL_SIZE}px`,
            borderRadius: '999px',
            background: '#ffffff',
            color: '#1f2937',
            border: '1px solid #d0d5dd',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            paddingLeft: '14px',
            paddingRight: '14px',
            // allow opening search/province immediately even while feed refresh runs in background
            touchAction: 'manipulation',
            pointerEvents: 'auto',
            overflow: 'hidden',
          }}
        >
          <svg
            width={ICON_SIZE}
            height={ICON_SIZE}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6b7280"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span
            style={{
              flex: '1 1 0%',
              flexBasis: 0,
              minWidth: 0,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                display: 'block',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '16px',
                color: queryToShow.trim() ? '#101828' : '#7b818d',
                fontFamily: LAO_FONT,
              }}
            >
              {queryToShow.trim() || 'ຄົ້ນຫາ'}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={handleFilterClick}
          aria-label="Filter"
          style={{
            position: 'relative',
            width: `${CONTROL_SIZE}px`,
            height: `${CONTROL_SIZE}px`,
            borderRadius: '50%',
            border: '1px solid #d0d5dd',
            background: '#ffffff',
            color: '#6b7280',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            touchAction: 'manipulation',
            pointerEvents: 'auto',
          }}
        >
          <svg
            width={FILTER_ICON_SIZE}
            height={FILTER_ICON_SIZE}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="3" y1="8" x2="21" y2="8" />
            <circle cx="9" cy="8" r="2.9" fill="#ffffff" stroke="currentColor" />
            <line x1="3" y1="16" x2="21" y2="16" />
            <circle cx="15" cy="16" r="2.9" fill="#ffffff" stroke="currentColor" />
          </svg>
          {hasActiveFilters && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#16a34a',
                border: '2.5px solid #ffffff',
                boxSizing: 'border-box',
              }}
            />
          )}
        </button>
      </div>

      <HomeProvincePickerPortal
        showProvincePicker={showProvincePicker}
        isAnimating={isAnimating}
        pickerRef={pickerRef}
        selectedProvince={selectedProvince}
        minPriceKip={minPriceKip}
        maxPriceKip={maxPriceKip}
        minPriceDisplay={minPriceDisplay}
        maxPriceDisplay={maxPriceDisplay}
        priceSortOrder={priceSortOrder}
        displayCurrency={displayCurrency}
        onClose={closePicker}
        onApplyFilters={handleApplyFilters}
      />
    </>
  );
}
