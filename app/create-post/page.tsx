'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useImageUpload } from '@/hooks/useImageUpload';

import { REGISTER_PATH } from '@/utils/authRoutes';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { safeParseSessionJSON } from '@/utils/storageUtils';
import { clearCreatePostDraft as clearPersistedCreatePostDraft } from '@/utils/createPostDraftPersistence';
import { useCreatePostDraft } from '@/hooks/useCreatePostDraft';
import { useCreatePostUpload } from '@/hooks/useCreatePostUpload';
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock';
import { useCreatePostContext } from '@/contexts/CreatePostContext';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import {
  CreatePostUploadingOverlay,
  CreatePostViewingOverlay,
  CreatePostLeaveConfirmModal,
  CreatePostVideoAlertModal,
  CreatePostValidationAlertModal,
} from '@/components/create-post/CreatePostOverlays';
import { CreatePostCard } from '@/components/create-post/CreatePostCard';
import { CreatePostProvinceStep } from '@/components/create-post/CreatePostProvinceStep';

/** เก็บ caption ล่าสุดระดับโมดูล — กัน caption หายเมื่อหน้า remount */
let createPostCaptionBackup = '';

/** เก็บ caption ตอนกด "ຕໍ່ໄປ" ระดับโมดูล — ไม่หายเมื่อ component remount */
let captionWhenLeavingStep2Module = '';

const CREATE_POST_PRIVATE_SHOP_STORAGE_KEY_PREFIX = 'create_post_private_shop';
const CREATE_POST_PRIVATE_SHOP_UPDATED_EVENT = 'create-post-private-shop-updated';

function getLastUsedPrivateShopStorageKey(profileId: string): string {
  return `create_post_last_used_private_shop_${profileId}`;
}

function getCreatePostPrivateShopStorageKey(profileId: string): string {
  return `${CREATE_POST_PRIVATE_SHOP_STORAGE_KEY_PREFIX}_${profileId}`;
}

interface CreatePostPrivateShop {
  id: string;
  shop_name: string | null;
  shop_phone: string | null;
}

