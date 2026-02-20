'use client'
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { useImageUpload } from '@/hooks/useImageUpload';
import { Avatar } from '@/components/Avatar';

import { LAO_PROVINCES } from '@/utils/constants';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { safeParseJSON, safeParseSessionJSON } from '@/utils/storageUtils';
import { compressImage } from '@/utils/imageCompression';
import { fileToBase64, base64ToFile } from '@/utils/fileEncoding';
import { useCreatePostDraft } from '@/hooks/useCreatePostDraft';
import { useCreatePostUpload } from '@/hooks/useCreatePostUpload';
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock';
import {
  CreatePostUploadingOverlay,
  CreatePostViewingOverlay,
  CreatePostLeaveConfirmModal,
  CreatePostVideoAlertModal,
} from '@/components/create-post/CreatePostOverlays';
import { CreatePostCard } from '@/components/create-post/CreatePostCard';
import { CreatePostProvinceStep } from '@/components/create-post/CreatePostProvinceStep';

export default function CreatePost() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoFileInputRef = useRef<HTMLInputElement | null>(null);
  const hasRequestedGalleryRef = useRef<boolean>(false);

  const [step, setStep] = useState(2);
  const [caption, setCaption] = useState('');
  const [province, setProvince] = useState('');
  // Use shared image upload hook (replaces selectedFiles, previews, loading states)
  // สร้างโพสต์: บีบอัดรูปแรง แต่ยังพอเห็นรายละเอียด (quality ~ 0.5)
  const imageUpload = useImageUpload({
    maxFiles: 15,
    compressMaxWidth: 720,
    compressQuality: 0.5,
  });
  const [session, setSession] = useState<any>(null);
  const [isViewing, setIsViewing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showVideoAlert, setShowVideoAlert] = useState(false);

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
  });

  // Set initial height for textarea และอัพเดทเมื่อ caption เปลี่ยน
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [caption]);

  // ขอเปิดแกลเลอรี่ (file picker) อัตโนมัติครั้งแรกเมื่อเข้าหน้า (บางเครื่อง Android เปิดไม่ได้เอง)
  useEffect(() => {
    if (hasRequestedGalleryRef.current) return;
    if (!autoFileInputRef.current) return;
    if (imageUpload.selectedFiles.length > 0 || imageUpload.previews.length > 0) return;

    hasRequestedGalleryRef.current = true;
    try {
      autoFileInputRef.current.click();
    } catch {
      // บราวเซอร์บางตัวอาจบล็อกการ click แบบโปรแกรม แต่จะไม่กระทบ UX เดิม
    }
  }, [imageUpload.selectedFiles.length, imageUpload.previews.length]);

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
   // ลบข้อมูลจาก sessionStorage
   if (typeof window !== 'undefined') {
     sessionStorage.removeItem('create_post_caption');
     sessionStorage.removeItem('create_post_province');
     sessionStorage.removeItem('create_post_step');
     sessionStorage.removeItem('create_post_images');
     sessionStorage.removeItem('create_post_images_base64');
    localStorage.removeItem('create_post_caption_ls');
    localStorage.removeItem('create_post_province_ls');
    localStorage.removeItem('create_post_step_ls');
    localStorage.removeItem('create_post_images_base64_ls');
   }
   setShowLeaveConfirm(false);
   router.push('/');
 };

const handleLeaveCancel = () => {
  setShowLeaveConfirm(false);
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
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#ffffff', backgroundColor: '#ffffff', zIndex: 10 }}>
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
 <button type="button" onClick={() => setStep(3)} style={{ width: '100%', minHeight: '40px', background: '#1877f2', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ຕໍ່ໄປ</button>
 )}
{step === 3 && province && !isUploading && (
<button type="button" onClick={handleSubmit} style={{ width: '100%', minHeight: '40px', background: '#1877f2', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ໂພສ</button>
)}
 </div>
 </div>

      <div style={{ flex: 1, paddingBottom: '100px', minHeight: 0, overflowY: 'auto' }}>
        {step === 2 && (
          <CreatePostCard
            userProfile={userProfile}
            session={session}
            caption={caption}
            setCaption={setCaption}
            textareaRef={textareaRef as any}
            previews={imageUpload.previews}
            onImageClick={() => setIsViewing(true)}
            onRemoveImage={removeImage}
          />
        )}

{step === 3 && (
  <CreatePostProvinceStep province={province} onProvinceChange={setProvince} />
)}
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
