'use client'

import React from 'react';
import { SuccessPopup } from './SuccessPopup';
import { SAVE_POST_SUCCESS_EVENT, UNSAVE_POST_SUCCESS_EVENT } from '@/utils/savePostSuccessPopup';

export const SavePostSuccessPopupHost = React.memo(function SavePostSuccessPopupHost() {
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSaveOpen = () => {
      setMessage('ບັນທຶກສຳເລັດ');
    };
    const handleUnsaveOpen = () => {
      setMessage('ຍົກເລີກບັນທຶກສຳເລັດ');
    };

    window.addEventListener(SAVE_POST_SUCCESS_EVENT, handleSaveOpen as EventListener);
    window.addEventListener(UNSAVE_POST_SUCCESS_EVENT, handleUnsaveOpen as EventListener);
    return () => {
      window.removeEventListener(SAVE_POST_SUCCESS_EVENT, handleSaveOpen as EventListener);
      window.removeEventListener(UNSAVE_POST_SUCCESS_EVENT, handleUnsaveOpen as EventListener);
    };
  }, []);

  if (!message) return null;

  return (
    <SuccessPopup
      message={message}
      onClose={() => setMessage(null)}
    />
  );
});

SavePostSuccessPopupHost.displayName = 'SavePostSuccessPopupHost';