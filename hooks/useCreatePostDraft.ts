'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { safeParseJSON, safeParseSessionJSON } from '@/utils/storageUtils';
import { fileToBase64, base64ToFile } from '@/utils/fileEncoding';

interface UseCreatePostDraftParams {
  caption: string;
  setCaption: (value: string) => void;
  province: string;
  setProvince: (value: string) => void;
  step: number;
  setStep: (value: number) => void;
  imageUpload: any;
  isInitialized: boolean;
  setIsInitialized: (value: boolean) => void;
  setSession: (session: any) => void;
}

export function useCreatePostDraft({
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
}: UseCreatePostDraftParams) {
  // Initial load: session + caption/province/step + images
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
    };
    checkUser();

    // โหลดข้อมูลจาก sessionStorage (ถ้าไม่มี ค่อย fallback จาก localStorage)
    const savedCaption = safeParseSessionJSON<string>('create_post_caption', '');
    const savedProvince = safeParseSessionJSON<string>('create_post_province', '');
    const savedStep = safeParseSessionJSON<number>('create_post_step', 2);

    // โหลด caption, province, step
    if (savedCaption) {
      setCaption(savedCaption);
    } else {
      // fallback caption จาก localStorage (กันข้อมูลหายกรณีบาง browser ล้าง sessionStorage ตอน refresh)
      const lsCaption = safeParseJSON<string>('create_post_caption_ls', '');
      if (lsCaption) setCaption(lsCaption);
    }

    if (savedProvince) {
      setProvince(savedProvince);
    } else {
      // ถ้าไม่มี province จาก sessionStorage ให้โหลดจาก localStorage (แขวงที่เลือกล่าสุด)
      const lastProvince = safeParseJSON<string>('last_selected_province', '');
      if (lastProvince) setProvince(lastProvince);
    }

    if (savedStep) {
      setStep(savedStep);
    } else {
      const lsStep = safeParseJSON<number>('create_post_step_ls', 2);
      if (lsStep) setStep(lsStep);
    }

    // ดึงข้อมูลจากหน้าโฮม
    const pendingImages = safeParseSessionJSON<string[]>('pending_images', []);

    // โหลดรูปภาพจาก sessionStorage (ถ้ามี)
    const loadSavedImages = async () => {
      // ถ้ามี pending_images จากหน้าโฮม ให้ใช้ก่อน
      if (pendingImages.length > 0) {
        try {
          // จำกัดสูงสุด 15 รูป (ถ้ามาเกิน เอาแค่ 15 รูปแรก)
          const limitedPendingImages = pendingImages.slice(0, 15);

          // แปลง Blob URL กลับเป็น File Object
          const filePromises = limitedPendingImages.map(async (url: string, index: number) => {
            try {
              if (!url.startsWith('blob:')) {
                return null;
              }
              const response = await fetch(url);
              if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.statusText}`);
              }
              const blob = await response.blob();
              return new File([blob], `image-${Date.now()}-${index}.webp`, {
                type: 'image/webp',
              });
            } catch (error) {
              console.error(`Error loading image at index ${index}:`, error);
              return null;
            }
          });

          const files = await Promise.all(filePromises);
          const validFiles = files.filter((file): file is File => file !== null).slice(0, 15);

          if (validFiles.length > 0) {
            // สร้าง Blob URL สำหรับ preview
            const previewUrls = validFiles.map((file) => URL.createObjectURL(file));
            imageUpload.setPreviews(previewUrls);
            // IMPORTANT: อย่า append ซ้ำ (React StrictMode ใน dev อาจเรียก useEffect ซ้ำ)
            // ให้ set ทับเพื่อป้องกันรูปถูกอัปโหลด/บันทึกซ้ำจนเห็นเป็น ×2 หลังโพสต์
            imageUpload.setSelectedFiles(validFiles);

            // แปลงเป็น base64 และเก็บใน sessionStorage
            const base64Promises = validFiles.map((file) => fileToBase64(file));
            const base64Strings = await Promise.all(base64Promises);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('create_post_images_base64', JSON.stringify(base64Strings));
            }

            setStep(2);
          }

          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('pending_images');
          }
        } catch (e) {
          console.error('Error processing pending images', e);
        }
      }
      // โหลดรูปภาพจาก sessionStorage (base64) หรือ fallback จาก localStorage
      else {
        try {
          // ตรวจสอบว่ามี base64 data หรือไม่
          let savedBase64 = safeParseSessionJSON<string[]>('create_post_images_base64', []);

          // ถ้า sessionStorage ไม่มี ให้ลอง fallback จาก localStorage
          if (!savedBase64 || savedBase64.length === 0) {
            const lsBase64 = safeParseJSON<string[]>('create_post_images_base64_ls', []);
            if (lsBase64 && lsBase64.length > 0) {
              savedBase64 = lsBase64;
              // sync กลับเข้า sessionStorage ด้วย
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('create_post_images_base64', JSON.stringify(lsBase64));
              }
            }
          }

          if (savedBase64 && savedBase64.length > 0) {
            // จำกัดสูงสุด 15 รูป (ถ้ามาเกิน เอาแค่ 15 รูปแรก)
            const limitedBase64 = savedBase64.slice(0, 15);

            // แปลง base64 กลับเป็น File objects
            const files = limitedBase64.map((base64, index) =>
              base64ToFile(base64, `image-${Date.now()}-${index}.webp`),
            );

            // สร้าง Blob URL สำหรับ preview
            const previewUrls = files.map((file) => URL.createObjectURL(file));

            imageUpload.setPreviews(previewUrls);
            // IMPORTANT: set ทับเพื่อป้องกันการซ้ำจากการ mount ซ้ำใน dev/StrictMode
            imageUpload.setSelectedFiles(files);
          } else {
            // ถ้าไม่มี base64 data แต่มี Blob URLs (กรณีเก่า) ให้ลบออก
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('create_post_images');
            }
          }
        } catch (e) {
          console.error('Error loading saved images', e);
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('create_post_images');
            sessionStorage.removeItem('create_post_images_base64');
          }
        }
      }
    };

    loadSavedImages();
    setIsInitialized(true);
  }, []);

  // บันทึก caption ลง sessionStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      if (caption) {
        sessionStorage.setItem('create_post_caption', JSON.stringify(caption));
        // backup ลง localStorage เพื่อกันข้อมูลหายกรณี refresh แล้ว sessionStorage หาย
        localStorage.setItem('create_post_caption_ls', JSON.stringify(caption));
      } else {
        sessionStorage.removeItem('create_post_caption');
        localStorage.removeItem('create_post_caption_ls');
      }
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

  // บันทึก step ลง sessionStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('create_post_step', JSON.stringify(step));
      localStorage.setItem('create_post_step_ls', JSON.stringify(step));
    }
  }, [step, isInitialized]);

  // บันทึกรูปภาพลง sessionStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== 'undefined' && imageUpload.selectedFiles.length > 0) {
      // แปลง File objects เป็น base64 และเก็บใน sessionStorage + localStorage
      const saveImagesAsBase64 = async () => {
        try {
          const base64Promises = imageUpload.selectedFiles.map((file: File) =>
            fileToBase64(file),
          );
          const base64Strings = await Promise.all(base64Promises);
          sessionStorage.setItem('create_post_images_base64', JSON.stringify(base64Strings));
          localStorage.setItem('create_post_images_base64_ls', JSON.stringify(base64Strings));
        } catch (error) {
          console.error('Error saving images as base64:', error);
        }
      };
      saveImagesAsBase64();
    } else if (typeof window !== 'undefined' && imageUpload.selectedFiles.length === 0) {
      // ลบข้อมูลรูปภาพออกเมื่อไม่มีรูปแล้ว
      sessionStorage.removeItem('create_post_images');
      sessionStorage.removeItem('create_post_images_base64');
      localStorage.removeItem('create_post_images_base64_ls');
    }
  }, [imageUpload.selectedFiles, isInitialized]);
}

