'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LAO_FONT } from '@/utils/constants';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { useHomeProvince } from '@/contexts/HomeProvinceContext';
import { HomeProvincePickerPortal } from '@/components/home/HomeProvincePickerPortal';

/** ให้ปุ่มฟิลเตอร์และแถบค้น co สูงเท่าโลโก้ใน header */
const CONTROL_SIZE = LAYOUT_CONSTANTS.HEADER_LOGO_SIZE;
const ICON_SIZE = 20;
const SEARCH_BAR_GAP = 8;
/**
 * แท็บค้นหา (ยาว ซ้ายเกือบติดโลโก้ ขวาเกือบติดปุ่มฟิลเตอร์) และปุ่มฟิลเตอร์ province สำหรับ Header หน้า Home
 */
export function HomeHeaderSearchAndFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const homeProvince = useHomeProvince();
  const selectedProvince = homeProvince?.selectedProvince ?? '';
  const setSelectedProvince = homeProvince?.setSelectedProvince;

  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [filterButtonRect, setFilterButtonRect] = useState<DOMRect | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  // Anchor สำหรับจัดตำแหน่งป๊อปอัป (เดิมใช้ปุ่มฟิลเตอร์วงกลม แต่รอบนี้ย้ายไปไว้ที่ "ข้อความแขวงสีแดง")
  const filterButtonRef = useRef<HTMLSpanElement>(null);
  /** กันไม่ให้การกดที่เปิดป๊อปถูกนับเป็นคลิกนอก (ต้องกดครั้งเดียวแล้วเปิดได้เสถียร) */
  const justOpenedRef = useRef(false);

  /** แสดงคำค้นและแขวงเสมอ (ไม่ใช้ mounted เพื่อไม่ให้ guest เห็นแถบค้นว่างชั่วคราว) */
  const queryToShow = searchQuery;
  const provinceToShow = selectedProvince;

  /** เมื่อผู้ใช้เปลี่ยนหรือแก้ไขคำค้นหา (URL ?q= เปลี่ยน) ให้ฟิลเตอร์กลับเป็น "ທຸກແຂວງ" */
  useEffect(() => {
    setSelectedProvince?.('');
  }, [searchQuery, setSelectedProvince]);

  const handleSearchClick = useCallback(() => {
    const q = searchQuery?.trim() ?? '';
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search', { scroll: false });
  }, [router, searchQuery]);

  const handleFilterClick = useCallback(() => {
    if (showProvincePicker) return;
    const rect = filterButtonRef.current?.getBoundingClientRect() ?? null;
    setFilterButtonRect(rect);
    justOpenedRef.current = true;
    // แสดงป๊อปทันทีโดยไม่รอ — ใช้ requestAnimationFrame แยกให้เบราว์เซอร์วาดป๊อปก่อนงานอื่น
    requestAnimationFrame(() => {
      setShowProvincePicker(true);
      requestAnimationFrame(() => {
        setIsAnimating(false);
      });
    });
    setIsAnimating(true);
    setTimeout(() => {
      justOpenedRef.current = false;
    }, 250);
  }, [showProvincePicker]);

  const closePicker = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowProvincePicker(false);
      setIsAnimating(false);
    }, 300);
  }, []);

  const handleSelectProvince = useCallback((province: string) => {
    setSelectedProvince?.(province);
    closePicker();
  }, [closePicker, setSelectedProvince]);

  // ปิดป๊อปอัพเมื่อเลื่อนหน้าจอ — แบบเดียวกับปุ่มไข่ปลา (useMenu)
  useEffect(() => {
    if (!showProvincePicker) return;
    const handleScroll = () => closePicker();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showProvincePicker, closePicker]);

  // ปิดป๊อปอัพเมื่อคลิกนอก — แบบเดียวกับปุ่มไข่ปลา (useMenu: ไม่ล็อก body, ใช้ mousedown/touchstart)
  useEffect(() => {
    if (!showProvincePicker) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (justOpenedRef.current) return;
      const target = (e.target ?? (e as TouchEvent).touches?.[0]?.target) as HTMLElement;
      if (!target?.closest?.('[data-home-province-picker]') && !target?.closest?.('[data-home-filter-btn]')) {
        closePicker();
      }
    };
    const timerId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside as EventListener);
      document.addEventListener('touchstart', handleClickOutside as EventListener);
    }, 120);
    return () => {
      clearTimeout(timerId);
      document.removeEventListener('mousedown', handleClickOutside as EventListener);
      document.removeEventListener('touchstart', handleClickOutside as EventListener);
    };
  }, [showProvincePicker, closePicker]);

  return (
    <>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: SEARCH_BAR_GAP,
          paddingLeft: 0,
          paddingRight: 0,
        }}
      >
        {/* แท็บค้นหา — ยาวจากซ้ายเกือบติดโลโก้ ถึงขวาเกือบติดปุ่มฟิลเตอร์, มีไอคอน + "ຄົ້ນຫາ" */}
        <button
          type="button"
          onClick={(e) => {
            // ปุ่มค้นหาครอบทั้งแถบไว้ ทำให้ click พลาด "ตัวหนังสือสีแดงเลือกแขวง" แล้วไป trigger ค้นหาได้
            // ถ้า click อยู่ในพื้นที่ปุ่มแขวง (มี tolerance) ให้เปิด province picker แทน
            const target = e.target;
            const el = target instanceof Element ? target : null;
            const filterBtnHit =
              !!el?.closest?.('[data-home-filter-btn]') ||
              (() => {
                const rect = filterButtonRef.current?.getBoundingClientRect();
                if (!rect) return false;
                const tolerance = 16; // เผื่อพื้นที่คลิกกรณีไม่โดนตัวอักษรเป๊ะ
                const x = e.clientX;
                const y = e.clientY;
                return (
                  x >= rect.left - tolerance &&
                  x <= rect.right + tolerance &&
                  y >= rect.top - tolerance &&
                  y <= rect.bottom + tolerance
                );
              })();

            if (filterBtnHit) {
              e.preventDefault();
              e.stopPropagation();
              handleFilterClick();
              return;
            }

            handleSearchClick();
          }}
          aria-label="Search"
          style={{
            flex: 1,
            minWidth: 0,
            height: `${Math.max(CONTROL_SIZE + 2, 42)}px`,
            borderRadius: '999px',
            background: '#ffffff',
            color: '#1f2937',
            border: '1px solid #d0d5dd',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            paddingLeft: '13px',
            paddingRight: '11px',
            touchAction: 'manipulation',
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
              flex: 1,
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
                fontSize: '15px',
                color: queryToShow.trim() ? '#101828' : '#7b818d',
                fontFamily: LAO_FONT,
              }}
            >
              {queryToShow.trim() || 'ຄົ້ນຫາ'}
            </span>
          </span>
          <span
            style={{
              flexShrink: 0,
              fontSize: '15px',
              color: '#4a4d52',
              fontWeight: 500,
              fontFamily: LAO_FONT,
              maxWidth: '140px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            ref={filterButtonRef}
            data-home-filter-btn
            role="button"
            tabIndex={0}
            onClick={(e) => {
              // ไม่ให้งานคลิกนี้ไป trigger search button ข้างนอก
              e.preventDefault();
              e.stopPropagation();
              handleFilterClick();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                handleFilterClick();
              }
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {provinceToShow === '' ? 'ທຸກແຂວງ' : provinceToShow}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
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

      <HomeProvincePickerPortal
        showProvincePicker={showProvincePicker}
        isAnimating={isAnimating}
        filterButtonRect={filterButtonRect}
        pickerRef={pickerRef}
        selectedProvince={selectedProvince}
        onClose={closePicker}
        onSelectProvince={handleSelectProvince}
      />
    </>
  );
}
