'use client'
import { useState, useEffect, use, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const LAO_PROVINCES = [
  "ຜົ້ງສາລີ", "ຫຼວງນ້ຳທາ", "ອຸດົມໄຊ", "ບໍ່ແກ້ວ", "ຫຼວງພະບາງ", "ຫົວພັນ", 
  "ໄຊຍະບູລີ", "ຊຽງຂວາງ", "ໄຊສົມບູນ", "ວຽງຈັນ", "ນະຄອນຫຼວງວຽງຈັນ", 
  "ບໍລິຄຳໄຊ", "ຄຳມ່ວນ", "ສະຫວັນນະເຂດ", "ສາລະວັນ", "ເຊກອງ", "ຈຳປາສັກ", "ອັດຕະປື"
];

export default function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [province, setProvince] = useState('');
  const [images, setImages] = useState<string[]>([]); // รูปเดิมจาก DB
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]); // ไฟล์รูปใหม่
  const [newPreviews, setNewPreviews] = useState<string[]>([]); // Preview รูปใหม่
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [showProvinceList, setShowProvinceList] = useState(false);
  const [userProfile, setUserProfile] = useState<{username: string, avatar_url: string | null}>({
    username: 'User',
    avatar_url: null
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
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

      // ดึงข้อมูล Profile
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', session.user.id)
          .single();
        if (profile) setUserProfile(profile);
      }
      setLoading(false);
    };
    fetchData();
  }, [id, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setNewImageFiles(prev => [...prev, ...files]);
      const previews = files.map(file => URL.createObjectURL(file));
      setNewPreviews(prev => [...prev, ...previews]);
    }
  };

  const removeImage = (index: number, isNew: boolean) => {
    if (isNew) {
      const updatedFiles = [...newImageFiles];
      updatedFiles.splice(index, 1);
      setNewImageFiles(updatedFiles);

      const updatedPreviews = [...newPreviews];
      URL.revokeObjectURL(updatedPreviews[index]);
      updatedPreviews.splice(index, 1);
      setNewPreviews(updatedPreviews);
    } else {
      const updatedImages = [...images];
      updatedImages.splice(index, 1);
      setImages(updatedImages);
    }

    if (images.length === 0 && newPreviews.length === 0) {
      setIsViewing(false);
    }
  };

  const PhotoPreviewGrid = () => {
    const allImages = [...images, ...newPreviews];
    const count = allImages.length;
    if (count === 0) return null;

    return (
      <div onClick={() => setIsViewing(true)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', cursor: 'pointer', background: '#f0f0f0' }}>
        {allImages.slice(0, 4).map((img, i) => (
          <div key={i} style={{ position: 'relative', height: '200px' }}>
            <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {i === 3 && count > 4 && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>+{count - 4}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const handleUpdate = async () => {
    setUploading(true);
    try {
      let finalImages = [...images];

      // อัปโหลดรูปภาพใหม่
      for (const file of newImageFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('car-images').upload(`updates/${fileName}`, file);
        
        if (uploadData) {
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

      if (error) throw error;
      router.push('/');
      router.refresh();
    } catch (err) {
      alert("ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
<style>{`
@keyframes fadeColor { 0%, 100% { background: #f0f0f0; } 12.5% { background: #1a1a1a; } 25% { background: #4a4a4a; } 37.5% { background: #6a6a6a; } 50% { background: #8a8a8a; } 62.5% { background: #b0b0b0; } 75% { background: #d0d0d0; } 87.5% { background: #e5e5e5; } }
.loading-spinner-circle { display: inline-block; width: 40px; height: 40px; position: relative; }
.loading-spinner-circle div { position: absolute; width: 8px; height: 8px; border-radius: 50%; top: 0; left: 50%; margin-left: -4px; transform-origin: 4px 20px; background: #f0f0f0; animation: fadeColor 1s linear infinite; }
.loading-spinner-circle div:nth-child(1) { transform: rotate(0deg); animation-delay: 0s; }
.loading-spinner-circle div:nth-child(2) { transform: rotate(45deg); animation-delay: 0.125s; }
.loading-spinner-circle div:nth-child(3) { transform: rotate(90deg); animation-delay: 0.25s; }
.loading-spinner-circle div:nth-child(4) { transform: rotate(135deg); animation-delay: 0.375s; }
.loading-spinner-circle div:nth-child(5) { transform: rotate(180deg); animation-delay: 0.5s; }
.loading-spinner-circle div:nth-child(6) { transform: rotate(225deg); animation-delay: 0.625s; }
.loading-spinner-circle div:nth-child(7) { transform: rotate(270deg); animation-delay: 0.75s; }
.loading-spinner-circle div:nth-child(8) { transform: rotate(315deg); animation-delay: 0.875s; }
`}</style>
<div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
</div>
);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header หน้าหลัก */}
      <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 100 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '5px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1c1e21" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h3 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>ແກ້ໄຂໂພສ</h3>
        <button 
          onClick={handleUpdate} 
          disabled={uploading}
          style={{ background: 'none', border: 'none', color: '#1877f2', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', minWidth: '45px', textAlign: 'right' }}
        >
          {uploading ? '...' : 'ບັນທຶກ'}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1 }}>
        <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}>
            {userProfile.avatar_url ? (
              <img src={userProfile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="#65676b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{userProfile.username}</div>
            <button 
              onClick={() => setShowProvinceList(!showProvinceList)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f0f2f5', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', marginTop: '2px', cursor: 'pointer' }}
            >
              {province || 'ເລືອກແຂວງ'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>

            {/* Province Dropdown */}
            {showProvinceList && (
              <div style={{ position: 'absolute', top: '100%', left: 0, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '8px', zIndex: 110, width: '200px', maxHeight: '300px', overflowY: 'auto', marginTop: '5px' }}>
                {LAO_PROVINCES.map(p => (
                  <div key={p} onClick={() => { setProvince(p); setShowProvinceList(false); }} style={{ padding: '10px 15px', borderBottom: '1px solid #f0f0f0', fontSize: '14px', background: province === p ? '#e7f3ff' : '#fff' }}>
                    {p} {province === p && '✓'}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <textarea 
          style={{ width: '100%', minHeight: '120px', border: 'none', outline: 'none', fontSize: '16px', padding: '0 15px 15px', resize: 'none' }}
          placeholder="ໃສ່ລາຍລະອຽດລົດ..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        <PhotoPreviewGrid />
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
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ padding: '10px 0' }}>
                {/* รูปจาก Database */}
                {images.map((img, idx) => (
                  <div key={`old-${idx}`} style={{ position: 'relative', marginBottom: '20px' }}>
                    <img src={img} style={{ width: '100%', display: 'block' }} />
                    <button onClick={() => removeImage(idx, false)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
                {/* รูปใหม่ */}
                {newPreviews.map((img, idx) => (
                  <div key={`new-${idx}`} style={{ position: 'relative', marginBottom: '20px' }}>
                    <img src={img} style={{ width: '100%', display: 'block', opacity: 0.8 }} />
                    <button onClick={() => removeImage(idx, true)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}

                {/* ปุ่มเพิ่มรูป (อยู่กึ่งกลาง ล่างสุดใน Viewing Mode) */}
                <div style={{ padding: '30px 15px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#1877f2', fontWeight: 'bold', cursor: 'pointer' }}>
                    <span style={{ fontSize: '24px', color: '#000' }}>➕</span> ເພີ່ມຮູບ
                    <input type="file" multiple accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
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
