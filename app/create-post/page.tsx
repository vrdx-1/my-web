'use client'
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { PhotoPreviewGrid } from '@/components/PhotoPreviewGrid';
import { useProfile } from '@/hooks/useProfile';
import { useImageUpload } from '@/hooks/useImageUpload';

import { LAO_PROVINCES } from '@/utils/constants';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { ProvinceDropdown } from '@/components/ProvinceDropdown';
import { safeParseJSON, safeParseSessionJSON } from '@/utils/storageUtils';

export default function CreatePost() {
 const router = useRouter();
 const textareaRef = useRef<HTMLTextAreaElement>(null);
 const [step, setStep] = useState(2); // เริ่มต้นที่ Step 2 ทันที
 const [caption, setCaption] = useState('');
 const [province, setProvince] = useState('');
 // Use shared image upload hook (replaces selectedFiles, previews, loading states)
 const imageUpload = useImageUpload({ maxFiles: 15 });
 const [isUploading, setIsUploading] = useState(false); 
 const [uploadProgress, setUploadProgress] = useState(0); 
 const [session, setSession] = useState<any>(null);
 const [isViewing, setIsViewing] = useState(false);

 // Use shared profile hook
 const { profile: userProfile } = useProfile();

 useEffect(() => {
 const checkUser = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 setSession(session);
 };
 checkUser();

 // ดึงข้อมูลจากหน้าโฮม
 const pendingImages = safeParseSessionJSON<string[]>('pending_images', []);
 if (pendingImages.length > 0) {
    const processImages = async () => {
      try {
        imageUpload.setPreviews(pendingImages);
        setStep(2); 

        // แปลง Blob URL กลับเป็น File Object เพื่อให้ handleSubmit อัปโหลดได้
        const filePromises = pendingImages.map(async (url: string) => {
            const response = await fetch(url);
            const blob = await response.blob();
            const file = new File([blob], `image-${Date.now()}.webp`, { type: 'image/webp' });
            return file;
        });
        const files = await Promise.all(filePromises);
        imageUpload.setSelectedFiles(prev => [...prev, ...files]);
        
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('pending_images');
        }
      } catch (e) {
        console.error("Error processing pending images", e);
      }
    };
    processImages();
 }

 // ลบ Logic การเปิด file input อัตโนมัติออกเนื่องจากไม่ใช้ Step 1 แล้ว
 }, []); 

 // Removed duplicate functions - using from hooks/useImageUpload.ts and utils/imageCompression.ts
 const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

 // Removed duplicate PhotoPreviewGrid - using from components/PhotoPreviewGrid.tsx

 // Removed duplicate generateGuestToken - using from utils/postUtils

 const handleSubmit = async () => {
 const files = imageUpload.selectedFiles;
 if (imageUpload.loading || isUploading || files.length === 0) return;
 setIsUploading(true);
 setUploadProgress(0);

 try {
 const imageUrls = [];
 const uploadedPaths: string[] = []; // เก็บ paths สำหรับ cleanup
 const isGuest = !session;
 let guestToken = null;
 
 if (isGuest) {
 const myPosts = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
 guestToken = myPosts.length > 0 && myPosts[0]?.token ? myPosts[0].token : getPrimaryGuestToken();
 }
 
 const uploadFolder = session ? session.user.id : 'guest-uploads';
 const totalFiles = files.length;

 for (let i = 0; i < totalFiles; i++) {
 const file = files[i];
 const fileExt = 'webp'; 
 const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
 const filePath = `${uploadFolder}/${fileName}`;

 const { error: uploadError } = await supabase.storage.from('car-images').upload(filePath, file);
 if (uploadError) {
   // Cleanup files ที่ upload แล้วก่อนหน้า
   for (const path of uploadedPaths) {
     await supabase.storage.from('car-images').remove([path]).catch(() => {});
   }
   throw uploadError;
 }

 uploadedPaths.push(filePath);
 const { data: { publicUrl } } = supabase.storage.from('car-images').getPublicUrl(filePath);
 imageUrls.push(publicUrl);
 
 setUploadProgress(Math.round(((i + 1) / totalFiles) * 100)); 
 }

 if (isGuest && guestToken) {
 await supabase.from('profiles').upsert({ id: guestToken, username: 'Guest User', last_seen: new Date().toISOString() }, { onConflict: 'id' });
 } else if (session) {
 await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', session.user.id);
 }

 const { data, error: insertError } = await supabase.from('cars').insert([
 {
 user_id: session ? session.user.id : guestToken, 
 is_guest: isGuest,
 guest_token: guestToken,
 caption: caption,
 province: province,
 images: imageUrls,
 status: 'recommend',
 created_at: new Date().toISOString()
 }
 ]).select();

 if (insertError) {
   // Cleanup uploaded files ถ้า insert ล้มเหลว
   for (const path of uploadedPaths) {
     await supabase.storage.from('car-images').remove([path]).catch(() => {});
   }
   throw insertError;
 }

 if (isGuest && data && data.length > 0) {
 const myPosts = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
 myPosts.push({ post_id: data[0].id, token: guestToken });
 localStorage.setItem('my_guest_posts', JSON.stringify(myPosts));
 }

 router.push('/');
 router.refresh();
 } catch (err: any) {
 console.error(err.message);
 alert(err.message || 'ເກີດຂໍ້ຜິດພາດ');
 } finally {
 setIsUploading(false);
 }
 };

 return (
 <div style={LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX}>
 
 {/* Header */}
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
 <button 
 onClick={() => {
 if (step === 3) {
 setStep(2);
 } else {
 // ถ้าอยู่หน้าเขียน Caption (Step 2) แล้วกดออก ให้เด้งไปหน้าโฮมเลย
 router.push('/');
 }
 }} 
 style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1c1e21', padding: '5px' }}
 >
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="15 18 9 12 15 6"></polyline>
 </svg>
 </button>
 <h3 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
 {step === 2 && 'ສ້າງໂພສ'}
 {step === 3 && 'ລົດຢູ່ແຂວງ'}
 </h3>
 <div style={{ width: '60px', display: 'flex', justifyContent: 'flex-end' }}>
 {step === 2 && caption.trim().length > 0 && (
 <button onClick={() => setStep(3)} style={{ background: '#1877f2', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px' }}>ຕໍ່ໄປ</button>
 )}
 {step === 3 && province && !isUploading && (
 <button onClick={handleSubmit} style={{ background: '#1877f2', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px' }}>ໂພສ</button>
 )}
 </div>
 </div>

 <div style={{ flex: 1, paddingBottom: '100px' }}>
 {step === 2 && (
 <div>
 <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
 {userProfile?.avatar_url ? <img src={userProfile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <svg width="26" height="26" viewBox="0 0 24 24" fill="#65676b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>}
 </div>
 <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{userProfile?.username || 'User'}</div>
 </div>

 <div style={{ padding: '0 15px 15px 15px' }}>
 <textarea 
 ref={textareaRef}
 autoFocus
 style={{ width: '100%', minHeight: '150px', border: 'none', outline: 'none', fontSize: '16px', lineHeight: '1.5', resize: 'none', color: '#000', overflow: 'hidden' }}
 placeholder="ໃສ່ລາຍລະອຽດລົດ..."
 value={caption}
 onChange={(e) => {
 const lines = e.target.value.split('\n');
 if (lines.length <= 15) {
 setCaption(e.target.value);
 if (textareaRef.current) {
 textareaRef.current.style.height = 'auto';
 textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
 }
 }
 }}
 />
 {caption.split('\n').length >= 15 && <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '5px' }}>ສູງສຸດ 15 ແຖວ</div>}
 </div>
 {imageUpload.previews.length > 0 && (
   <PhotoPreviewGrid
     existingImages={[]}
     newPreviews={imageUpload.previews}
     onImageClick={() => setIsViewing(true)}
     onRemoveImage={(index) => removeImage(index)}
     showRemoveButton={true}
   />
 )}
 </div>
 )}

 {step === 3 && (
 <div style={{ padding: '10px 0' }}>
 <ProvinceDropdown
   selectedProvince={province}
   onProvinceChange={setProvince}
   variant="list"
 />
 </div>
 )}
 </div>

 {isUploading && (
 <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.95)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
 <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#1c1e21' }}>ກຳລັງໂພສ</div>
 <div style={{ width: '100%', maxWidth: '300px', height: '12px', background: '#e4e6eb', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
 <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#1877f2', transition: 'width 0.3s ease' }}></div>
 </div>
 <div style={{ marginTop: '10px', fontSize: '16px', fontWeight: 'bold', color: '#1877f2' }}>{uploadProgress}%</div>
 </div>
 )}

 {isViewing && (
 <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 2000, display: 'flex', justifyContent: 'center' }}>
 <div style={{ width: '100%', maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER_WIDTH, height: '100%', background: '#fff', position: 'relative', overflowY: 'auto' }}>
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 10 }}>
 <div style={{ fontWeight: 'bold', fontSize: '18px' }}>ແກ້ໄຂ</div>
 <button onClick={() => setIsViewing(false)} style={{ position: 'absolute', right: '15px', background: 'none', border: 'none', color: '#1877f2', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>ສຳເລັດ</button>
 </div>
 <div style={{ paddingTop: '10px' }}>
 {imageUpload.previews.map((img, idx) => (
 <div key={idx} style={{ width: '100%', marginBottom: '24px', position: 'relative' }}>
 <img src={img} style={{ width: '100%', height: 'auto', display: 'block' }} />
 <button onClick={() => removeImage(idx)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
 </div>
 ))}
 </div>
 <div style={{ height: '50px' }}></div>
 </div>
 </div>
 )}
 </div>
 );
}
