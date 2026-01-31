'use client'
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { PhotoPreviewGrid } from '@/components/PhotoPreviewGrid';
import { useProfile } from '@/hooks/useProfile';
import { useImageUpload } from '@/hooks/useImageUpload';
import { Avatar } from '@/components/Avatar';

import { LAO_PROVINCES } from '@/utils/constants';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { ProvinceDropdown } from '@/components/ProvinceDropdown';
import { safeParseJSON, safeParseSessionJSON } from '@/utils/storageUtils';
import { compressImage } from '@/utils/imageCompression';

// Helper function: แปลง File เป็น base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper function: แปลง base64 เป็น File
const base64ToFile = (base64: string, filename: string): File => {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/webp';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

export default function CreatePost() {
 const router = useRouter();
 const textareaRef = useRef<HTMLTextAreaElement>(null);
 
 const [step, setStep] = useState(2);
 const [caption, setCaption] = useState('');
 const [province, setProvince] = useState('');
 // Use shared image upload hook (replaces selectedFiles, previews, loading states)
 const imageUpload = useImageUpload({ maxFiles: 15 });
 const [isUploading, setIsUploading] = useState(false); 
 const [uploadProgress, setUploadProgress] = useState(0); 
 const [session, setSession] = useState<any>(null);
 const [isViewing, setIsViewing] = useState(false);
 const [isInitialized, setIsInitialized] = useState(false);
 const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
 const [showVideoAlert, setShowVideoAlert] = useState(false);

 // Use shared profile hook
 const { profile: userProfile } = useProfile();

 useEffect(() => {
 const checkUser = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 setSession(session);
 };
 checkUser();

// โหลดข้อมูลจาก sessionStorage
const savedCaption = safeParseSessionJSON<string>('create_post_caption', '');
const savedProvince = safeParseSessionJSON<string>('create_post_province', '');
const savedStep = safeParseSessionJSON<number>('create_post_step', 2);
// ไม่ต้องโหลด savedImages ที่นี่ เพราะจะโหลดใน loadSavedImages แทน
 
// โหลด caption, province, step
if (savedCaption) setCaption(savedCaption);
if (savedProvince) {
  setProvince(savedProvince);
} else {
  // ถ้าไม่มี province จาก sessionStorage ให้โหลดจาก localStorage (แขวงที่เลือกล่าสุด)
  const lastProvince = safeParseJSON<string>('last_selected_province', '');
  if (lastProvince) setProvince(lastProvince);
}
if (savedStep) setStep(savedStep);

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
           return new File([blob], `image-${Date.now()}-${index}.webp`, { type: 'image/webp' });
         } catch (error) {
           console.error(`Error loading image at index ${index}:`, error);
           return null;
         }
       });
       
       const files = await Promise.all(filePromises);
       const validFiles = files.filter((file): file is File => file !== null).slice(0, 15);
       
       if (validFiles.length > 0) {
         // สร้าง Blob URL สำหรับ preview
         const previewUrls = validFiles.map(file => URL.createObjectURL(file));
         imageUpload.setPreviews(previewUrls);
         // IMPORTANT: อย่า append ซ้ำ (React StrictMode ใน dev อาจเรียก useEffect ซ้ำ)
         // ให้ set ทับเพื่อป้องกันรูปถูกอัปโหลด/บันทึกซ้ำจนเห็นเป็น ×2 หลังโพสต์
         imageUpload.setSelectedFiles(validFiles);
         
         // แปลงเป็น base64 และเก็บใน sessionStorage
         const base64Promises = validFiles.map(file => fileToBase64(file));
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
       console.error("Error processing pending images", e);
     }
   } 
   // โหลดรูปภาพจาก sessionStorage (base64)
   else {
     try {
       // ตรวจสอบว่ามี base64 data หรือไม่
       const savedBase64 = safeParseSessionJSON<string[]>('create_post_images_base64', []);
       
       if (savedBase64.length > 0) {
         // จำกัดสูงสุด 15 รูป (ถ้ามาเกิน เอาแค่ 15 รูปแรก)
         const limitedBase64 = savedBase64.slice(0, 15);

         // แปลง base64 กลับเป็น File objects
         const files = limitedBase64.map((base64, index) => 
           base64ToFile(base64, `image-${Date.now()}-${index}.webp`)
         );
         
         // สร้าง Blob URL สำหรับ preview
         const previewUrls = files.map(file => URL.createObjectURL(file));
         
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
       console.error("Error loading saved images", e);
       if (typeof window !== 'undefined') {
         sessionStorage.removeItem('create_post_images');
         sessionStorage.removeItem('create_post_images_base64');
       }
     }
   }
 };
 
 loadSavedImages();
 setIsInitialized(true);

 // ลบ Logic การเปิด file input อัตโนมัติออกเนื่องจากไม่ใช้ Step 1 แล้ว
 }, []);

 // Set initial height for textarea และอัพเดทเมื่อ caption เปลี่ยน
 useEffect(() => {
   if (textareaRef.current) {
     textareaRef.current.style.height = 'auto';
     textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
   }
 }, [caption]);

 // บันทึก caption ลง sessionStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
 useEffect(() => {
   if (!isInitialized) return;
   if (typeof window !== 'undefined') {
     if (caption) {
       sessionStorage.setItem('create_post_caption', JSON.stringify(caption));
     } else {
       sessionStorage.removeItem('create_post_caption');
     }
   }
 }, [caption, isInitialized]);

 // บันทึก province ลง sessionStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
 useEffect(() => {
   if (!isInitialized) return;
   if (typeof window !== 'undefined') {
     if (province) {
       sessionStorage.setItem('create_post_province', JSON.stringify(province));
     } else {
       sessionStorage.removeItem('create_post_province');
     }
   }
 }, [province, isInitialized]);

 // บันทึก step ลง sessionStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
 useEffect(() => {
   if (!isInitialized) return;
   if (typeof window !== 'undefined') {
     sessionStorage.setItem('create_post_step', JSON.stringify(step));
   }
 }, [step, isInitialized]);

 // บันทึกรูปภาพลง sessionStorage เมื่อมีการเปลี่ยนแปลง (หลังจาก initialization)
 useEffect(() => {
   if (!isInitialized) return;
   if (typeof window !== 'undefined' && imageUpload.selectedFiles.length > 0) {
     // แปลง File objects เป็น base64 และเก็บใน sessionStorage
     const saveImagesAsBase64 = async () => {
       try {
         const base64Promises = imageUpload.selectedFiles.map(file => fileToBase64(file));
         const base64Strings = await Promise.all(base64Promises);
         sessionStorage.setItem('create_post_images_base64', JSON.stringify(base64Strings));
       } catch (error) {
         console.error('Error saving images as base64:', error);
       }
     };
     saveImagesAsBase64();
   } else if (typeof window !== 'undefined' && imageUpload.selectedFiles.length === 0) {
     // ลบข้อมูลรูปภาพออกเมื่อไม่มีรูปแล้ว
     sessionStorage.removeItem('create_post_images');
     sessionStorage.removeItem('create_post_images_base64');
   }
 }, [imageUpload.selectedFiles, isInitialized]); 

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
   // ลบข้อมูลจาก sessionStorage
   if (typeof window !== 'undefined') {
     sessionStorage.removeItem('create_post_caption');
     sessionStorage.removeItem('create_post_province');
     sessionStorage.removeItem('create_post_step');
     sessionStorage.removeItem('create_post_images');
     sessionStorage.removeItem('create_post_images_base64');
   }
   setShowLeaveConfirm(false);
   router.push('/');
 };

 const handleLeaveCancel = () => {
   setShowLeaveConfirm(false);
 };

 // ปิด modal เมื่อกด Escape
 useEffect(() => {
   if (!showLeaveConfirm) return;
   const onKey = (e: KeyboardEvent) => {
     if (e.key === 'Escape') handleLeaveCancel();
   };
   window.addEventListener('keydown', onKey);
   return () => window.removeEventListener('keydown', onKey);
 }, [showLeaveConfirm]);

 useEffect(() => {
   if (!showVideoAlert) return;
   const onKey = (e: KeyboardEvent) => {
     if (e.key === 'Escape') setShowVideoAlert(false);
   };
   window.addEventListener('keydown', onKey);
   return () => window.removeEventListener('keydown', onKey);
 }, [showVideoAlert]);

 // Removed duplicate PhotoPreviewGrid - using from components/PhotoPreviewGrid.tsx

 // Removed duplicate generateGuestToken - using from utils/postUtils

