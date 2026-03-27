'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';
import { useImageUpload } from '@/hooks/useImageUpload';

import { REGISTER_PATH } from '@/utils/authRoutes';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { safeParseSessionJSON } from '@/utils/storageUtils';
import { clearCreatePostDraft as clearPersistedCreatePostDraft } from '@/utils/createPostDraftPersistence';
import { useCreatePostDraft } from '@/hooks/useCreatePostDraft';
import { useCreatePostUpload } from '@/hooks/useCreatePostUpload';
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock';
import { useCreatePostContext } from '@/contexts/CreatePostContext';
import {
  CreatePostUploadingOverlay,
  CreatePostViewingOverlay,
  CreatePostLeaveConfirmModal,
  CreatePostVideoAlertModal,
} from '@/components/create-post/CreatePostOverlays';
import { CreatePostCard } from '@/components/create-post/CreatePostCard';
import { CreatePostProvinceStep } from '@/components/create-post/CreatePostProvinceStep';

/** เก็บ caption ล่าสุดระดับโมดูล — กัน caption หายเมื่อหน้า remount */
let createPostCaptionBackup = '';

/** เก็บ caption ตอนกด "ຕໍ່ໄປ" ระดับโมดูล — ไม่หายเมื่อ component remount */
let captionWhenLeavingStep2Module = '';

function getLongestStoredCaption(): string {
  if (typeof window === 'undefined') return '';
  try {
    const rawS = sessionStorage.getItem('create_post_caption');
    const rawL = localStorage.getItem('create_post_caption_ls');
    const fromS = rawS ? (() => { try { return JSON.parse(rawS) as string; } catch { return ''; } })() : '';
    const fromL = rawL ? (() => { try { return JSON.parse(rawL) as string; } catch { return ''; } })() : '';
    return [createPostCaptionBackup, captionWhenLeavingStep2Module, fromS, fromL].reduce(
      (a, b) => (a.length >= b.length ? a : b),
      ''
    );
  } catch {
    return '';
  }
}

