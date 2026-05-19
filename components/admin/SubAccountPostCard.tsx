'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PostCard } from '@/components/PostCard';
import { ChangePostPriceModal } from '@/components/modals/ChangePostPriceModal';

interface SubAccountPostCardProps {
  post: any;
  index: number;
  onUpdate?: (postId: string, data: any) => Promise<void> | void;
  onLocalUpdate?: (postId: string, data: Record<string, unknown>) => void;
  onClear?: (postId: string) => Promise<void> | void;
  isSaving?: boolean;
  session?: any;
  isClearedTab?: boolean;
}

export const SubAccountPostCard = React.memo<SubAccountPostCardProps>(({
  post,
  index,
  onUpdate,
  onLocalUpdate,
  onClear,
  isSaving = false,
  session,
  isClearedTab = false,
}) => {
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(post?.caption || '');
  const [saveError, setSaveError] = useState('');
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

  const [activeMenuState, setActiveMenuState] = useState<string | null>(null);
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);
  const menuButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  const savedPosts = useMemo(() => ({}), []);
  const justSavedPosts = useMemo(() => ({}), []);

  const hasCaptionChanges = captionDraft.trim() !== String(post?.caption || '').trim();

  const handleCancelCaptionEdit = useCallback(() => {
    setCaptionDraft(String(post?.caption || ''));
    setSaveError('');
    setIsEditingCaption(false);
  }, [post]);

  const handleSaveCaption = useCallback(async () => {
    if (!hasCaptionChanges || isSaving || !onUpdate) return;
    setSaveError('');
    try {
      await onUpdate(post.id, { caption: captionDraft.trim() });
      setIsEditingCaption(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'ບໍ່ສາມາດບັນທຶກ caption ໄດ້');
    }
  }, [hasCaptionChanges, isSaving, onUpdate, post.id, captionDraft]);

  const handleClear = useCallback(async () => {
    if (!onClear || isSaving || isClearedTab) return;
    const confirmed = window.confirm('ຢືນຢັນເຄລຍໂພສນີ້?');
    if (!confirmed) return;
    await onClear(post.id);
  }, [onClear, isSaving, isClearedTab, post.id]);

  const captionNode = (
    <div style={{ padding: '0 15px 8px 15px', marginBottom: '6px', position: 'relative' }}>
      {isEditingCaption ? (
        <>
          <textarea
            value={captionDraft}
            onChange={(e) => {
              setCaptionDraft(e.target.value);
              setSaveError('');
            }}
            placeholder="ໃສ່ຮາຍລະອຽດ..."
            style={{
              width: '100%',
              minHeight: '84px',
              padding: '10px 12px',
              border: '2px solid #1877f2',
              borderRadius: '10px',
              fontSize: '15px',
              lineHeight: '21px',
              fontWeight: 500,
              resize: 'vertical',
              outline: 'none',
              background: '#ffffff',
              color: '#111111',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={handleCancelCaptionEdit}
              disabled={isSaving}
              style={{
                border: '1px solid #d1d5db',
                borderRadius: '999px',
                padding: '8px 14px',
                background: '#ffffff',
                color: '#111111',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              ຍົກເລີກ
            </button>

            <button
              type="button"
              onClick={handleSaveCaption}
              disabled={!hasCaptionChanges || isSaving}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '8px 14px',
                background: !hasCaptionChanges || isSaving ? '#9fc5ff' : '#1877f2',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: !hasCaptionChanges || isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
            </button>
          </div>
        </>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsEditingCaption(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setIsEditingCaption(true);
            }
          }}
          style={{
            padding: '6px 0',
            fontSize: '15px',
            lineHeight: '21px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#111111',
            fontWeight: 500,
            cursor: 'text',
            borderRadius: '8px',
          }}
        >
          {captionDraft || '(ບໍ່ມີຮາຍລະອຽດ)'}
        </div>
      )}

      {!isEditingCaption && hasCaptionChanges && (
        <button
          type="button"
          onClick={handleSaveCaption}
          disabled={isSaving}
          style={{
            position: 'absolute',
            right: '15px',
            top: isEditingCaption ? '10px' : '8px',
            border: 'none',
            borderRadius: '999px',
            padding: '8px 14px',
            background: '#1877f2',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 700,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.7 : 1,
            zIndex: 2,
          }}
        >
          {isSaving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
        </button>
      )}

      {saveError ? (
        <div style={{ marginTop: '6px', fontSize: '13px', color: '#d93025' }}>{saveError}</div>
      ) : null}
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PostCard
            post={post}
            index={index}
            isLastElement={false}
            showMenuButton={false}
            session={session}
            savedPosts={savedPosts}
            justSavedPosts={justSavedPosts}
            activeMenuState={activeMenuState}
            isMenuAnimating={isMenuAnimating}
            menuButtonRefs={menuButtonRefs as React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>}
            onViewPost={() => {}}
            onSave={() => {}}
            onShare={() => {}}
            onTogglePostStatus={() => {}}
            onDeletePost={() => {}}
            onReport={() => {}}
            onSetActiveMenu={setActiveMenuState}
            onSetMenuAnimating={setIsMenuAnimating}
            customCaption={captionNode}
            onPriceClick={() => setIsPriceModalOpen(true)}
          />
        </div>

        <div style={{ width: '112px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleClear}
            disabled={isSaving || isClearedTab}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 12px',
              background: isClearedTab ? '#e5e7eb' : '#111111',
              color: isClearedTab ? '#6b7280' : '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: isSaving || isClearedTab ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
            }}
          >
            {isClearedTab ? 'ເຄລຍແລ້ວ' : 'clear'}
          </button>
        </div>
      </div>

      <ChangePostPriceModal
        isOpen={isPriceModalOpen}
        postId={String(post.id)}
        price={post.price}
        currency={post.price_currency}
        onClose={() => setIsPriceModalOpen(false)}
        onSaved={(changes) => {
          if (changes && onLocalUpdate) {
            onLocalUpdate(post.id, changes);
          }
        }}
      />
    </>
  );
});

SubAccountPostCard.displayName = 'SubAccountPostCard';
