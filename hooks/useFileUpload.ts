'use client'

import { useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { REGISTER_PATH } from '@/utils/authRoutes';
import { useCreatePostContext } from '@/contexts/CreatePostContext';

const CREATE_POST_REDIRECT_AFTER_SUBMIT_KEY = 'create_post_redirect_after_submit';

interface UseFileUploadOptions {
  redirectAfterSubmitPath?: string;
}

interface UseFileUploadReturn {
  hiddenFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCreatePostClick: (session: unknown) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
  const router = useRouter();
  const createPostContext = useCreatePostContext();
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);
  const { redirectAfterSubmitPath } = options;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      // Allow only images (block videos/other files)
      const filesArray = Array.from(e.target.files).filter((file) => file.type?.startsWith('image/'));
      if (filesArray.length === 0) return;
      
      if (typeof window !== 'undefined') {
        if (redirectAfterSubmitPath) {
          sessionStorage.setItem(CREATE_POST_REDIRECT_AFTER_SUBMIT_KEY, redirectAfterSubmitPath);
        } else {
          sessionStorage.removeItem(CREATE_POST_REDIRECT_AFTER_SUBMIT_KEY);
        }
      }
      
      // Store File objects in context instead of blob URLs (which expire quickly)
      createPostContext?.setPendingFiles(filesArray);
      
      router.push('/create-post');
    }
  }, [redirectAfterSubmitPath, router, createPostContext]);

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