export default function CreatePost() {
  const router = useRouter();
  const createPostContext = useCreatePostContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoFileInputRef = useRef<HTMLInputElement | null>(null);
  const hasRequestedGalleryRef = useRef<boolean>(false);
  /** ref ที่ sync กับ caption ทุกครั้ง — ใช้ตอนกด "ຕໍ່ໄປ" เพื่อไม่ให้ได้ค่าเก่าจาก closure */
  const captionLatestRef = useRef<string>('');

  const [step, setStep] = useState(2);
  const [caption, setCaption] = useState(getLongestStoredCaption);
  const [province, setProvince] = useState('');
  const [layout, setLayout] = useState('default');
  // Use shared image upload hook (replaces selectedFiles, previews, loading states)
  // สร้างโพสต์: บีบอัดรูปแรง แต่ยังพอเห็นรายละเอียด (quality ~ 0.5)
  const imageUpload = useImageUpload({
    maxFiles: 30,
    compressMaxWidth: 720,
    compressQuality: 0.5,
  });
  const [session, setSession] = useState<any>(null);
  const [isViewing, setIsViewing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showVideoAlert, setShowVideoAlert] = useState(false);
  const [isPreparingArrange, setIsPreparingArrange] = useState(false);

  const setSharedDraft = useCallback((draft: { files: File[]; layout: string }) => {
    createPostContext?.setDraft(draft);
  }, [createPostContext]);

  // Use shared profile hook
  const { profile: userProfile } = useProfile();

  useCreatePostDraft({
    caption,
    setCaption,
    province,
    setProvince,
    step,
    setStep,
    imageUpload,
    isInitialized,
    setIsInitialized,
    setSession,
    layout,
    setLayout,
    getCaptionBackup: () => createPostCaptionBackup,
    sharedDraftFiles: createPostContext?.draft.files || [],
    sharedDraftLayout: createPostContext?.draft.layout || 'default',
    setSharedDraft,
  });

  // อัปเดต backup + ref ล่าสุดทุกครั้งที่ caption เปลี่ยน
  useEffect(() => {
    createPostCaptionBackup = caption;
    captionLatestRef.current = caption;
  }, [caption]);

  // Guest เข้าหน้า create-post โดยตรง → ไปหน้าลงทะเบียน หลังรอให้ checkUser() ใน useCreatePostDraft โหลด session ก่อน (ถ้า redirect ทันทีจะทำให้ User ที่ล็อกอินแล้วโดนเด้งไปโฮม/ลงทะเบียนตอนเลือกรูป)
  const guestRedirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isInitialized) return;
    if (session !== null) {
      if (guestRedirectTimeoutRef.current) {
        clearTimeout(guestRedirectTimeoutRef.current);
        guestRedirectTimeoutRef.current = null;
      }
      return;
    }
    guestRedirectTimeoutRef.current = setTimeout(() => {
      guestRedirectTimeoutRef.current = null;
      router.replace(REGISTER_PATH);
    }, 600);
    return () => {
      if (guestRedirectTimeoutRef.current) {
        clearTimeout(guestRedirectTimeoutRef.current);
        guestRedirectTimeoutRef.current = null;
      }
    };
  }, [isInitialized, session, router]);

  // Set initial height for textarea และอัพเดทเมื่อ caption เปลี่ยน
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [caption]);

  // ขอเปิดแกลเลอรี่ (file picker) อัตโนมัติครั้งแรกเมื่อเข้าหน้า (บางเครื่อง Android เปิดไม่ได้เอง)
  // อย่าเปิดถ้ามี draft/pending อยู่ (เช่น กลับจากหน้าจัดเรียงรูป) — รอให้โหลด draft ก่อน
  useEffect(() => {
    if (!isInitialized) return;
    if (hasRequestedGalleryRef.current) return;
    if (!autoFileInputRef.current) return;
    if (imageUpload.selectedFiles.length > 0 || imageUpload.previews.length > 0) return;
    if ((createPostContext?.draft.files.length || 0) > 0) return;
    if (typeof window === 'undefined') return;
    const pending = safeParseSessionJSON<string[]>('pending_images', []);
    if (pending && pending.length > 0) return;

    hasRequestedGalleryRef.current = true;
    try {
      autoFileInputRef.current.click();
    } catch {
      // บราวเซอร์บางตัวอาจบล็อกการ click แบบโปรแกรม แต่จะไม่กระทบ UX เดิม
    }
  }, [isInitialized, imageUpload.selectedFiles.length, imageUpload.previews.length, createPostContext?.draft.files.length]);

  // Removed duplicate functions - using from hooks/useImageUpload.ts and utils/imageCompression.ts
 const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
   const raw = e.target.files;
   if (raw && raw.length > 0) {
     const arr = Array.from(raw);
     const hasNonImage = arr.some((f) => !f.type.startsWith('image/'));
     if (hasNonImage) {
       setShowVideoAlert(true);
       e.target.value = '';
       if (imageUpload.fileInputRef.current) imageUpload.fileInputRef.current.value = '';
       return;
     }
   }
   await imageUpload.handleFileChange(e);
   // Check after state update
   setTimeout(() => {
     if (imageUpload.selectedFiles.length > 0) {
       setStep(2);
     }
   }, 100);
 };

 const removeImage = (index: number) => {
   const currentLength = imageUpload.previews.length;
   imageUpload.removeImage(index);
   if (currentLength <= 1) {
     setIsViewing(false);
     if (currentLength === 1) {
       router.push('/');
     }
   }
 };

 // ตรวจสอบว่ามีการเปลี่ยนแปลงหรือไม่
 const hasChanges = Boolean(
   isInitialized && (
     caption.trim().length > 0 ||
     province.length > 0 ||
     imageUpload.previews.length > 0
   )
 );

 const handleBack = () => {
   if (step === 3) {
     setStep(2);
   } else {
     // ถ้ามีการเปลี่ยนแปลง ให้แสดง confirm modal
     if (hasChanges) {
       setShowLeaveConfirm(true);
     } else {
       router.push('/');
     }
   }
 };

 const handleDiscardAndBack = () => {
   createPostCaptionBackup = '';
   captionWhenLeavingStep2Module = '';
   void clearPersistedCreatePostDraft();
   if (typeof window !== 'undefined') {
     sessionStorage.removeItem('create_post_caption');
     sessionStorage.removeItem('create_post_province');
     sessionStorage.removeItem('create_post_step');
     sessionStorage.removeItem('create_post_layout');
    localStorage.removeItem('create_post_caption_ls');
    localStorage.removeItem('create_post_province_ls');
    localStorage.removeItem('create_post_step_ls');
    localStorage.removeItem('create_post_layout_ls');
   }
   createPostContext?.clearDraft();
   setShowLeaveConfirm(false);
   router.push('/');
 };

const handleLeaveCancel = () => {
  setShowLeaveConfirm(false);
};

const handleGoArrange = async () => {
  if (isPreparingArrange) return;
  if (imageUpload.previews.length === 0) return;

  setIsPreparingArrange(true);
  try {
    const filesToArrange = imageUpload.selectedFiles.length > 0
      ? imageUpload.selectedFiles.slice(0, 30)
      : (createPostContext?.draft.files || []).slice(0, 30);

    if (filesToArrange.length === 0) {
      return;
    }

    createPostContext?.setDraft({
      files: filesToArrange,
      layout,
    });

    router.push('/create-post/arrange');
  } catch (error) {
    console.error('Error preparing images for arrange page:', error);
  } finally {
    setIsPreparingArrange(false);
  }
};

