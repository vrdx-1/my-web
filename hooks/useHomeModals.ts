'use client'

import { useMemo } from 'react';

/**
 * Custom hook สำหรับจัดการ modals ในหน้า Home
 * รวม InteractionModal และ PostFeedModals props เพื่อลดความซับซ้อน
 */
export function useHomeModals({
  interactionModalHook,
  postFeedModalsProps,
  session,
}: {
  interactionModalHook: {
    interactionModal: { show: boolean; type: 'likes' | 'saves'; postId: string | null };
    interactionUsers: any[];
    interactionLoading: boolean;
    interactionSheetMode: 'half' | 'full' | 'hidden';
    isInteractionModalAnimating: boolean;
    startY: number;
    currentY: number;
    closeModal: () => void;
    onSheetTouchStart: (e: React.TouchEvent) => void;
    onSheetTouchMove: (e: React.TouchEvent) => void;
    onSheetTouchEnd: () => void;
  };
  postFeedModalsProps: any;
  session: any;
}) {
  const interactionModalProps = useMemo(() => ({
    show: interactionModalHook.interactionModal.show,
    type: interactionModalHook.interactionModal.type,
    postId: interactionModalHook.interactionModal.postId,
    interactionUsers: interactionModalHook.interactionUsers,
    interactionLoading: interactionModalHook.interactionLoading,
    interactionSheetMode: interactionModalHook.interactionSheetMode,
    isInteractionModalAnimating: interactionModalHook.isInteractionModalAnimating,
    startY: interactionModalHook.startY,
    currentY: interactionModalHook.currentY,
    onClose: interactionModalHook.closeModal,
    onSheetTouchStart: interactionModalHook.onSheetTouchStart,
    onSheetTouchMove: interactionModalHook.onSheetTouchMove,
    onSheetTouchEnd: interactionModalHook.onSheetTouchEnd,
  }), [
    interactionModalHook.interactionModal.show,
    interactionModalHook.interactionModal.type,
    interactionModalHook.interactionModal.postId,
    interactionModalHook.interactionUsers,
    interactionModalHook.interactionLoading,
    interactionModalHook.interactionSheetMode,
    interactionModalHook.isInteractionModalAnimating,
    interactionModalHook.startY,
    interactionModalHook.currentY,
  ]);

  return {
    interactionModalProps,
    postFeedModalsProps: {
      ...postFeedModalsProps,
      session,
    },
  };
}
