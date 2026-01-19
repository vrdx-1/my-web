'use client'
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const LAO_PROVINCES = [
 "ຜົ້ງສາລີ", "ຫຼວງນ້ຳທາ", "ອຸດົມໄຊ", "ບໍ່ແກ້ວ", "ຫຼວງພະບາງ", "ຫົວພັນ", 
 "ໄຊຍະບູລີ", "ຊຽງຂວາງ", "ໄຊສົມບູນ", "ວຽງຈັນ", "ນະຄອນຫຼວງວຽງຈັນ", 
 "ບໍລິຄຳໄຊ", "ຄຳມ່ວນ", "ສະຫວັນນະເຂດ", "ສາລະວັນ", "ເຊກອງ", "ຈຳປາສັກ", "ອັດຕະປື"
];

export default function CreatePost() {
 const router = useRouter();
 const fileInputRef = useRef<HTMLInputElement>(null);
 const textareaRef = useRef<HTMLTextAreaElement>(null);
 const isSelecting = useRef(false);
 const [step, setStep] = useState(2); // เริ่มต้นที่ Step 2 ทันที
 const [caption, setCaption] = useState('');
 const [province, setProvince] = useState('');
 const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
 const [previews, setPreviews] = useState<string[]>([]);
 const [loading, setLoading] = useState(false);
 const [isUploading, setIsUploading] = useState(false); 
 const [uploadProgress, setUploadProgress] = useState(0); 
 const [session, setSession] = useState<any>(null);
 const [isViewing, setIsViewing] = useState(false); 
 const [userProfile, setUserProfile] = useState<{username: string, avatar_url: string | null}>({
 username: 'User',
 avatar_url: null
 });

 useEffect(() => {
 const checkUser = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 setSession(session);
 
 if (session) {
 const { data: profile } = await supabase
 .from('profiles')
 .select('username, avatar_url')
 .eq('id', session.user.id)
 .single();
 
 if (profile) {
 setUserProfile({
 username: profile.username || 'User',
 avatar_url: profile.avatar_url
 });
 }
 }
 };
 checkUser();

 // ดึงข้อมูลจากหน้าโฮม
 const pendingImages = sessionStorage.getItem('pending_images');
 if (pendingImages) {
    try {
        const urls = JSON.parse(pendingImages);
        setPreviews(urls);
        setStep(2); 

        // แก้ไข: แปลง Blob URL กลับเป็น File Object เพื่อให้ handleSubmit อัปโหลดได้
        urls.forEach(async (url: string) => {
            const response = await fetch(url);
            const blob = await response.blob();
            const file = new File([blob], `image-${Date.now()}.webp`, { type: 'image/webp' });
            setSelectedFiles(prev => [...prev, file]);
        });
        
        sessionStorage.removeItem('pending_images');
    } catch (e) {
        console.error("Error parsing pending images", e);
    }
 }

 // ลบ Logic การเปิด file input อัตโนมัติออกเนื่องจากไม่ใช้ Step 1 แล้ว
 }, []); 

 const compressImage = async (file: File): Promise<File> => {
 return new Promise((resolve) => {
 const reader = new FileReader();
 reader.readAsDataURL(file);
 reader.onload = (event) => {
 const img = new Image();
 img.src = event.target?.result as string;
 img.onload = () => {
 const canvas = document.createElement('canvas');
 const MAX_WIDTH = 1080; 
 let width = img.width;
 let height = img.height;

 if (width > MAX_WIDTH) {
 height = (MAX_WIDTH / width) * height;
 width = MAX_WIDTH;
 }

 canvas.width = width;
 canvas.height = height;
 const ctx = canvas.getContext('2d');
 ctx?.drawImage(img, 0, 0, width, height);

 canvas.toBlob(
 (blob) => {
 if (blob) {
 const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
 type: 'image/webp',
 lastModified: Date.now(),
 });
 resolve(compressedFile);
 } else {
 resolve(file);
 }
 },
 'image/webp',
 0.8 
 );
 };
 };
 });
 };

 const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files && e.target.files.length > 0) {
 isSelecting.current = false;
 const remainingSlots = 15 - (selectedFiles.length);
 if (remainingSlots <= 0) return;

 let incomingFiles = Array.from(e.target.files);
 if (incomingFiles.length > remainingSlots) {
 incomingFiles = incomingFiles.slice(0, remainingSlots);
 }

 setLoading(true); 
 const compressedFiles = await Promise.all(
 incomingFiles.map(file => compressImage(file))
 );
 
 setSelectedFiles(prev => [...prev, ...compressedFiles]);
 
 const newPreviews = compressedFiles.map(file => URL.createObjectURL(file));
 setPreviews(prev => [...prev, ...newPreviews]);
 setLoading(false);

 if (fileInputRef.current) fileInputRef.current.value = "";
 setStep(2); 
 }
 };

 const removeImage = (index: number) => {
 const updatedFiles = [...selectedFiles];
 if (updatedFiles.length > 0) {
    updatedFiles.splice(index, 1);
    setSelectedFiles(updatedFiles);
 }

 const updatedPreviews = [...previews];
 URL.revokeObjectURL(updatedPreviews[index]);
 updatedPreviews.splice(index, 1);
 setPreviews(updatedPreviews);
 
 if (updatedPreviews.length === 0) {
 setIsViewing(false);
 // ถ้าลบรูปจนหมด ให้กลับหน้าโฮม
 router.push('/');
 }
 };

 const PhotoPreviewGrid = ({ images }: { images: string[] }) => {
 const count = images.length;
 if (count === 0) return null;
 if (count === 1) return <img src={images[0]} onClick={() => setIsViewing(true)} style={{ width: '100%', display: 'block', borderRadius: '4px', cursor: 'pointer' }} />;
 if (count === 2) return (
 <div onClick={() => setIsViewing(true)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', cursor: 'pointer' }}>
 <img src={images[0]} style={{ width: '100%', height: '300px', objectFit: 'cover' }} />
 <img src={images[1]} style={{ width: '100%', height: '300px', objectFit: 'cover' }} />
 </div>
 );
 if (count === 3) return (
 <div onClick={() => setIsViewing(true)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', cursor: 'pointer' }}>
 <img src={images[0]} style={{ width: '100%', height: '400px', objectFit: 'cover', gridRow: 'span 2' }} />
 <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '2px' }}>
 <img src={images[1]} style={{ width: '100%', height: '199px', objectFit: 'cover' }} />
 <img src={images[2]} style={{ width: '100%', height: '199px', objectFit: 'cover' }} />
 </div>
 </div>
 );
 return (
 <div onClick={() => setIsViewing(true)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', cursor: 'pointer' }}>
 {images.slice(0, 4).map((img, i) => (
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

 const generateGuestToken = () => {
 return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
 };

 const handleSubmit = async () => {
 if (loading || isUploading || selectedFiles.length === 0) return;
 setIsUploading(true);
 setUploadProgress(0);

 try {
 const imageUrls = [];
 const isGuest = !session;
 let guestToken = null;
 
 if (isGuest) {
 const myPosts = JSON.parse(localStorage.getItem('my_guest_posts') || '[]');
 guestToken = myPosts.length > 0 ? myPosts[0].token : generateGuestToken();
 }
 
 const uploadFolder = session ? session.user.id : 'guest-uploads';
 const totalFiles = selectedFiles.length;

 for (let i = 0; i < totalFiles; i++) {
 const file = selectedFiles[i];
 const fileExt = 'webp'; 
 const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
 const filePath = `${uploadFolder}/${fileName}`;

 const { error: uploadError } = await supabase.storage.from('car-images').upload(filePath, file);
 if (uploadError) throw uploadError;

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

 if (insertError) throw insertError;

 if (isGuest && data && data.length > 0) {
 const myPosts = JSON.parse(localStorage.getItem('my_guest_posts') || '[]');
 myPosts.push({ post_id: data[0].id, token: guestToken });
 localStorage.setItem('my_guest_posts', JSON.stringify(myPosts));
 }

 router.push('/');
 router.refresh();
 } catch (err: any) {
 console.error(err.message);
 setIsUploading(false);
 }
 };

 return (
 <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
 
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
 {userProfile.avatar_url ? <img src={userProfile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <svg width="26" height="26" viewBox="0 0 24 24" fill="#65676b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>}
 </div>
 <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{userProfile.username}</div>
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
 <PhotoPreviewGrid images={previews} />
 </div>
 )}

 {step === 3 && (
 <div style={{ padding: '10px 0' }}>
 {LAO_PROVINCES.map((p) => (
 <div 
 key={p} 
 onClick={() => setProvince(p)} 
 style={{ 
 padding: '16px 20px', 
 display: 'flex', 
 justifyContent: 'space-between', 
 alignItems: 'center',
 borderBottom: '1px solid #f0f0f0',
 cursor: 'pointer',
 background: '#fff'
 }}
 >
 <span style={{ fontSize: '16px', fontWeight: province === p ? 'bold' : 'normal', color: '#000' }}>{p}</span>
 <div style={{ 
 width: '22px', 
 height: '22px', 
 border: province === p ? '2px solid #22c55e' : '2px solid #ddd', 
 borderRadius: '4px',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 background: province === p ? '#22c55e' : 'transparent'
 }}>
 {province === p && <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
 </div>
 </div>
 ))}
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
 <div style={{ width: '100%', maxWidth: '600px', height: '100%', background: '#fff', position: 'relative', overflowY: 'auto' }}>
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 10 }}>
 <div style={{ fontWeight: 'bold', fontSize: '18px' }}>ແກ້ໄຂ</div>
 <button onClick={() => setIsViewing(false)} style={{ position: 'absolute', right: '15px', background: 'none', border: 'none', color: '#1877f2', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>ສຳເລັດ</button>
 </div>
 <div style={{ paddingTop: '10px' }}>
 {previews.map((img, idx) => (
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
