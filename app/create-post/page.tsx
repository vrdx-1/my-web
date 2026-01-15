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
 const [step, setStep] = useState(1);
 const [caption, setCaption] = useState('');
 const [province, setProvince] = useState('');
 const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
 const [previews, setPreviews] = useState<string[]>([]);
 const [loading, setLoading] = useState(false);
 const [session, setSession] = useState<any>(null);
 const [isViewing, setIsViewing] = useState(false); // State สำหรับ Viewing Mode
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

 const timer = setTimeout(() => {
 if (fileInputRef.current && step === 1 && previews.length === 0) {
 fileInputRef.current.click();
 }
 }, 100);
 
 return () => clearTimeout(timer);
 }, [step]);

 // ฟังก์ชันบีบอัดรูปภาพเป็น WebP
 const compressImage = async (file: File): Promise<File> => {
 return new Promise((resolve) => {
 const reader = new FileReader();
 reader.readAsDataURL(file);
 reader.onload = (event) => {
 const img = new Image();
 img.src = event.target?.result as string;
 img.onload = () => {
 const canvas = document.createElement('canvas');
 const MAX_WIDTH = 1080; // จำกัดความกว้างสูงสุด
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
 0.8 // คุณภาพ 80% (ชัดแต่ไฟล์เล็กมาก)
 );
 };
 };
 });
 };

 const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files && e.target.files.length > 0) {
 const remainingSlots = 15 - selectedFiles.length;
 if (remainingSlots <= 0) return;

 let incomingFiles = Array.from(e.target.files);
 if (incomingFiles.length > remainingSlots) {
 incomingFiles = incomingFiles.slice(0, remainingSlots);
 }

 setLoading(true); // เริ่มบีบอัด
 const compressedFiles = await Promise.all(
 incomingFiles.map(file => compressImage(file))
 );
 
 setSelectedFiles(prev => [...prev, ...compressedFiles]);
 
 const newPreviews = compressedFiles.map(file => URL.createObjectURL(file));
 setPreviews(prev => [...prev, ...newPreviews]);
 setLoading(false);

 if (fileInputRef.current) fileInputRef.current.value = "";
 }
 };

 const removeImage = (index: number) => {
 const updatedFiles = [...selectedFiles];
 updatedFiles.splice(index, 1);
 setSelectedFiles(updatedFiles);

 const updatedPreviews = [...previews];
 URL.revokeObjectURL(updatedPreviews[index]);
 updatedPreviews.splice(index, 1);
 setPreviews(updatedPreviews);
 
 // หากลบรูปจนหมดให้ปิดหน้า Viewing mode
 if (updatedPreviews.length === 0) {
 setIsViewing(false);
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
 if (loading) return;
 setLoading(true);

 try {
 const imageUrls = [];
 const isGuest = !session;
 let guestToken = null;
 
 if (isGuest) {
 const myPosts = JSON.parse(localStorage.getItem('my_guest_posts') || '[]');
 guestToken = myPosts.length > 0 ? myPosts[0].token : generateGuestToken();
 }
 
 const uploadFolder = session ? session.user.id : 'guest-uploads';

 for (const file of selectedFiles) {
 const fileExt = file.name.split('.').pop();
 const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
 const filePath = `${uploadFolder}/${fileName}`;

 const { error: uploadError } = await supabase.storage.from('car-images').upload(filePath, file);
 if (uploadError) throw uploadError;

 const { data: { publicUrl } } = supabase.storage.from('car-images').getPublicUrl(filePath);
 imageUrls.push(publicUrl);
 }

 // --- จุดที่แก้ไข: กู้คืน Active User โดยการ Sync Profile และใช้ guestToken เป็น user_id ---
 if (isGuest && guestToken) {
  await supabase
    .from('profiles')
    .upsert(
      { 
        id: guestToken, 
        username: 'Guest User', 
        last_seen: new Date().toISOString() 
      },
      { onConflict: 'id' }
    );
 } else if (session) {
   await supabase
     .from('profiles')
     .update({ last_seen: new Date().toISOString() })
     .eq('id', session.user.id);
 }

 const { data, error: insertError } = await supabase.from('cars').insert([
 {
 user_id: session ? session.user.id : guestToken, // แก้ไข: ใช้ guestToken แทน null เพื่อให้ระบบนับเป็น Active User
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
    myPosts.push({
      post_id: data[0].id,
      token: guestToken
    });
    localStorage.setItem('my_guest_posts', JSON.stringify(myPosts));
 }
 // ---------------------------------------------------

 router.push('/');
 router.refresh();
 } catch (err: any) {
 console.error(err.message);
 } finally {
 setLoading(false);
 }
 };

 return (
 <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
 
 {/* Header */}
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
 <button 
 onClick={() => step > 1 ? setStep(step - 1) : router.push('/')} 
 style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: '5px' }}
 >
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="15 18 9 12 15 6"></polyline>
 </svg>
 </button>
 <h3 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
 {step === 1 && 'ເລືອກຮູບພາບ'}
 {step === 2 && 'ສ້າງໂພສ'}
 {step === 3 && 'ລົດຢູ່ແຂວງ'}
 </h3>
 <div style={{ width: '40px' }}></div>
 </div>

 <div style={{ flex: 1, paddingBottom: '100px' }}>
 {step === 1 && (
 <div style={{ padding: '20px' }}>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
 {selectedFiles.length < 15 && (
 <label style={{ aspectRatio: '1/1', border: '2px dashed #ddd', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#f9f9f9' }}>
 <span style={{ fontSize: '24px' }}>➕</span>
 <input type="file" ref={fileInputRef} multiple accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
 </label>
 )}
 {previews.map((src, index) => (
 <div key={index} style={{ position: 'relative', aspectRatio: '1/1' }}>
 <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
 <button onClick={() => removeImage(index)} style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer' }}>✕</button>
 </div>
 ))}
 </div>
 </div>
 )}

 {step === 2 && (
 <div>
 <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
 {userProfile.avatar_url ? (
 <img src={userProfile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
 ) : (
 <svg width="26" height="26" viewBox="0 0 24 24" fill="#65676b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
 )}
 </div>
 <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{userProfile.username}</div>
 </div>

 <div style={{ padding: '0 15px 15px 15px' }}>
 <textarea 
 autoFocus
 style={{ width: '100%', minHeight: '100px', border: 'none', outline: 'none', fontSize: '16px', lineHeight: '1.5', resize: 'none', color: '#000' }}
 placeholder="ໃສ່ລາຍລະອຽດລົດ..."
 value={caption}
 onPaste={(e) => {
 e.preventDefault();
 const text = e.clipboardData.getData('text');
 const allLines = text.split('\n');
 const limitedText = allLines.slice(0, 15).join('\n');
 setCaption(limitedText);
 }}
 onChange={(e) => {
 const lines = e.target.value.split('\n');
 if (lines.length <= 15) {
 setCaption(e.target.value);
 }
 }}
 />
 {caption.split('\n').length >= 15 && (
 <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '5px' }}>
 ສູງສຸດ 15 ແຖວ
 </div>
 )}
 </div>
 <PhotoPreviewGrid images={previews} />
 </div>
 )}

 {step === 3 && (
 <div style={{ padding: '10px 20px', display: 'grid', gap: '8px' }}>
 {LAO_PROVINCES.map((p) => (
 <div 
 key={p} 
 onClick={() => setProvince(p)} 
 style={{ 
 padding: '16px', 
 borderRadius: '12px', 
 border: '1px solid', 
 borderColor: province === p ? '#1877f2' : '#eee', 
 background: province === p ? '#e7f3ff' : '#fff', 
 cursor: 'pointer',
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center'
 }}
 >
 <span style={{ fontSize: '16px', fontWeight: province === p ? 'bold' : 'normal' }}>{p}</span>
 {province === p && <span style={{ color: '#22c55e', fontSize: '20px', fontWeight: 'bold' }}>✓</span>}
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Viewing Mode Layer */}
 {isViewing && (
 <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 2000, display: 'flex', justifyContent: 'center' }}>
 <div style={{ width: '100%', maxWidth: '600px', height: '100%', background: '#fff', position: 'relative', overflowY: 'auto' }}>
 
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 10 }}>
 <div style={{ fontWeight: 'bold', fontSize: '18px' }}>ແກ້ໄຂ</div>
 <button 
 onClick={() => setIsViewing(false)} 
 style={{ position: 'absolute', right: '15px', background: 'none', border: 'none', color: '#1877f2', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
 >
 ສຳເລັດ
 </button>
 </div>

 <div style={{ paddingTop: '10px' }}>
 {previews.map((img, idx) => (
 <div key={idx} style={{ width: '100%', marginBottom: '24px', position: 'relative' }}>
 <img src={img} style={{ width: '100%', height: 'auto', display: 'block' }} />
 <button 
 onClick={() => removeImage(idx)} 
 style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
 >
 ✕
 </button>
 </div>
 ))}
 </div>
 <div style={{ height: '50px' }}></div>
 </div>
 </div>
 )}

 {/* Footer Navigation */}
 <div style={{ position: 'fixed', bottom: 0, maxWidth: '600px', width: '100%', padding: '20px', background: 'linear-gradient(transparent, #fff 30%)', display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none', zIndex: 5 }}>
 {step === 1 && previews.length > 0 && (
 <button onClick={() => setStep(2)} style={{ pointerEvents: 'auto', background: '#1877f2', color: '#fff', border: 'none', padding: '12px 35px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer' }}>ຕໍ່ໄປ</button>
 )}
 {step === 2 && caption.trim() && caption.split('\n').length <= 15 && (
 <button onClick={() => setStep(3)} style={{ pointerEvents: 'auto', background: '#1877f2', color: '#fff', border: 'none', padding: '12px 35px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer' }}>ຕໍ່ໄປ</button>
 )}
 {step === 3 && province && (
 <button onClick={handleSubmit} disabled={loading} style={{ pointerEvents: 'auto', background: '#1877f2', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '25px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
 {loading ? 'ກຳລັງໂພສ' : 'ໂພສ'}
 </button>
 )}
 </div>
 </div>
 );
}
