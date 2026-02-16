'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { safeParseJSON } from '@/utils/storageUtils';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { compressImage } from '@/utils/imageCompression';

interface UseCreatePostUploadParams {
  session: any;
  caption: string;
  province: string;
  imageUpload: any;
}

export function useCreatePostUpload({
  session,
  caption,
  province,
  imageUpload,
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
              last_seen: new Date().toISOString(),
            },
            { onConflict: 'id' },
          );
      } else if (session) {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', session.user.id);
      }

      const { data, error: insertError } = await supabase
        .from('cars')
        .insert([
          {
            user_id: session ? session.user.id : guestToken,
            is_guest: isGuest,
            guest_token: guestToken,
            caption: caption,
            province: province,
            images: imageUrls,
            status: 'recommend',
            created_at: new Date().toISOString(),
          },
        ])
        .select();

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

      // บันทึก ID ของโพสต์ที่เพิ่งสร้าง เพื่อให้หน้า Home ดึงมาแสดงไว้บนสุดชั่วคราว
      if (typeof window !== 'undefined' && data && data.length > 0) {
        try {
          window.localStorage.setItem('just_posted_post_id', String(data[0].id));
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
        sessionStorage.removeItem('create_post_step');
        sessionStorage.removeItem('create_post_images');
        sessionStorage.removeItem('create_post_images_base64');
        localStorage.removeItem('create_post_caption_ls');
        localStorage.removeItem('create_post_province_ls');
        localStorage.removeItem('create_post_step_ls');
        localStorage.removeItem('create_post_images_base64_ls');
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      console.error(err.message);
      setIsUploading(false);
    }
  };

  return {
    isUploading,
    uploadProgress,
    handleSubmit,
  };
}

