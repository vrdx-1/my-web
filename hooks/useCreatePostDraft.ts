'use client';

import { useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { safeParseJSON, safeParseSessionJSON } from '@/utils/storageUtils';
import {
  clearCreatePostDraft,
  loadCreatePostDraft,
  saveCreatePostDraft,
} from '@/utils/createPostDraftPersistence';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useCreatePostContext } from '@/contexts/CreatePostContext';

type UseImageUploadReturn = ReturnType<typeof useImageUpload>;

interface UseCreatePostDraftParams {
  caption: string;
  setCaption: (value: string) => void;
  province: string;
  setProvince: (value: string) => void;
  carPrice: string;
  setCarPrice: (value: string) => void;
  carCurrency: '₭' | '฿' | '$';
  setCarCurrency: (value: '₭' | '฿' | '$') => void;
  step: number;
  setStep: (value: number) => void;
  imageUpload: UseImageUploadReturn;
  isInitialized: boolean;
  setIsInitialized: (value: boolean) => void;
  setSession: (session: Session | null) => void;
  layout: string;
  setLayout: (value: string) => void;
  /** คืนค่า caption ที่เก็บไว้ระดับโมดูล — กัน caption หายเมื่อหน้า remount */
  getCaptionBackup?: () => string;
  sharedDraftFiles?: File[];
  sharedDraftLayout?: string;
  setSharedDraft?: (draft: { files: File[]; layout: string }) => void;
}

