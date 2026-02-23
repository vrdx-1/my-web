'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { LAO_PROVINCES, LAO_FONT } from '@/utils/constants';
import { useHomeProvince } from '@/contexts/HomeProvinceContext';

const CONTROL_SIZE = 40;
const ICON_SIZE = 20;
const SEARCH_BAR_GAP = 10; // ช่องว่างระหว่างแท็บค้นหา กับ ปุ่มฟิลเตอร์ (ให้แท็บค้นหาสั้นลง ไม่ชิดเกินไป)

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

  useEffect(() => {
    setMounted(true);
  }, []);

  const queryToShow = mounted ? searchQuery : '';
  const provinceToShow = mounted ? selectedProvince : '';

  const handleSearchClick = () => {
    router.push('/search', { scroll: false });
  };

  const handleFilterClick = () => {
    const rect = filterButtonRef.current?.getBoundingClientRect() ?? null;
    setFilterButtonRect(rect);
    setShowProvincePicker(true);
    setIsAnimating(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsAnimating(false));
    });
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

  useEffect(() => {
    if (!showProvincePicker) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [showProvincePicker]);

  useEffect(() => {
    if (!showProvincePicker) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = (e.target ?? (e as TouchEvent).touches?.[0]?.target) as HTMLElement;
      if (!target?.closest?.('[data-home-province-picker]') && !target?.closest?.('[data-home-filter-btn]')) {
        closePicker();
      }
    };
    document.addEventListener('mousedown', handleClickOutside as EventListener);
    document.addEventListener('touchstart', handleClickOutside as EventListener);
    return () => {
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
          {queryToShow.trim() && (
            <>
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
            </>
          )}
        </button>

        {/* ปุ่มฟิลเตอร์ province — ด้านขวา (ไอคอนสไลด์/ฟิลเตอร์ แบบทันสมัย) */}
        <button
          ref={filterButtonRef}
          type="button"
          data-home-filter-btn
          onClick={handleFilterClick}
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

      {/* Province picker — เด้งใกล้ปุ่มฟิลเตอร์, overlay เต็มหน้าจอ, ปิดได้ด้วยคลิก overlay หรือ scroll (เหมือนปุ่มไข่ปลา) */}
      {showProvincePicker &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              pointerEvents: 'none',
            }}
          >
            {/* Overlay เต็มหน้าจอ — คลิกปิด; overflow: hidden ให้ background ไม่เลื่อนตามเมื่อเลื่อน picker */}
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.4)',
                zIndex: 10001,
                pointerEvents: 'auto',
                overflow: 'hidden',
              }}
              onClick={closePicker}
            />
            {/* ป๊อบอัพแขวง — วางใกล้ปุ่มฟิลเตอร์ (ใต้ปุ่ม, ชิดขวา) */}
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
                      const w = Math.min(280, typeof window !== 'undefined' ? window.innerWidth * 0.88 : 280);
                      const maxH = typeof window !== 'undefined' ? window.innerHeight * 0.84 : 560;
                      const left = Math.max(8, filterButtonRect.right - w);
                      const top = filterButtonRect.bottom + gap;
                      const bottomSpace = typeof window !== 'undefined' ? window.innerHeight - top : maxH;
                      const height = Math.min(maxH, Math.max(200, bottomSpace - 8));
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
                overflowY: 'auto',
                touchAction: 'manipulation',
                transform: isAnimating ? 'scale(0.96)' : 'scale(1)',
                opacity: isAnimating ? 0 : 1,
                transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
                pointerEvents: 'auto',
              }}
            >
              <div
                onClick={() => handleSelectProvince('')}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: '15px',
                  lineHeight: '1.35',
                  background: selectedProvince === '' ? '#e7f3ff' : '#fff',
                  cursor: 'pointer',
                  fontFamily: LAO_FONT,
                  color: '#111111',
                }}
              >
                ທຸກແຂວງ {selectedProvince === '' && ' ✓'}
              </div>
              {LAO_PROVINCES.map((p) => (
                <div
                  key={p}
                  onClick={() => handleSelectProvince(p)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: '15px',
                    lineHeight: '1.35',
                    background: selectedProvince === p ? '#e7f3ff' : '#fff',
                    cursor: 'pointer',
                    fontFamily: LAO_FONT,
                    color: '#111111',
                  }}
                >
                  {p} {selectedProvince === p && ' ✓'}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
