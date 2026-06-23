'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { safeParseJSON } from '@/utils/storageUtils';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';
import { attachEffectiveWhatsAppPhones } from '@/utils/whatsapp';

const CREATE_POST_REDIRECT_AFTER_SUBMIT_KEY = 'create_post_redirect_after_submit';

interface ImageUploadLike {
  selectedFiles: File[];
  loading: boolean;
}

interface UseCreatePostUploadParams {
  session: Session | null;
  activeProfileId?: string | null;
  caption: string;
  province: string;
  carPrice: string;
  carCurrency: '₭' | '฿' | '$';
  imageUpload: ImageUploadLike;
  layout?: string;
  /** เรียกหลังลบ draft จาก storage เมื่อโพสต์สำเร็จ (เช่น ล้าง caption backup ระดับโมดูล) */
  onDraftCleared?: () => void;
}

export function useCreatePostUpload({
  session,
  activeProfileId,
  caption,
  province,
  carPrice,
  carCurrency,
  imageUpload,
  layout = 'five-images-side',
  onDraftCleared,
}: UseCreatePostUploadParams) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhaseLabel, setUploadPhaseLabel] = useState('');

  // Real progress ceiling — display never exceeds this
  const realProgressRef = useRef(0);
  const animIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgressAnimation = useCallback(() => {
    realProgressRef.current = 0;
    setUploadProgress(0);

    animIntervalRef.current = setInterval(() => {
      setUploadProgress(prev => {
        const target = realProgressRef.current;
        if (prev >= 100) return 100;
        // Asymptotic: fast when far, slow when close — minimum 0.15% per tick
        const gap = target - prev;
        const step = Math.max(0.15, gap * 0.1);
        return Math.min(prev + step, target);
      });
    }, 50);
  }, []);

  const stopProgressAnimation = useCallback(() => {
    if (animIntervalRef.current !== null) {
      clearInterval(animIntervalRef.current);
      animIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopProgressAnimation();
  }, [stopProgressAnimation]);

  // XHR-based upload to Supabase Storage for real byte progress
  const uploadFileWithProgress = useCallback(
    (filePath: string, file: File, onProgress: (pct: number) => void): Promise<void> => {
      return new Promise((resolve, reject) => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const accessToken = session?.access_token ?? anonKey ?? '';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${supabaseUrl}/storage/v1/object/car-images/${filePath}`);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('Cache-Control', 'max-age=3600');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(e.loaded / e.total);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.onabort = () => reject(new Error('Upload aborted'));
        xhr.send(file);
      });
    },
    [session],
  );

  const handleSubmit = async () => {
    const files: File[] = imageUpload.selectedFiles.slice(0, 15);
    if (imageUpload.loading || isUploading || files.length === 0) return;
    setIsUploading(true);
    startProgressAnimation();

    // Phase 1: Preparation (0 → 15%)
    setUploadPhaseLabel('ກຳລັງກຽມຮູບ...');
    realProgressRef.current = 15;

    try {
      const imageUrls: string[] = [];
      const uploadedPaths: string[] = []; // เก็บ paths สำหรับ cleanup
      const isGuest = !session;
      let guestToken: string | null = null;

      if (isGuest) {
        const myPosts = safeParseJSON<Array<{ post_id: string; token: string }>>(
          'my_guest_posts',
          [],
        );
        guestToken =
          myPosts.length > 0 && myPosts[0]?.token ? myPosts[0].token : getPrimaryGuestToken();
      }

      const uploadFolder = session ? session.user.id : 'guest-uploads';
      const totalFiles = files.length;

      // Phase 2: Upload files (15 → 85%) — real XHR progress per file
      setUploadPhaseLabel('ກຳລັງອັບໂຫລດຮູບ...');

      // Total bytes across all files for overall progress calculation
      const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
      const uploadedBytes: number[] = new Array(totalFiles).fill(0);

      const updateUploadProgress = () => {
        const loadedBytes = uploadedBytes.reduce((a, b) => a + b, 0);
        const filePct = totalBytes > 0 ? loadedBytes / totalBytes : 0;
        // Map 0→1 file progress to 15→85 display range
        realProgressRef.current = 15 + filePct * 70;
      };

      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const fileExt =
          file.type === 'image/jpeg'
            ? 'jpg'
            : file.type === 'image/png'
              ? 'png'
              : file.type === 'image/webp'
                ? 'webp'
                : (file.name.split('.').pop() || 'jpg').toLowerCase();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `${uploadFolder}/${fileName}`;

        try {
          await uploadFileWithProgress(filePath, file, (ratio) => {
            uploadedBytes[i] = file.size * ratio;
            updateUploadProgress();
          });
        } catch {
          // XHR failed — fallback to supabase client
          const { error: uploadError } = await supabase.storage
            .from('car-images')
            .upload(filePath, file);
          if (uploadError) {
            for (const path of uploadedPaths) {
              await supabase.storage.from('car-images').remove([path]).catch(() => {});
            }
            throw uploadError;
          }
        }

        uploadedBytes[i] = file.size;
        updateUploadProgress();

        uploadedPaths.push(filePath);
        const {
          data: { publicUrl },
        } = supabase.storage.from('car-images').getPublicUrl(filePath);
        imageUrls.push(publicUrl);
      }

      // Phase 3: Save to database (85 → 99%)
      setUploadPhaseLabel('ກຳລັງບັນທຶກ...');
      realProgressRef.current = 92;

      if (isGuest && guestToken) {
        await supabase
          .from('profiles')
          .upsert(
            {
              id: guestToken,
              username: 'Guest User',
            },
            { onConflict: 'id' },
          );
      }

      const normalizedPrice = carPrice.replace(/\D/g, '');
      const priceValue = normalizedPrice ? Number(normalizedPrice) : null;

      // ลอง insert โดยใส่ layout / price field ก่อน
      const insertData: Record<string, unknown> = {
        user_id: session ? (activeProfileId || session.user.id) : guestToken,
        is_guest: isGuest,
        guest_token: guestToken,
        caption: caption,
        province: province,
        images: imageUrls,
        status: 'recommend',
        is_hidden: false,
        created_at: new Date().toISOString(),
      };

      if (priceValue && Number.isFinite(priceValue)) {
        insertData.price = priceValue;
        insertData.price_currency = carCurrency || '₭';
      }

      // เพิ่ม layout field ถ้ามี 6+ รูป
      if (imageUrls.length >= 6) {
        insertData.layout = layout;
      }

      let { data, error: insertError } = await supabase
        .from('cars')
        .insert([insertData])
        .select();

      // ถ้า DB ยังไม่มี optional columns บางตัว ให้ลอง insert อีกครั้งโดยตัด field นั้นออก
      if (
        insertError &&
        insertError.message &&
        (insertError.message.includes('layout') ||
          insertError.message.includes('price') ||
          insertError.message.includes('price_currency'))
      ) {
        delete insertData.layout;
        delete insertData.price;
        delete insertData.price_currency;
        const retryResult = await supabase
          .from('cars')
          .insert([insertData])
          .select();
        data = retryResult.data;
        insertError = retryResult.error;
      }

      if (insertError) {
        // Cleanup uploaded files ถ้า insert ล้มเหลว
        for (const path of uploadedPaths) {
          await supabase.storage.from('car-images').remove([path]).catch(() => {});
        }
        throw insertError;
      }

      if (isGuest && data && data.length > 0 && guestToken) {
        const myPosts = safeParseJSON<Array<{ post_id: string; token: string }>>(
          'my_guest_posts',
          [],
        );
        myPosts.push({ post_id: data[0].id, token: guestToken });
        localStorage.setItem('my_guest_posts', JSON.stringify(myPosts));
      }

      // บันทึกโพสต์ที่เพิ่งสร้างแบบเต็ม (พร้อม profile) เพื่อให้หน้า Home แสดงทันทีโดยไม่กระพริบ
      if (typeof window !== 'undefined' && data && data.length > 0) {
        try {
          const { data: fullPost } = await supabase
            .from('cars')
            .select(POST_WITH_PROFILE_SELECT)
            .eq('id', data[0].id)
            .maybeSingle();
          const [hydratedPost] = fullPost ? await attachEffectiveWhatsAppPhones(supabase, [fullPost]) : [];
          if (hydratedPost && hydratedPost.status === 'recommend' && !hydratedPost.is_hidden) {
            window.localStorage.setItem('just_posted_post', JSON.stringify(hydratedPost));
          }
          window.localStorage.setItem('just_posted_post_id', String(data[0].id));
          // เก็บรูปที่เพิ่งอัปโหลดเป็น data URL เพื่อให้หน้าโฮมแสดงรูปทันทีโดยไม่เห็น Skeleton (ใช้เฉพาะโพสที่พึ่งโพส แล้วลบหลังใช้)
          try {
            const fileToDataUrl = (file: File): Promise<string> =>
              new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result as string);
                r.onerror = () => reject(r.error);
                r.readAsDataURL(file);
              });
            const dataUrls = await Promise.all(files.map(fileToDataUrl));
            sessionStorage.setItem('just_posted_post_preload', JSON.stringify(dataUrls));
          } catch {
            // ข้ามถ้า sessionStorage เต็มหรือแปลงรูปไม่สำเร็จ
          }
        } catch {
          // ถ้า localStorage ใช้งานไม่ได้ ให้ข้ามโดยไม่กระทบ flow เดิม
        }
      }

      // บันทึกแขวงที่เลือกไว้ล่าสุดใน localStorage
      if (typeof window !== 'undefined' && province) {
        localStorage.setItem('last_selected_province', JSON.stringify(province));
      }

      // ลบข้อมูลจาก sessionStorage / localStorage เมื่อโพสต์สำเร็จ
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('create_post_caption');
        sessionStorage.removeItem('create_post_province');
        sessionStorage.removeItem('create_post_price');
        sessionStorage.removeItem('create_post_currency');
        sessionStorage.removeItem('create_post_step');
        sessionStorage.removeItem('create_post_layout');
        localStorage.removeItem('create_post_caption_ls');
        localStorage.removeItem('create_post_province_ls');
        localStorage.removeItem('create_post_price_ls');
        localStorage.removeItem('create_post_currency_ls');
        localStorage.removeItem('create_post_step_ls');
        localStorage.removeItem('create_post_layout_ls');
      }
      onDraftCleared?.();

      // Snap to 100% and wait briefly for visual satisfaction
      setUploadPhaseLabel('ສຳເລັດ!');
      realProgressRef.current = 100;
      setUploadProgress(100);
      stopProgressAnimation();
      await new Promise(r => setTimeout(r, 400));

      let redirectPath = '/';
      if (typeof window !== 'undefined') {
        const storedRedirectPath = window.sessionStorage.getItem(CREATE_POST_REDIRECT_AFTER_SUBMIT_KEY);
        if (storedRedirectPath === '/my-posts') {
          redirectPath = '/my-posts';
        }
        window.sessionStorage.removeItem(CREATE_POST_REDIRECT_AFTER_SUBMIT_KEY);
      }

      router.push(redirectPath);
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : err);
      stopProgressAnimation();
      setIsUploading(false);
    }
  };

  return {
    isUploading,
    uploadProgress,
    uploadPhaseLabel,
    handleSubmit,
  };
}