function readCreatePostPrivateShop(profileId: string | null): CreatePostPrivateShop | null {
  if (typeof window === 'undefined' || !profileId) return null;

  try {
    const raw = window.sessionStorage.getItem(getCreatePostPrivateShopStorageKey(profileId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CreatePostPrivateShop>;
    if (!parsed.id || typeof parsed.id !== 'string') return null;

    return {
      id: parsed.id,
      shop_name: typeof parsed.shop_name === 'string' ? parsed.shop_name : null,
      shop_phone: typeof parsed.shop_phone === 'string' ? parsed.shop_phone : null,
    };
  } catch {
    window.sessionStorage.removeItem(getCreatePostPrivateShopStorageKey(profileId));
    return null;
  }
}

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

function getStoredPrice(): string {
  if (typeof window === 'undefined') return '';
  try {
    const rawS = sessionStorage.getItem('create_post_price');
    const rawL = localStorage.getItem('create_post_price_ls');
    const fromS = rawS ? (() => { try { return JSON.parse(rawS) as string; } catch { return ''; } })() : '';
    const fromL = rawL ? (() => { try { return JSON.parse(rawL) as string; } catch { return ''; } })() : '';
    return fromS || fromL || '';
  } catch {
    return '';
  }
}

function getStoredCurrency(): '₭' | '฿' | '$' {
  if (typeof window === 'undefined') return '₭';
  try {
    const rawS = sessionStorage.getItem('create_post_currency');
    const rawL = localStorage.getItem('create_post_currency_ls');
    const fromS = rawS ? (() => { try { return JSON.parse(rawS) as '₭' | '฿' | '$'; } catch { return '₭'; } })() : '₭';
    const fromL = rawL ? (() => { try { return JSON.parse(rawL) as '₭' | '฿' | '$'; } catch { return '₭'; } })() : '₭';
    return fromS || fromL || '₭';
  } catch {
    return '₭';
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
  const [carPrice, setCarPrice] = useState(getStoredPrice);
  const [carCurrency, setCarCurrency] = useState<'₭' | '฿' | '$'>(getStoredCurrency);
  const [layout, setLayout] = useState('default');
  // Use shared image upload hook (replaces selectedFiles, previews, loading states)
  // สร้างโพสต์: บีบอัดรูปแรง แต่ยังพอเห็นรายละเอียด (quality ~ 0.5)
  const imageUpload = useImageUpload({
    maxFiles: 30,
    compressMaxWidth: 720,
    compressQuality: 0.5,
  });
  const [session, setSession] = useState<Session | null>(null);
  const [isViewing, setIsViewing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showVideoAlert, setShowVideoAlert] = useState(false);
  const [validationAlertMessage, setValidationAlertMessage] = useState('');
  const { userProfile, activeProfileId } = useSessionAndProfile();
  const currentPrivateShopProfileId = activeProfileId || session?.user?.id || null;
  const [selectedPrivateShop, setSelectedPrivateShop] = useState<CreatePostPrivateShop | null>(null);

  const setSharedDraft = useCallback((draft: { files: File[]; layout: string }) => {
    createPostContext?.setDraft(draft);
  }, [createPostContext]);

  useCreatePostDraft({
    caption,
    setCaption,
    province,
    setProvince,
    carPrice,
    setCarPrice,
    carCurrency,
    setCarCurrency,
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

  useEffect(() => {
    const syncSelectedPrivateShop = () => {
      setSelectedPrivateShop(readCreatePostPrivateShop(currentPrivateShopProfileId));
    };

    syncSelectedPrivateShop();

    window.addEventListener(CREATE_POST_PRIVATE_SHOP_UPDATED_EVENT, syncSelectedPrivateShop);
    window.addEventListener('pageshow', syncSelectedPrivateShop);
    window.addEventListener('focus', syncSelectedPrivateShop);

    return () => {
      window.removeEventListener(CREATE_POST_PRIVATE_SHOP_UPDATED_EVENT, syncSelectedPrivateShop);
      window.removeEventListener('pageshow', syncSelectedPrivateShop);
      window.removeEventListener('focus', syncSelectedPrivateShop);
    };
  }, [currentPrivateShopProfileId]);

  useEffect(() => {
    const profileId = activeProfileId || session?.user?.id;
    if (!profileId) return;
    if (selectedPrivateShop?.id) return;
    if (typeof window === 'undefined') return;

    const lastUsedId = window.localStorage.getItem(getLastUsedPrivateShopStorageKey(profileId));
    if (!lastUsedId) return;

    let cancelled = false;

    const hydrateLastUsedPrivateShop = async () => {
      const { data, error } = await supabase
        .from('user_private_shops')
        .select('id, shop_name, shop_phone')
        .eq('user_id', profileId)
        .eq('id', lastUsedId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        window.localStorage.removeItem(getLastUsedPrivateShopStorageKey(profileId));
        return;
      }

      const restoredShop: CreatePostPrivateShop = {
        id: data.id,
        shop_name: typeof data.shop_name === 'string' ? data.shop_name : null,
        shop_phone: typeof data.shop_phone === 'string' ? data.shop_phone : null,
      };

      try {
        window.sessionStorage.setItem(
          getCreatePostPrivateShopStorageKey(profileId),
          JSON.stringify(restoredShop),
        );
      } catch {
        return;
      }

      setSelectedPrivateShop(restoredShop);
      window.dispatchEvent(new Event(CREATE_POST_PRIVATE_SHOP_UPDATED_EVENT));
    };

    void hydrateLastUsedPrivateShop();

    return () => {
      cancelled = true;
    };
  }, [activeProfileId, session?.user?.id, selectedPrivateShop?.id]);

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
     carPrice.length > 0 ||
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
     sessionStorage.removeItem('create_post_price');
     sessionStorage.removeItem('create_post_currency');
     sessionStorage.removeItem('create_post_step');
     sessionStorage.removeItem('create_post_layout');
     if (currentPrivateShopProfileId) {
       sessionStorage.removeItem(getCreatePostPrivateShopStorageKey(currentPrivateShopProfileId));
     }
    localStorage.removeItem('create_post_caption_ls');
    localStorage.removeItem('create_post_province_ls');
    localStorage.removeItem('create_post_price_ls');
    localStorage.removeItem('create_post_currency_ls');
    localStorage.removeItem('create_post_step_ls');
    localStorage.removeItem('create_post_layout_ls');
     window.dispatchEvent(new Event(CREATE_POST_PRIVATE_SHOP_UPDATED_EVENT));
   }
   createPostContext?.clearDraft();
   setShowLeaveConfirm(false);
   router.push('/');
 };

 const handleClearPrivateShop = useCallback(() => {
   if (!currentPrivateShopProfileId || typeof window === 'undefined') {
     setSelectedPrivateShop(null);
     return;
   }

   sessionStorage.removeItem(getCreatePostPrivateShopStorageKey(currentPrivateShopProfileId));
   localStorage.removeItem(getLastUsedPrivateShopStorageKey(currentPrivateShopProfileId));
   setSelectedPrivateShop(null);
   window.dispatchEvent(new Event(CREATE_POST_PRIVATE_SHOP_UPDATED_EVENT));
 }, [currentPrivateShopProfileId]);

const handleLeaveCancel = () => {
  setShowLeaveConfirm(false);
};

const isCaptionFilled = caption.trim().length > 0;
const isPriceFilled = carPrice.trim().length > 0;
const canProceedToProvinceStep = isCaptionFilled && isPriceFilled;

const handleNextStep = () => {
  if (!canProceedToProvinceStep) {
    if (!isCaptionFilled && !isPriceFilled) {
      setValidationAlertMessage('ກະລຸນາໃສ່ລາຍລະອຽດ ແລະ ລາຄາກ່ອນ');
      return;
    }

    if (!isCaptionFilled) {
      setValidationAlertMessage('ກະລຸນາໃສ່ລາຍລະອຽດກ່ອນ');
      return;
    }

    setValidationAlertMessage('ກະລຸນາໃສ່ລາຄາກ່ອນ');
    return;
  }

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
};

// Lock background scroll when overlay layers are open
useOverlayScrollLock(isViewing || showLeaveConfirm || showVideoAlert || validationAlertMessage.length > 0);

 // Removed duplicate PhotoPreviewGrid - using from components/PhotoPreviewGrid.tsx

 // Removed duplicate generateGuestToken - using from utils/postUtils

const { isUploading, uploadProgress, handleSubmit } = useCreatePostUpload({
  session,
  activeProfileId,
  selectedPrivateShop,
  caption,
  province,
  carPrice,
  carCurrency,
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
<div style={{ ...LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX, isolation: 'isolate', height: '100dvh', overflow: 'hidden' }}>

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
 {step === 2 && (
 <button
   type="button"
   onClick={handleNextStep}
   aria-disabled={!canProceedToProvinceStep}
   style={{ width: '100%', minHeight: '40px', background: canProceedToProvinceStep ? '#1877f2' : '#cbd5e1', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: canProceedToProvinceStep ? 'pointer' : 'not-allowed', padding: '6px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canProceedToProvinceStep ? 1 : 0.9 }}
 >
   ຕໍ່ໄປ
 </button>
 )}
{step === 3 && province && !isUploading && (
<button type="button" onClick={handleSubmit} style={{ width: '100%', minHeight: '40px', background: '#1877f2', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ໂພສ</button>
)}
 </div>
 </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 0, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingBottom: '120px',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
            touchAction: 'pan-y',
          }}
        >
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
              carPrice={carPrice}
              setCarPrice={setCarPrice}
              carCurrency={carCurrency}
              setCarCurrency={setCarCurrency}
              textareaRef={textareaRef}
              previews={imageUpload.previews.slice(0, 15)}
              onImageClick={() => setIsViewing(true)}
              onRemoveImage={removeImage}
              layout={layout}
              onLayoutChange={setLayout}
              selectedPrivateShop={selectedPrivateShop}
              onClearPrivateShop={handleClearPrivateShop}
            />
          </div>
          <div
            aria-hidden={step !== 3}
            style={{ display: step === 3 ? 'block' : 'none', minHeight: 0 }}
          >
            <CreatePostProvinceStep province={province} onProvinceChange={setProvince} />
          </div>
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

<CreatePostValidationAlertModal
  show={validationAlertMessage.length > 0}
  message={validationAlertMessage}
  onClose={() => setValidationAlertMessage('')}
/>
 </div>
 );
}
