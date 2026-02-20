'use client';

import { useEffect } from 'react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { useCreatePostContext } from '@/contexts/CreatePostContext';

/**
 * ลงทะเบียน Create Post handler + ซ่อน file input
 * ใช้เมื่ออยู่หน้า Notifications / Profile เพื่อให้กดปุ่ม Post ใน Bottom nav ได้พฤติกรรมเดียวกับหน้า Home
 */
export function CreatePostHandlerRegistration() {
  const fileUpload = useFileUpload();
  const { session } = useSessionAndProfile();
  const createPostContext = useCreatePostContext();

  useEffect(() => {
    const handler = () => fileUpload.handleCreatePostClick(session);
    createPostContext?.register(handler);
    return () => createPostContext?.register(null);
  }, [session, createPostContext, fileUpload.handleCreatePostClick]);

  return (
    <input
      type="file"
      ref={fileUpload.hiddenFileInputRef}
      multiple
      accept="image/*"
      onChange={fileUpload.handleFileChange}
      style={{ display: 'none' }}
      aria-hidden
    />
  );
}