// Lock background scroll when overlay layers are open
useOverlayScrollLock(isViewing || showLeaveConfirm || showVideoAlert);

 // Removed duplicate PhotoPreviewGrid - using from components/PhotoPreviewGrid.tsx

 // Removed duplicate generateGuestToken - using from utils/postUtils

const { isUploading, uploadProgress, handleSubmit } = useCreatePostUpload({
  session,
  caption,
  province,
  imageUpload,
  layout,
  onDraftCleared: () => {
    createPostCaptionBackup = '';
    captionWhenLeavingStep2Module = '';
    void clearPersistedCreatePostDraft();
    createPostContext?.clearDraft();
  },
});

if (isUploading) {
  return <CreatePostUploadingOverlay uploadProgress={uploadProgress} />;
}

 return (
<div style={LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX}>

{/* Hidden file input สำหรับ auto-open แกลเลอรี่ */}
<input
  type="file"
  multiple
  accept="image/*"
  onChange={handleFileChange}
  ref={autoFileInputRef}
  style={{ display: 'none' }}
/>
 
 {/* Header */}
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 0, position: 'sticky', top: 0, background: '#ffffff', backgroundColor: '#ffffff', zIndex: 10 }}>
 <div style={{ width: '72px', flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>
 <button 
 onClick={handleBack}
 style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1c1e21', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
 >
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="15 18 9 12 15 6"></polyline>
 </svg>
 </button>
 </div>
 <h3 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '18px', fontWeight: 'bold', minWidth: 0, color: '#111111' }}>
 {step === 2 && 'ສ້າງໂພສ'}
 {step === 3 && 'ລົດຢູ່ແຂວງ'}
 </h3>
 <div style={{ width: '72px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
 {step === 2 && caption.trim().length > 0 && (
 <button
   type="button"
   onClick={() => {
     const latest = captionLatestRef.current ?? caption;
     captionWhenLeavingStep2Module = latest;
     if (typeof window !== 'undefined') {
       try {
         sessionStorage.setItem('create_post_caption', JSON.stringify(latest));
       } catch { /* quota */ }
       try {
         localStorage.setItem('create_post_caption_ls', JSON.stringify(latest));
       } catch { /* quota */ }
     }
     setStep(3);
   }}
   style={{ width: '100%', minHeight: '40px', background: '#1877f2', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
 >
   ຕໍ່ໄປ
 </button>
 )}
{step === 3 && province && !isUploading && (
<button type="button" onClick={handleSubmit} style={{ width: '100%', minHeight: '40px', background: '#1877f2', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ໂພສ</button>
)}
 </div>
 </div>

      <div style={{ flex: 1, paddingBottom: '100px', minHeight: 0, overflowY: 'auto' }}>
        {/* แบบเดียวกับ navigation bar: เก็บทั้งสอง step ไว้ใน DOM แค่ซ่อน/แสดง — caption ไม่หายเมื่อกดย้อนกลับ */}
        <div
          aria-hidden={step !== 2}
          style={{ display: step === 2 ? 'block' : 'none', minHeight: 0 }}
        >
          <CreatePostCard
            userProfile={userProfile}
            session={session}
            caption={caption}
            setCaption={setCaption}
            textareaRef={textareaRef as any}
            previews={imageUpload.previews.slice(0, 15)}
            onImageClick={() => setIsViewing(true)}
            onRemoveImage={removeImage}
            layout={layout}
            onLayoutChange={setLayout}
            onGoArrange={handleGoArrange}
            isPreparingArrange={isPreparingArrange}
          />
        </div>
        <div
          aria-hidden={step !== 3}
          style={{ display: step === 3 ? 'block' : 'none', minHeight: 0 }}
        >
          <CreatePostProvinceStep province={province} onProvinceChange={setProvince} />
        </div>
      </div>

{isViewing && (
  <CreatePostViewingOverlay
    previews={imageUpload.previews}
    onClose={() => setIsViewing(false)}
    onRemoveImage={removeImage}
    onAddImages={handleFileChange}
    fileInputRef={imageUpload.fileInputRef}
  />
)}

<CreatePostLeaveConfirmModal
  show={showLeaveConfirm}
  onDiscard={handleDiscardAndBack}
  onCancel={handleLeaveCancel}
/>

<CreatePostVideoAlertModal
  show={showVideoAlert}
  onClose={() => setShowVideoAlert(false)}
/>
 </div>
 );
}
