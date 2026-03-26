'use client'

import { useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { REGISTER_PATH } from '@/utils/authRoutes';

interface UseFileUploadReturn {
  hiddenFileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCreatePostClick: (session: unknown) => void;
}

export function useFileUpload(): UseFileUploadReturn {
  const router = useRouter();
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      // Allow only images (block videos/other files)
      const filesArray = Array.from(e.target.files).filter((file) => file.type?.startsWith('image/'));
      if (filesArray.length === 0) return;
      const previewUrls = filesArray.map(file => URL.createObjectURL(file));
      sessionStorage.setItem('pending_images', JSON.stringify(previewUrls));
      router.push('/create-post');
    }
  }, [router]);

  const handleCreatePostClick = useCallback((
    session: unknown
  ) => {
    if (session) {
      hiddenFileInputRef.current?.click();
    } else {
      // Guest → ไปหน้าลงทะเบียน (ใช้ push เพื่อกดย้อนกลับได้กลับหน้าโฮม)
      router.push(REGISTER_PATH);
    }
  }, [router]);

  return {
    hiddenFileInputRef,
    handleFileChange,
    handleCreatePostClick,
  };
}
