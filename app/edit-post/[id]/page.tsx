'use client'
import { useState, useEffect, use, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { PhotoPreviewGrid } from '@/components/PhotoPreviewGrid';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { useProfile } from '@/hooks/useProfile';
import { useImageUpload } from '@/hooks/useImageUpload';

import { LAO_PROVINCES } from '@/utils/constants';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { ProvinceDropdown } from '@/components/ProvinceDropdown';

export default function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [caption, setCaption] = useState('');
  const [province, setProvince] = useState('');
  const [images, setImages] = useState<string[]>([]); // รูปเดิมจาก DB
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  
  // Use shared profile hook
  const { profile: userProfile } = useProfile();

  // Use shared image upload hook for new images
  const imageUpload = useImageUpload({
    maxFiles: 15,
  });

  useEffect(() => {
    const fetchData = async () => {
      // ดึงข้อมูลโพสต์
      const { data: post, error } = await supabase
        .from('cars')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !post) {
        router.back();
        return;
      }

      setCaption(post.caption || '');
      setProvince(post.province || '');
      setImages(post.images || []);
      setLoading(false);
    };
    fetchData();
  }, [id, router]);

  const removeImage = (index: number, isNew: boolean) => {
    if (isNew) {
      imageUpload.removeImage(index);
      // Check after removal: if no images left, close viewing mode
      const remainingNewImages = imageUpload.previews.length - 1;
      if (images.length === 0 && remainingNewImages === 0) {
        setIsViewing(false);
      }
    } else {
      const updatedImages = [...images];
      updatedImages.splice(index, 1);
      setImages(updatedImages);
      // Check after removal: if no images left, close viewing mode
      if (updatedImages.length === 0 && imageUpload.previews.length === 0) {
        setIsViewing(false);
      }
    }
  };

  const handleUpdate = async () => {
    // Validation
    if (!province) {
      alert('ກະລຸນາເລືອກແຂວງ');
      return;
    }
    if (images.length === 0 && imageUpload.selectedFiles.length === 0) {
      alert('ກະລຸນາເລືອກຮູບພາບຢ່າງໜ້ອຍ 1 ຮູບ');
      return;
    }
    setUploading(true);
    const uploadedPaths: string[] = []; // เก็บ paths สำหรับ cleanup
    try {
      let finalImages = [...images];

      // อัปโหลดรูปภาพใหม่ (ใช้ไฟล์ที่ compress แล้วจาก useImageUpload)
      for (const file of imageUpload.selectedFiles) {
        const fileExt = file.name.split('.').pop() || 'webp';
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `updates/${fileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('car-images').upload(filePath, file);
        
        if (uploadError) {
          // Cleanup files ที่ upload แล้วก่อนหน้า
          for (const path of uploadedPaths) {
            await supabase.storage.from('car-images').remove([path]).catch(() => {});
          }
          throw uploadError;
        }
        
        if (uploadData) {
          uploadedPaths.push(uploadData.path);
          const { data: { publicUrl } } = supabase.storage.from('car-images').getPublicUrl(uploadData.path);
          finalImages.push(publicUrl);
        }
      }

      const { error } = await supabase
        .from('cars')
        .update({
          caption,
          province,
          images: finalImages,
        })
        .eq('id', id);

      if (error) {
        // Cleanup uploaded files ถ้า update ล้มเหลว
        for (const path of uploadedPaths) {
          await supabase.storage.from('car-images').remove([path]).catch(() => {});
        }
        throw error;
      }
      router.push('/');
      router.refresh();
    } catch (err: any) {
      alert(err.message || "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
      </div>
    );
  }

  return (
    <div style={LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX}>
      
      {/* Header หน้าหลัก */}
      <PageHeader
        title="ແກ້ໄຂໂພສ"
        actionButton={{
          label: uploading ? '...' : 'ບັນທຶກ',
          onClick: handleUpdate,
          disabled: uploading,
        }}
      />

      {/* Body */}
      <div style={{ flex: 1 }}>
        <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}>
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="#65676b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
            )}
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{userProfile?.username || 'User'}</div>
            <ProvinceDropdown
              selectedProvince={province}
              onProvinceChange={setProvince}
              variant="button"
            />
          </div>
        </div>

        <textarea 
          style={{ width: '100%', minHeight: '120px', border: 'none', outline: 'none', fontSize: '16px', padding: '0 15px 15px', resize: 'none' }}
          placeholder="ໃສ່ລາຍລະອຽດລົດ..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

            <PhotoPreviewGrid
              existingImages={images}
              newPreviews={imageUpload.previews}
              onImageClick={() => setIsViewing(true)}
              onRemoveImage={removeImage}
              showRemoveButton={true}
            />
            
            {/* Hidden file input for adding images in normal mode */}
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={imageUpload.handleFileChange}
              ref={imageUpload.fileInputRef}
              style={{ display: 'none' }}
            />
      </div>

      {/* Viewing Mode Layer */}
      {isViewing && (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          {/* Header Viewing Mode - แก้ไขให้เหมือน Header หลัก 100% */}
          <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0', background: '#fff', position: 'sticky', top: 0, flexShrink: 0 }}>
            {/* ช่องว่างทางซ้ายเพื่อให้ Title อยู่ตรงกลางเหมือนหน้าหลัก */}
            <div style={{ width: '34px' }}></div> 
            <h3 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>ແກ້ໄຂ</h3>
            <button 
              onClick={() => setIsViewing(false)} 
              style={{ background: 'none', border: 'none', color: '#1877f2', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', minWidth: '45px', textAlign: 'right' }}
            >
              ສຳເລັດ
            </button>
          </div>

          {/* Scrollable Content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER_WIDTH, margin: '0 auto' }}>
              <div style={{ padding: '10px 0' }}>
                {/* รูปจาก Database */}
                {images.map((img, idx) => (
                  <div key={`old-${idx}`} style={{ position: 'relative', marginBottom: '20px' }}>
                    <img src={img} style={{ width: '100%', display: 'block' }} />
                    <button onClick={() => removeImage(idx, false)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
                {/* รูปใหม่ */}
                {imageUpload.previews.map((img, idx) => (
                  <div key={`new-${idx}`} style={{ position: 'relative', marginBottom: '20px' }}>
                    <img src={img} style={{ width: '100%', display: 'block', opacity: 0.8 }} />
                    <button onClick={() => removeImage(idx, true)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}

                {/* ปุ่มเพิ่มรูป (อยู่กึ่งกลาง ล่างสุดใน Viewing Mode) */}
                <div style={{ padding: '30px 15px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#1877f2', fontWeight: 'bold', cursor: 'pointer' }}>
                    <span style={{ fontSize: '24px', color: '#000' }}>➕</span> ເພີ່ມຮູບ
                    <input type="file" multiple accept="image/*" onChange={imageUpload.handleFileChange} ref={imageUpload.fileInputRef} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
