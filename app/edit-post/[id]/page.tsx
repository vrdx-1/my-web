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
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const initialRef = useRef<{ caption: string; province: string; images: string[] } | null>(null);

  // Use shared profile hook
  const { profile: userProfile } = useProfile();

  const adjustCaptionHeight = () => {
    const el = captionRef.current;
    if (!el) return;
    el.style.overflow = 'hidden';
    el.style.height = '0';
    const h = Math.max(24, el.scrollHeight);
    el.style.height = `${h}px`;
  };

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

      const cap = post.caption || '';
      const prov = post.province || '';
      const imgs = post.images || [];
      setCaption(cap);
      setProvince(prov);
      setImages(imgs);
      initialRef.current = { caption: cap, province: prov, images: imgs };
      setLoading(false);
    };
    fetchData();
  }, [id, router]);

  const hasChanges = Boolean(
    !loading &&
      initialRef.current &&
      (caption !== initialRef.current.caption ||
        province !== initialRef.current.province ||
        JSON.stringify(images) !== JSON.stringify(initialRef.current.images) ||
        imageUpload.previews.length > 0)
  );

  const hasChangesRef = useRef(false);
  hasChangesRef.current = hasChanges;
  const allowLeaveRef = useRef(false);

  const handleBack = () => {
    if (hasChangesRef.current) {
      setShowLeaveConfirm(true);
      return;
    }
    allowLeaveRef.current = true;
    router.back();
  };

  const handleDiscardAndBack = () => {
    allowLeaveRef.current = true;
    setShowLeaveConfirm(false);
    router.back();
  };


  const handleLeaveCancel = () => {
    setShowLeaveConfirm(false);
  };

  useEffect(() => {
    if (!showLeaveConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleLeaveCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showLeaveConfirm]);

  useEffect(() => {
    if (!loading) {
      const onBeforeUnload = (e: BeforeUnloadEvent) => {
        if (hasChangesRef.current && !allowLeaveRef.current) {
          e.preventDefault();
        }
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      const id = requestAnimationFrame(() => {
        adjustCaptionHeight();
        requestAnimationFrame(adjustCaptionHeight);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [loading, caption]);

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

  const handleUpdate = async (goBackAfterSave?: boolean) => {
    if (!province) {
      alert('ກະລຸນາເລືອກແຂວງ');
      return;
    }
    if (images.length === 0 && imageUpload.selectedFiles.length === 0) {
      alert('ກະລຸນາເລືອກຮູບພາບຢ່າງໜ້ອຍ 1 ຮູບ');
      return;
    }
    setUploading(true);
    const uploadedPaths: string[] = [];
    try {
      let finalImages = [...images];

      for (const file of imageUpload.selectedFiles) {
        const fileExt = file.name.split('.').pop() || 'webp';
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `updates/${fileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('car-images').upload(filePath, file);

        if (uploadError) {
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
        .update({ caption, province, images: finalImages })
        .eq('id', id);

      if (error) {
        for (const path of uploadedPaths) {
          await supabase.storage.from('car-images').remove([path]).catch(() => {});
        }
        throw error;
      }
      if (goBackAfterSave) {
        allowLeaveRef.current = true;
        router.back();
      } else {
        router.push('/');
      }
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
      
      {/* Header หน้าหลัก — แสดงปุ่มບັນທຶກ เฉพาะเมื่อมีการแก้ไข กด back ไม่บันทึก */}
      <PageHeader
        title="ແກ້ໄຂ"
        onBack={handleBack}
        centerTitle={!hasChanges}
        actionButton={
          hasChanges
            ? {
                label: uploading ? '...' : 'ບັນທຶກ',
                onClick: () => handleUpdate(),
                disabled: uploading,
                variant: 'pill',
              }
            : undefined
        }
      />

      {/* Body */}
      <div style={{ flex: 1 }}>
        <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden', flexShrink: 0 }}>
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            ) : (
              <svg width="50" height="50" viewBox="0 0 24 24" fill="#65676b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', fontSize: '18px', lineHeight: '24px' }}>{userProfile?.username || 'User'}</div>
            <ProvinceDropdown
              selectedProvince={province}
              onProvinceChange={setProvince}
              variant="button"
            />
          </div>
        </div>

        {/* Caption: แสดงทั้งหมด ขยายตามเนื้อหา ไม่มี scroll */}
        <div style={{ padding: '0 15px 10px 15px' }}>
          <textarea
            ref={captionRef}
            style={{
              width: '100%',
              minHeight: '24px',
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              lineHeight: '1.4',
              padding: 0,
              resize: 'none',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'inherit',
              display: 'block',
              boxSizing: 'border-box',
            }}
            placeholder="ໃສ່ລາຍລະອຽດລົດ..."
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value);
              setTimeout(adjustCaptionHeight, 0);
            }}
          />
        </div>

            <PhotoPreviewGrid
              existingImages={images}
              newPreviews={imageUpload.previews}
              onImageClick={() => setIsViewing(true)}
              showRemoveButton={false}
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
          {/* Header Viewing Mode — โครง + ขนาดเท่ากับ PageHeader หน้า ແກ້ໄຂໂພສ */}
          <div
            style={{
              padding: '10px 15px',
              borderBottom: '1px solid #f0f0f0',
              background: '#fff',
              position: 'sticky',
              top: 0,
              flexShrink: 0,
              zIndex: 10,
              maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER_WIDTH,
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
              }}
            >
              <div style={{ width: '72px', flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '5px', width: 24, height: 24 }} aria-hidden />
              </div>
              <h3
                style={{
                  flex: 1,
                  textAlign: 'center',
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 'bold',
                  minWidth: 0,
                }}
              >
                ແກ້ໄຂ
              </h3>
              <div style={{ width: '72px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsViewing(false)}
                  style={{
                    background: '#1877f2',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: '20px',
                  }}
                >
                  ສຳເລັດ
                </button>
              </div>
            </div>
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

      {/* Modal ยืนยัน — ທ່ານຕ້ອງການບັນທຶກການແກ້ໄຂບໍ? */}
      {showLeaveConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 2500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={handleLeaveCancel}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '320px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={handleDiscardAndBack}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#e4e6eb',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#1c1e21',
                  cursor: 'pointer',
                }}
              >
                ຖິ້ມການແກ້ໄຂ
              </button>
              <button
                type="button"
                onClick={handleLeaveCancel}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#1877f2',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                ແກ້ໄຂຕໍ່
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
