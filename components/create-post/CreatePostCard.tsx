'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { PhotoPreviewGrid } from '@/components/PhotoPreviewGrid';
import { LayoutPreviewSelector } from './LayoutPreviewSelector';
import { PHOTO_GRID_GAP } from '@/utils/layoutConstants';

const actionIconStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#4b5563',
  flexShrink: 0,
};

const ActionLineIcon = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ display: 'block' }}
  >
    {children}
  </svg>
);

const privateNoteIcon = (
  <ActionLineIcon>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8" />
    <path d="M8 12h8" />
    <path d="M8 16h5" />
  </ActionLineIcon>
);

interface CreatePostCardProps {
  selectedPrivateShop?: {
    shop_name: string | null;
    shop_phone: string | null;
  } | null;
  onClearPrivateShop?: () => void;
  userProfile: any;
  session: any;
  caption: string;
  setCaption: (value: string) => void;
  carPrice: string;
  setCarPrice: (value: string) => void;
  carCurrency: '₭' | '฿' | '$';
  setCarCurrency: (value: '₭' | '฿' | '$') => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  previews: string[];
  onImageClick: () => void;
  onRemoveImage: (index: number) => void;
  layout: string;
  onLayoutChange: (layout: string) => void;
}

export const CreatePostCard = React.memo<CreatePostCardProps>(
  ({
    selectedPrivateShop,
    onClearPrivateShop,
    userProfile,
    session,
    caption,
    setCaption,
    carPrice,
    setCarPrice,
    carCurrency,
    setCarCurrency,
    textareaRef,
    previews,
    onImageClick,
    onRemoveImage,
    layout,
    onLayoutChange,
  }) => {
    const router = useRouter();
    const formattedCarPrice = carPrice ? Number(carPrice).toLocaleString('en-US') : '';
    const currencyOptions: Array<'₭' | '฿' | '$'> = ['₭', '฿', '$'];
    const privateNoteSummary = (() => {
      const noteName = selectedPrivateShop?.shop_name?.trim();
      if (noteName) return noteName;

      const rawPhone = selectedPrivateShop?.shop_phone?.trim();
      if (!rawPhone) return '';
      if (rawPhone.startsWith('85620') && rawPhone.length === 13) {
        return `020${rawPhone.slice(5)}`;
      }
      return rawPhone;
    })();

    return (
      <div>
        <div
          style={{
            padding: '12px 15px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Avatar avatarUrl={userProfile?.avatar_url} size={50} session={session} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 'bold',
                fontSize: '18px',
                lineHeight: '24px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userProfile?.username || 'User'}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '0 15px 15px 15px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <textarea
              ref={textareaRef}
              autoFocus
              style={{
                width: '100%',
                minHeight: '24px',
                height: '24px',
                border: 'none',
                outline: 'none',
                fontSize: '16px',
                lineHeight: '1.5',
                resize: 'none',
                color: '#000',
                overflow: 'hidden',
                padding: '0',
              }}
              placeholder="ລາຍລະອຽດ..."
              value={caption}
              onKeyDown={(e) => {
                const currentLines = caption.split('\n');
                const currentLineCount = currentLines.length;

                // ถ้ามี 15 แถวแล้ว
                if (currentLineCount >= 15) {
                  // ห้ามกด Enter เพื่อขึ้นแถวใหม่
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    return;
                  }

                  // อนุญาตเฉพาะ Backspace, Delete, Arrow keys, และ modifier keys (Ctrl, Cmd, Alt)
                  // ห้ามพิมพ์ตัวอักษรอื่นๆ ทั้งหมด
                  const allowedKeys = [
                    'Backspace',
                    'Delete',
                    'ArrowLeft',
                    'ArrowRight',
                    'ArrowUp',
                    'ArrowDown',
                    'Home',
                    'End',
                    'Tab',
                  ];
                  const isModifierKey = e.ctrlKey || e.metaKey || e.altKey;

                  if (!allowedKeys.includes(e.key) && !isModifierKey && e.key.length === 1) {
                    e.preventDefault();
                    return;
                  }
                }
              }}
              onPaste={(e) => {
                const currentLines = caption.split('\n');
                const currentLineCount = currentLines.length;

                // ถ้ามี 15 แถวแล้ว ห้าม paste เลย
                if (currentLineCount >= 15) {
                  e.preventDefault();
                  return;
                }

                e.preventDefault();
                const pastedText = e.clipboardData.getData('text');

                // ใส่ข้อความที่ paste ลงในตำแหน่ง cursor
                const target = e.target as HTMLTextAreaElement;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const currentText = caption;
                const newText =
                  currentText.substring(0, start) + pastedText + currentText.substring(end);

                // ตรวจสอบจำนวนแถวรวมและตัดให้เหลือ 15 แถวแรกเสมอ
                const allLines = newText.split('\n');
                const finalLines = allLines.slice(0, 15);
                const finalText = finalLines.join('\n');

                // อัพเดท state
                setCaption(finalText);

                // อัพเดท textarea value โดยตรงเพื่อป้องกันการแสดงข้อความเกิน
                if (textareaRef.current) {
                  textareaRef.current.value = finalText;

                  // อัพเดทความสูง
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;

                  // คืน cursor position (ปรับให้ไม่เกินความยาวใหม่)
                  const newCursorPosition = Math.min(start + pastedText.length, finalText.length);
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.setSelectionRange(
                        newCursorPosition,
                        newCursorPosition,
                      );
                    }
                  }, 0);
                }
              }}
              onChange={(e) => {
                const newValue = e.target.value;
                const lines = newValue.split('\n');

                // ตัดให้เหลือ 15 แถวเสมอ ไม่ว่าจะมาในรูปแบบไหน
                const limitedLines = lines.slice(0, 15);
                const limitedValue = limitedLines.join('\n');

                // อัพเดท state
                setCaption(limitedValue);

                // อัพเดท textarea value โดยตรงเพื่อป้องกันการแสดงข้อความเกิน
                if (textareaRef.current && textareaRef.current.value !== limitedValue) {
                  const cursorPosition = textareaRef.current.selectionStart;
                  textareaRef.current.value = limitedValue;

                  // คืน cursor position (ปรับให้ไม่เกินความยาวใหม่)
                  const newCursorPosition = Math.min(cursorPosition, limitedValue.length);
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.setSelectionRange(
                        newCursorPosition,
                        newCursorPosition,
                      );
                    }
                  }, 0);
                }

                // อัพเดทความสูงให้ขยายตามเนื้อหา
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                }
              }}
            />
            {caption.split('\n').length >= 15 && (
              <div
                style={{
                  color: '#ff4d4f',
                  fontSize: '12px',
                  marginTop: '5px',
                }}
              >
                ສູງສຸດ 15 ແຖວ
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: previews.length > 0 ? '0' : '0 15px 16px' }}>
          <div
            style={{
              padding: previews.length > 0 ? '0 12px 8px' : '0',
              display: 'flex',
              justifyContent: 'flex-start',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                padding: '8px 12px',
                borderRadius: '14px',
                border: '1px solid #d0d7de',
                background: '#ffffff',
                maxWidth: '100%',
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                value={formattedCarPrice}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setCarPrice(digitsOnly);
                }}
                placeholder="ກະລຸນາໃສ່ລາຄາ"
                style={{
                  minWidth: '160px',
                  width: 'clamp(160px, 46vw, 240px)',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '18px',
                  lineHeight: '24px',
                  fontWeight: 700,
                  color: '#111111',
                  padding: '2px 0',
                }}
              />
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {currencyOptions.map((option) => {
                  const isActive = carCurrency === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCarCurrency(option)}
                      style={{
                        border: 'none',
                        borderRadius: '999px',
                        minWidth: '38px',
                        minHeight: '38px',
                        padding: '8px 12px',
                        background: isActive ? '#1877f2' : '#ffffff',
                        color: isActive ? '#ffffff' : '#4a4d52',
                        fontSize: '16px',
                        lineHeight: '18px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: isActive ? 'none' : 'inset 0 0 0 1px #d0d7de',
                      }}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {previews.length > 0 && (
            <PhotoPreviewGrid
              existingImages={[]}
              newPreviews={previews}
              onImageClick={onImageClick}
              onRemoveImage={onRemoveImage}
              showRemoveButton={false}
              layout={previews.length >= 6 ? layout : 'default'}
              gap={PHOTO_GRID_GAP}
            />
          )}

          {previews.length >= 6 && (
            <div style={{ marginBottom: '-12px' }}>
              <LayoutPreviewSelector
                selectedLayout={layout}
                onLayoutChange={onLayoutChange}
                previews={previews}
              />
            </div>
          )}

          {previews.length > 0 && (
            <div
              style={{
                padding: '0 15px 16px',
                paddingTop: '0',
                display: 'flex',
                flexDirection: 'column',
                gap: '0',
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => router.push('/create-post/private-note')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push('/create-post/private-note');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#4b5563',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <span style={actionIconStyle}>{privateNoteIcon}</span>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span style={{ color: '#4b5563', flexShrink: 0 }}>ໂນດສ່ວນຕົວ</span>
                  {privateNoteSummary ? (
                    <>
                      <span
                        style={{
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: '#1877f2',
                          fontWeight: 700,
                        }}
                      >
                        {privateNoteSummary}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onClearPrivateShop?.();
                        }}
                        aria-label="ลบโน๊ดส่วนตัว"
                        title="ลบโน๊ดส่วนตัว"
                        style={{
                          border: '1px solid #fecaca',
                          background: '#fff1f2',
                          color: '#e11d48',
                          width: '22px',
                          height: '22px',
                          borderRadius: '999px',
                          cursor: 'pointer',
                          padding: 0,
                          marginLeft: '4px',
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      </button>
                    </>
                  ) : null}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

CreatePostCard.displayName = 'CreatePostCard';