export function useCreatePostDraft({
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
  getCaptionBackup,
  sharedDraftFiles = [],
  sharedDraftLayout = 'default',
  setSharedDraft,
}: UseCreatePostDraftParams) {
  // Import context to check for pending files from file picker
  const createPostContext = useCreatePostContext();

  // Initial load: session + caption/province/step + images
  useEffect(() => {
    const initializeDraft = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);

      // โหลดข้อมูลจาก sessionStorage (ถ้าไม่มี ค่อย fallback จาก localStorage)
      const savedCaption = safeParseSessionJSON<string>('create_post_caption', '');
      const savedProvince = safeParseSessionJSON<string>('create_post_province', '');
      const savedPrice = safeParseSessionJSON<string>('create_post_price', '');
      const savedCurrency = safeParseSessionJSON<'₭' | '฿' | '$'>('create_post_currency', '₭');
      const savedStep = safeParseSessionJSON<number>('create_post_step', 2);
      const savedLayout = safeParseSessionJSON<string>('create_post_layout', 'default');

      // โหลด caption — ใช้ค่าที่ยาวที่สุดระหว่าง session / localStorage / backup ระดับโมดูล (กัน caption หายเมื่อ remount)
      const sessionCaption = typeof savedCaption === 'string' ? savedCaption : '';
      const lsCaption = safeParseJSON<string>('create_post_caption_ls', '');
      const lsCaptionStr = typeof lsCaption === 'string' ? lsCaption : '';
      const fromStorage =
        sessionCaption.length >= lsCaptionStr.length ? sessionCaption : lsCaptionStr;
      const backup = typeof getCaptionBackup === 'function' ? getCaptionBackup() : '';
      const backupStr = typeof backup === 'string' ? backup : '';
      const captionToUse =
        backupStr.length > fromStorage.length ? backupStr : fromStorage;
      // อย่าเขียนทับด้วยค่าที่สั้นกว่า — state อาจถูก init จาก getLongestStoredCaption() แล้ว
      if (captionToUse && captionToUse.length > caption.length) setCaption(captionToUse);

      if (savedProvince) {
        setProvince(savedProvince);
      } else {
        // ถ้าไม่มี province จาก sessionStorage ให้โหลดจาก localStorage (แขวงที่เลือกล่าสุด)
        const lastProvince = safeParseJSON<string>('last_selected_province', '');
        if (lastProvince) setProvince(lastProvince);
      }

      if (savedPrice) {
        setCarPrice(savedPrice);
      } else {
        const lsPrice = safeParseJSON<string>('create_post_price_ls', '');
        if (lsPrice) setCarPrice(lsPrice);
      }

      if (savedCurrency) {
        setCarCurrency(savedCurrency);
      } else {
        const lsCurrency = safeParseJSON<'₭' | '฿' | '$'>('create_post_currency_ls', '₭');
        if (lsCurrency) setCarCurrency(lsCurrency);
      }

      if (savedStep) {
        setStep(savedStep);
      } else {
        const lsStep = safeParseJSON<number>('create_post_step_ls', 2);
        if (lsStep) setStep(lsStep);
      }

      if (savedLayout) {
        setLayout(savedLayout);
      } else {
        const lsLayout = safeParseJSON<string>('create_post_layout_ls', 'default');
        if (lsLayout) setLayout(lsLayout);
      }

      // ดึง pending files จาก context (File objects ที่เก็บจาก file picker)
      const pendingFilesFromContext = createPostContext?.pendingFiles || [];

      // ถ้ามี pending files จากการเลือกรูปใหม่ ให้ใช้ก่อน
      if (pendingFilesFromContext.length > 0) {
        try {
          const files = pendingFilesFromContext.slice(0, 30);
          const previewUrls = files.map((file) => URL.createObjectURL(file));
          imageUpload.setPreviews(previewUrls);
          imageUpload.setSelectedFiles(files);
          const nextLayout = savedLayout || sharedDraftLayout || 'default';
          setLayout(nextLayout);
          setSharedDraft?.({ files, layout: nextLayout });

          // Clear pending files after loading
          createPostContext?.clearPendingFiles();
          setStep(2);
        } catch (e) {
          console.error('Error processing pending files', e);
        }
      }
      else if (sharedDraftFiles.length > 0) {
        const files = sharedDraftFiles.slice(0, 30);
        const previewUrls = files.map((file) => URL.createObjectURL(file));
        imageUpload.setPreviews(previewUrls);
        imageUpload.setSelectedFiles(files);
        setLayout(sharedDraftLayout || savedLayout || 'default');
        setStep(2);
        return;
      }
      else {
        try {
          const persistedDraft = await loadCreatePostDraft();
          if (persistedDraft && persistedDraft.files.length > 0) {
            const files = persistedDraft.files.slice(0, 30);
            const previewUrls = files.map((file) => URL.createObjectURL(file));
            imageUpload.setPreviews(previewUrls);
            imageUpload.setSelectedFiles(files);
            const draftLayout = persistedDraft.layout || savedLayout || sharedDraftLayout || 'default';
            setLayout(draftLayout);
            setSharedDraft?.({ files, layout: draftLayout });
            setStep(2);
          }
        } catch (e) {
          console.error('Error loading persisted create-post draft', e);
        }
      }
    };

    initializeDraft().finally(() => {
      setIsInitialized(true);
    });
  }, []);

  // บันทึก caption ลง sessionStorage/localStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
  // ใช้ try/catch เพื่อกัน QuotaExceeded เมื่อ storage เต็ม (เช่น มีรูป base64 เยอะ) — caption ต้องไม่หาย
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window === 'undefined') return;
    if (caption) {
      const payload = JSON.stringify(caption);
      try {
        sessionStorage.setItem('create_post_caption', payload);
      } catch {
        // quota เต็ม ไม่ลบของเดิม
      }
      try {
        localStorage.setItem('create_post_caption_ls', payload);
      } catch {
        // quota เต็ม ไม่ลบของเดิม
      }
    } else {
      sessionStorage.removeItem('create_post_caption');
      localStorage.removeItem('create_post_caption_ls');
    }
  }, [caption, isInitialized]);

  // บันทึก province ลง sessionStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      if (province) {
        sessionStorage.setItem('create_post_province', JSON.stringify(province));
        localStorage.setItem('create_post_province_ls', JSON.stringify(province));
      } else {
        sessionStorage.removeItem('create_post_province');
        localStorage.removeItem('create_post_province_ls');
      }
    }
  }, [province, isInitialized]);

  // บันทึกราคารถลง sessionStorage/localStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      if (carPrice) {
        sessionStorage.setItem('create_post_price', JSON.stringify(carPrice));
        localStorage.setItem('create_post_price_ls', JSON.stringify(carPrice));
      } else {
        sessionStorage.removeItem('create_post_price');
        localStorage.removeItem('create_post_price_ls');
      }
    }
  }, [carPrice, isInitialized]);

  // บันทึก currency ลง sessionStorage/localStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('create_post_currency', JSON.stringify(carCurrency || '₭'));
      localStorage.setItem('create_post_currency_ls', JSON.stringify(carCurrency || '₭'));
    }
  }, [carCurrency, isInitialized]);

  // บันทึก step ลง sessionStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('create_post_step', JSON.stringify(step));
      localStorage.setItem('create_post_step_ls', JSON.stringify(step));
    }
  }, [step, isInitialized]);

  // บันทึก layout ลง sessionStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('create_post_layout', JSON.stringify(layout));
      localStorage.setItem('create_post_layout_ls', JSON.stringify(layout));
    }
  }, [layout, isInitialized]);

  // ซิงก์รูปกับ shared context ในหน่วยความจำ และล้าง storage เก่าเมื่อไม่มีรูปเหลือ
  useEffect(() => {
    if (!isInitialized) return;
    setSharedDraft?.({
      files: imageUpload.selectedFiles.slice(0, 30),
      layout,
    });
    const persistDraft = async () => {
      try {
        if (imageUpload.selectedFiles.length > 0) {
          await saveCreatePostDraft(imageUpload.selectedFiles, layout);
        } else {
          await clearCreatePostDraft();
        }
      } catch (error) {
        console.error('Error persisting create-post draft', error);
      }
    };

    persistDraft();
  }, [imageUpload.selectedFiles, layout, isInitialized, setSharedDraft]);
}

