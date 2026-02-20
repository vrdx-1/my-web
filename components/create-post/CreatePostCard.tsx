'use client';

import React from 'react';
import { Avatar } from '@/components/Avatar';
import { PhotoPreviewGrid } from '@/components/PhotoPreviewGrid';
import { LayoutPreviewSelector } from './LayoutPreviewSelector';

interface CreatePostCardProps {
  userProfile: any;
  session: any;
  caption: string;
  setCaption: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  previews: string[];
  onImageClick: () => void;
  onRemoveImage: (index: number) => void;
  layout: string;
  onLayoutChange: (layout: string) => void;
}

export const CreatePostCard = React.memo<CreatePostCardProps>(
  ({
    userProfile,
    session,
    caption,
    setCaption,
    textareaRef,
    previews,
    onImageClick,
    onRemoveImage,
    layout,
    onLayoutChange,
  }) => {
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
          <div style={{ width: '100%', maxWidth: '600px' }}>
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
        {previews.length > 0 && (
          <>
            <PhotoPreviewGrid
              existingImages={[]}
              newPreviews={previews}
              onImageClick={onImageClick}
              onRemoveImage={onRemoveImage}
              showRemoveButton={false}
              layout={previews.length >= 6 ? layout : 'default'}
            />
            {previews.length >= 6 && (
              <LayoutPreviewSelector
                selectedLayout={layout}
                onLayoutChange={onLayoutChange}
                previews={previews}
              />
            )}
          </>
        )}
      </div>
    );
  },
);

CreatePostCard.displayName = 'CreatePostCard';

