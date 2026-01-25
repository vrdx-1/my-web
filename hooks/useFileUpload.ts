'use client'

import { useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { safeParseSessionJSON } from '@/utils/storageUtils';

interface UseFileUploadReturn {
  hiddenFileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCreatePostClick: (session: any, showTermsModal: boolean, setShowTermsModal: (show: boolean) => void) => void;
}

export function useFileUpload(): UseFileUploadReturn {
  const router = useRouter();
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      const previewUrls = filesArray.map(file => URL.createObjectURL(file));
      sessionStorage.setItem('pending_images', JSON.stringify(previewUrls));
      router.push('/create-post');
    }
  }, [router]);

  const handleCreatePostClick = useCallback((
    session: any,
    showTermsModal: boolean,
    setShowTermsModal: (show: boolean) => void
  ) => {
    if (session) {
      hiddenFileInputRef.current?.click();
    } else {
      setShowTermsModal(true);
    }
  }, []);

  return {
    hiddenFileInputRef,
    handleFileChange,
    handleCreatePostClick,
  };
}
