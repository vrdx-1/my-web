'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { LAO_PROVINCES, LAO_FONT } from '@/utils/constants';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { useHomeProvince } from '@/contexts/HomeProvinceContext';

/** ให้ปุ่มฟิลเตอร์และแถบค้น co สูงเท่าโลโก้ใน header */
const CONTROL_SIZE = LAYOUT_CONSTANTS.HEADER_LOGO_SIZE;
const ICON_SIZE = 20;
const SEARCH_BAR_GAP = 10; // ช่องว่างระหว่างแท็บค้นหา กับ ปุ่มฟิลเตอร์ (ให้แท็บค้นหาสั้นลง ไม่ชิดเกินไป)
const PROVINCE_ROW_HEIGHT = 32; // ความสูงต่อแถว (6+6 + 15*1.3) สำหรับอ้างอิง

/**
 * แท็บค้นหา (ยาว ซ้ายเกือบติดโลโก้ ขวาเกือบติดปุ่มฟิลเตอร์) และปุ่มฟิลเตอร์ province สำหรับ Header หน้า Home
 */
export function HomeHeaderSearchAndFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const homeProvince = useHomeProvince();
  const selectedProvince = homeProvince?.selectedProvince ?? '';
  const setSelectedProvince = homeProvince?.setSelectedProvince ?? (() => {});

  const [mounted, setMounted] = useState(false);
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [filterButtonRect, setFilterButtonRect] = useState<DOMRect | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  /** กันไม่ให้การกดที่เปิดป๊อปถูกนับเป็นคลิกนอก (ต้องกดครั้งเดียวแล้วเปิดได้เสถียร) */
  const justOpenedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const queryToShow = mounted ? searchQuery : '';
  const provinceToShow = mounted ? selectedProvince : '';

  /** เมื่อผู้ใช้เปลี่ยนหรือแก้ไขคำค้นหา (URL ?q= เปลี่ยน) ให้ฟิลเตอร์กลับเป็น "ທຸກແຂວງ" */
  useEffect(() => {
    setSelectedProvince('');
  }, [searchQuery, setSelectedProvince]);

  const handleSearchClick = () => {
    const q = searchQuery?.trim() ?? '';
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search', { scroll: false });
  };

  const handleFilterClick = () => {
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
  };

  const closePicker = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowProvincePicker(false);
      setIsAnimating(false);
    }, 300);
  };

  const handleSelectProvince = (p: string) => {
    setSelectedProvince(p);
    closePicker();
  };

  // ปิดป๊อปอัพเมื่อเลื่อนหน้าจอ — แบบเดียวกับปุ่มไข่ปลา (useMenu)
  useEffect(() => {
    if (!showProvincePicker) return;
    const handleScroll = () => {
      setIsAnimating(true);
      setTimeout(() => {
        setShowProvincePicker(false);
        setIsAnimating(false);
      }, 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showProvincePicker]);

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
  }, [showProvincePicker]);

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
          onClick={handleSearchClick}
          aria-label="Search"
          style={{
            flex: 1,
            minWidth: 0,
            height: `${CONTROL_SIZE}px`,
            borderRadius: '20px',
            background: '#e4e6eb',
            color: '#000',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingLeft: '12px',
            paddingRight: '12px',
            touchAction: 'manipulation',
          }}
        >
          <svg
            width={ICON_SIZE}
            height={ICON_SIZE}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
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
              flexShrink: 0,
              fontSize: '15px',
              color: queryToShow.trim() ? '#111' : '#65676b',
              fontFamily: LAO_FONT,
            }}
          >
            {queryToShow.trim() || 'ຄົ້ນຫາ'}
          </span>
          <span style={{ flex: 1, minWidth: 8 }} aria-hidden />
          <span
            style={{
              flexShrink: 0,
              fontSize: '14px',
              color: '#c00',
              fontFamily: LAO_FONT,
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {provinceToShow === '' ? 'ທຸກແຂວງ' : provinceToShow}
          </span>
        </button>

        {/* ปุ่มฟิลเตอร์ province — เปิดด้วยคลิกเดียว (ไม่ใช้ pointerDown + preventDefault เพื่อให้มือถือตอบสนองครั้งเดียว) */}
        <button
          ref={filterButtonRef}
          type="button"
          data-home-filter-btn
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleFilterClick();
          }}
          aria-label="Filter by province"
          style={{
            width: `${CONTROL_SIZE}px`,
            height: `${CONTROL_SIZE}px`,
            borderRadius: '50%',
            background: '#e4e6eb',
            color: '#000',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            touchAction: 'manipulation',
          }}
        >
          <svg
            width={ICON_SIZE}
            height={ICON_SIZE}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="6" cy="8" r="2" fill="currentColor" />
            <line x1="8" y1="8" x2="20" y2="8" />
            <line x1="4" y1="16" x2="16" y2="16" />
            <circle cx="18" cy="16" r="2" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* Province picker — สร้างไว้ล่วงหน้า (เมื่อ mounted) แล้วแค่สลับแสดง/ซ่อน ตอนกดจะเร็วเหมือนเว็บระดับโลก */}
      {mounted && typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              pointerEvents: showProvincePicker ? 'none' : 'none',
              visibility: showProvincePicker ? 'visible' : 'hidden',
              opacity: showProvincePicker ? 1 : 0,
              transition: 'opacity 0.15s ease-out',
            }}
          >
            {/* Overlay เต็มหน้าจอ — คลิกปิด; ไม่ล็อก scroll (ให้ปิดเมื่อเลื่อนเหมือนปุ่มไข่ปลา) */}
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
              onClick={closePicker}
            />
            {/* ป๊อบอัพแขวง — ตัวกรอบ scroll ไม่ได้, ให้เฉพาะรายการด้านใน scroll ได้ */}
            <div
              ref={pickerRef}
              data-home-province-picker
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                ...(filterButtonRect
                  ? (() => {
                      const gap = 8;
                      const w =
                        typeof window !== 'undefined'
                          ? Math.min(220, Math.round(window.innerWidth * 0.62))
                          : 220;
                      const left = Math.max(8, filterButtonRect.right - w);
                      const top = filterButtonRect.bottom + gap;
                      const fullHeight =
                        typeof window !== 'undefined' ? window.innerHeight - top - gap : 500;
                      const height = Math.round(fullHeight * 0.92);
                      return {
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${w}px`,
                        height: `${height}px`,
                      };
                    })()
                  : { left: '50%', top: '8vh', bottom: '8vh', width: 'min(280px, 88vw)', marginLeft: 'min(-140px, -44vw)' }),
                background: '#fff',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                borderRadius: '12px',
                zIndex: 10002,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transform: showProvincePicker && !isAnimating ? 'scale(1)' : 'scale(0.96)',
                opacity: showProvincePicker && !isAnimating ? 1 : 0,
                transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
                pointerEvents: showProvincePicker ? 'auto' : 'none',
              }}
            >
              <div
                onClick={() => handleSelectProvince('')}
                style={{
                  padding: '10px 12px',
                  minHeight: 42,
                  boxSizing: 'border-box',
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: '16px',
                  lineHeight: '1.3',
                  background: selectedProvince === '' ? '#e7f3ff' : '#fff',
                  cursor: 'pointer',
                  fontFamily: LAO_FONT,
                  color: '#111111',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                ທຸກແຂວງ {selectedProvince === '' && ' ✓'}
              </div>
              <div
                style={{
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                  flex: 1,
                  minHeight: 0,
                  touchAction: 'pan-y',
                }}
              >
                {LAO_PROVINCES.map((p, i) => (
                  <div
                    key={p}
                    onClick={() => handleSelectProvince(p)}
                    style={{
                      padding: '6px 12px',
                      minHeight: 34,
                      boxSizing: 'border-box',
                      borderBottom: i === LAO_PROVINCES.length - 1 ? 'none' : '1px solid #f0f0f0',
                      fontSize: '15px',
                      lineHeight: '1.3',
                      background: selectedProvince === p ? '#e7f3ff' : '#fff',
                      cursor: 'pointer',
                      fontFamily: LAO_FONT,
                      color: '#111111',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {p} {selectedProvince === p && ' ✓'}
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