const handleSubmit = async () => {
const files = imageUpload.selectedFiles.slice(0, 15);
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

// บีบอัดรูปทั้งหมดก่อนอัปโหลด (quality: 0.75, maxWidth: 1200)
const compressedFiles = await Promise.all(
  files.map((file) => compressImage(file, 1200, 0.75))
);

for (let i = 0; i < totalFiles; i++) {
const file = compressedFiles[i];
const fileExt = file.type === 'image/jpeg' ? 'jpg' : 'webp';
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

 if (isGuest && data && data.length > 0 && guestToken) {
 const myPosts = safeParseJSON<Array<{ post_id: string; token: string }>>('my_guest_posts', []);
 myPosts.push({ post_id: data[0].id, token: guestToken });
 localStorage.setItem('my_guest_posts', JSON.stringify(myPosts));
 }

// บันทึกแขวงที่เลือกไว้ล่าสุดใน localStorage
if (typeof window !== 'undefined' && province) {
  localStorage.setItem('last_selected_province', JSON.stringify(province));
}

// ลบข้อมูลจาก sessionStorage เมื่อโพสต์สำเร็จ
if (typeof window !== 'undefined') {
  sessionStorage.removeItem('create_post_caption');
  sessionStorage.removeItem('create_post_province');
  sessionStorage.removeItem('create_post_step');
  sessionStorage.removeItem('create_post_images');
  sessionStorage.removeItem('create_post_images_base64');
}

 router.push('/');
 router.refresh();
 } catch (err: any) {
 console.error(err.message);
 setIsUploading(false);
 }
 };

 if (isUploading) {
   return (
     <div style={{ ...LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX, minHeight: '100vh' }}>
       <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
         <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#1c1e21' }}>ກຳລັງໂພສ</div>
         <div style={{ width: '100%', maxWidth: '300px', height: '12px', background: '#e4e6eb', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
           <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#1877f2', transition: 'width 0.3s ease' }}></div>
         </div>
         <div style={{ marginTop: '10px', fontSize: '16px', fontWeight: 'bold', color: '#1877f2' }}>{uploadProgress}%</div>
       </div>
     </div>
   );
 }

 return (
 <div style={LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX}>
 
 {/* Header */}
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
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
 <h3 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '18px', fontWeight: 'bold', minWidth: 0 }}>
 {step === 2 && 'ສ້າງໂພສ'}
 {step === 3 && 'ລົດຢູ່ແຂວງ'}
 </h3>
 <div style={{ width: '72px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
 {step === 2 && caption.trim().length > 0 && (
 <button onClick={() => setStep(3)} style={{ background: '#1877f2', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px' }}>ຕໍ່ໄປ</button>
 )}
{step === 3 && province && !isUploading && (
<button onClick={handleSubmit} style={{ background: '#1877f2', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px' }}>ໂພສ</button>
)}
 </div>
 </div>

 <div style={{ flex: 1, paddingBottom: '100px', minHeight: 0, overflowY: 'auto' }}>
 {step === 2 && (
 <div>
 <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
 <Avatar avatarUrl={userProfile?.avatar_url} size={50} session={session} />
 <div style={{ flex: 1, minWidth: 0 }}>
   <div style={{ fontWeight: 'bold', fontSize: '18px', lineHeight: '24px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
     {userProfile?.username || 'User'}
   </div>
 </div>
 </div>

 <div style={{ padding: '0 15px 15px 15px', display: 'flex', justifyContent: 'center' }}>
 <div style={{ width: '100%', maxWidth: '600px' }}>
                <textarea 
                ref={textareaRef}
                autoFocus
                style={{ width: '100%', minHeight: '24px', height: '24px', border: 'none', outline: 'none', fontSize: '16px', lineHeight: '1.5', resize: 'none', color: '#000', overflow: 'hidden', padding: '0' }}
                placeholder="ລາຍລະອຽດ..."
                value={caption}
                onKeyDown={(e) => {
                  const currentLines = caption.split('\n');
                  const currentLineCount = currentLines.length;
                  
                  // ถ้ามี 15 แถวแล้ว
                  if (currentLineCount >= 15) {
                    // ห้ามกด Enter เพื่อขึ้นแถวใหม่
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      return;
                    }
                    
                    // อนุญาตเฉพาะ Backspace, Delete, Arrow keys, และ modifier keys (Ctrl, Cmd, Alt)
                    // ห้ามพิมพ์ตัวอักษรอื่นๆ ทั้งหมด
                    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'];
                    const isModifierKey = e.ctrlKey || e.metaKey || e.altKey;
                    
                    if (!allowedKeys.includes(e.key) && !isModifierKey && e.key.length === 1) {
                      e.preventDefault();
                      return;
                    }
                  }
                }}
                onPaste={(e) => {
                  const currentLines = caption.split('\n');
                  const currentLineCount = currentLines.length;
                  
                  // ถ้ามี 15 แถวแล้ว ห้าม paste เลย
                  if (currentLineCount >= 15) {
                    e.preventDefault();
                    return;
                  }
                  
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  
                  // ใส่ข้อความที่ paste ลงในตำแหน่ง cursor
                  const target = e.target as HTMLTextAreaElement;
                  const start = target.selectionStart;
                  const end = target.selectionEnd;
                  const currentText = caption;
                  const newText = currentText.substring(0, start) + pastedText + currentText.substring(end);
                  
                  // ตรวจสอบจำนวนแถวรวมและตัดให้เหลือ 15 แถวแรกเสมอ
                  const allLines = newText.split('\n');
                  const finalLines = allLines.slice(0, 15);
                  const finalText = finalLines.join('\n');
                  
                  // อัพเดท state
                  setCaption(finalText);
                  
                  // อัพเดท textarea value โดยตรงเพื่อป้องกันการแสดงข้อความเกิน
                  if (textareaRef.current) {
                    textareaRef.current.value = finalText;
                    
                    // อัพเดทความสูง
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
                    
                    // คืน cursor position (ปรับให้ไม่เกินความยาวใหม่)
                    const newCursorPosition = Math.min(start + pastedText.length, finalText.length);
                    setTimeout(() => {
                      if (textareaRef.current) {
                        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
                      }
                    }, 0);
                  }
                }}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const lines = newValue.split('\n');
                  
                  // ตัดให้เหลือ 15 แถวเสมอ ไม่ว่าจะมาในรูปแบบไหน
                  const limitedLines = lines.slice(0, 15);
                  const limitedValue = limitedLines.join('\n');
                  
                  // อัพเดท state
                  setCaption(limitedValue);
                  
                  // อัพเดท textarea value โดยตรงเพื่อป้องกันการแสดงข้อความเกิน
                  if (textareaRef.current && textareaRef.current.value !== limitedValue) {
                    const cursorPosition = textareaRef.current.selectionStart;
                    textareaRef.current.value = limitedValue;
                    
                    // คืน cursor position (ปรับให้ไม่เกินความยาวใหม่)
                    const newCursorPosition = Math.min(cursorPosition, limitedValue.length);
                    setTimeout(() => {
                      if (textareaRef.current) {
                        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
                      }
                    }, 0);
                  }
                  
                  // อัพเดทความสูงให้ขยายตามเนื้อหา
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
                  }
                }}
                />
 {caption.split('\n').length >= 15 && <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '5px' }}>ສູງສຸດ 15 ແຖວ</div>}
 </div>
 </div>
 {imageUpload.previews.length > 0 && (
   <PhotoPreviewGrid
     existingImages={[]}
     newPreviews={imageUpload.previews}
     onImageClick={() => setIsViewing(true)}
     onRemoveImage={(index) => removeImage(index)}
     showRemoveButton={false}
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
  className="createPostProvinceListTight"
/>
<style jsx>{`
  :global(.createPostProvinceListTight) {
    display: block;
  }
  :global(.createPostProvinceListTight > div) {
    padding: 10px 24px !important;
    border-bottom: none !important;
  }

  @media (max-width: 520px) {
    :global(.createPostProvinceListTight > div) {
      padding: 8px 20px !important;
    }
    :global(.createPostProvinceListTight > div span) {
      font-size: 14px !important;
      line-height: 1.2 !important;
    }
    :global(.createPostProvinceListTight > div > div) {
      width: 18px !important;
      height: 18px !important;
    }
    :global(.createPostProvinceListTight > div > div svg) {
      width: 10px !important;
      height: 10px !important;
    }
  }
`}</style>
 </div>
 )}
 </div>

 {isViewing && (
 <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 2000, display: 'flex', justifyContent: 'center' }}>
 <div style={{ width: '100%', maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER_WIDTH, height: '100%', background: '#fff', position: 'relative', overflowY: 'auto' }}>
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 0, background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 10 }}>
 <div style={{ width: '72px', flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>
 <div style={{ padding: '5px', width: 24, height: 24 }} aria-hidden />
 </div>
 <h3 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '18px', fontWeight: 'bold', minWidth: 0 }}>ແກ້ໄຂ</h3>
 <div style={{ width: '72px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
 <button onClick={() => setIsViewing(false)} style={{ background: '#1877f2', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px' }}>ສຳເລັດ</button>
 </div>
 </div>
 {imageUpload.previews.map((img, idx) => (
 <div key={idx} style={{ width: '100%', marginBottom: '12px', position: 'relative' }}>
 <img src={img} style={{ width: '100%', height: 'auto', display: 'block' }} />
 <button onClick={() => removeImage(idx)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
 </div>
 ))}

 {/* ปุ่มเพิ่มรูป (อยู่กึ่งกลาง ล่างสุดใน Viewing Mode) */}
 <div style={{ padding: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
 <label style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#1877f2', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px' }}>
 <span style={{ fontSize: '18px', color: '#fff', lineHeight: '1' }}>+</span> ເພີ່ມຮູບ
 <input type="file" multiple accept="image/*" onChange={handleFileChange} ref={imageUpload.fileInputRef} style={{ display: 'none' }} />
 </label>
 </div>
 <div style={{ height: '10px' }}></div>
 </div>
 </div>
 )}

 {/* Modal ยืนยันการออก — ທ່ານຕ້ອງການຍົກເລີກບໍ? */}
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
       <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' }}>
         ທ່ານຕ້ອງການຍົກເລີກບໍ?
       </h3>
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
           ຍົກເລີກ
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
           ສ້າງໂພສຕໍ່
         </button>
       </div>
     </div>
   </div>
 )}

 {/* ป๊อบอัพแจ้งเตือน: อัปโหลดวิดีโอ/ไฟล์อื่น → โพสต์ได้เฉพาะรูปภาพ */}
 {showVideoAlert && (
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
     onClick={() => setShowVideoAlert(false)}
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
       <p style={{ fontSize: '16px', marginBottom: '20px', textAlign: 'center' }}>
         ໂພສໄດ້ສະເພາະຮູບພາບເທົ່ານັ້ນ
       </p>
       <div style={{ display: 'flex', justifyContent: 'center' }}>
         <button
           type="button"
           onClick={() => setShowVideoAlert(false)}
           style={{
             padding: '10px 24px',
             background: '#1877f2',
             border: 'none',
             borderRadius: '8px',
             fontSize: '15px',
             fontWeight: 'bold',
             color: '#fff',
             cursor: 'pointer',
           }}
         >
           ຕົກລົງ
         </button>
       </div>
     </div>
   </div>
 )}
 </div>
 );
}
