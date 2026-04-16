'use client';

import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { safeParseJSON } from '@/utils/storageUtils';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { compressImage } from '@/utils/imageCompression';
import { POST_WITH_PROFILE_SELECT } from '@/utils/queryOptimizer';

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

  const handleSubmit = async () => {
    const files: File[] = imageUpload.selectedFiles.slice(0, 15);
    if (imageUpload.loading || isUploading || files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);

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

      // บีบอัดรูปทั้งหมดก่อนอัปโหลด (มาตรฐานสากล: quality 82%, maxWidth 1080px)
      // ใช้ maxWidth 1080px และ quality 0.82 ตามมาตรฐานเว็บใหญ่ระดับโลก
      const compressedFiles = await Promise.all(
        files.map((file) => compressImage(file, 1080, 0.82)),
      );

      for (let i = 0; i < totalFiles; i++) {
        const file = compressedFiles[i];
        const fileExt = file.type === 'image/jpeg' ? 'jpg' : 'webp';
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `${uploadFolder}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('car-images')
          .upload(filePath, file);
        if (uploadError) {
          // Cleanup files ที่ upload แล้วก่อนหน้า
          for (const path of uploadedPaths) {
            await supabase.storage.from('car-images').remove([path]).catch(() => {});
          }
          throw uploadError;
        }

        uploadedPaths.push(filePath);
        const {
          data: { publicUrl },
        } = supabase.storage.from('car-images').getPublicUrl(filePath);
        imageUrls.push(publicUrl);

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

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

      let privateShopId: string | null = null;
      if (typeof window !== 'undefined') {
        const raw = window.sessionStorage.getItem('create_post_private_shop');
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { id?: string };
            if (parsed.id) {
              privateShopId = parsed.id;
            }
          } catch {
            // ignore parse error
          }
        }
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

      if (privateShopId) {
        insertData.private_shop_id = privateShopId;
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
          if (fullPost && fullPost.status === 'recommend' && !fullPost.is_hidden) {
            window.localStorage.setItem('just_posted_post', JSON.stringify(fullPost));
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
            const dataUrls = await Promise.all(compressedFiles.map(fileToDataUrl));
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
        sessionStorage.removeItem('create_post_private_shop');
        localStorage.removeItem('create_post_caption_ls');
        localStorage.removeItem('create_post_province_ls');
        localStorage.removeItem('create_post_price_ls');
        localStorage.removeItem('create_post_currency_ls');
        localStorage.removeItem('create_post_step_ls');
        localStorage.removeItem('create_post_layout_ls');
      }
      onDraftCleared?.();

      router.push('/');
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : err);
      setIsUploading(false);
    }
  };

  return {
    isUploading,
    uploadProgress,
    handleSubmit,
  };
}

