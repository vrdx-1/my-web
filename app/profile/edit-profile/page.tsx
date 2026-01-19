'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function EditProfile() {
 const router = useRouter();
 
 // Profile States
 const [username, setUsername] = useState('');
 const [phone, setPhone] = useState('');
 const [avatarUrl, setAvatarUrl] = useState('');
 const [userId, setUserId] = useState<string | null>(null);
 const [isEditingName, setIsEditingName] = useState(false);
 const [isEditingPhone, setIsEditingPhone] = useState(false);
 const [uploading, setUploading] = useState(false);

 // Feed States
 const [tab, setTab] = useState('recommend');
 const [posts, setPosts] = useState<any[]>([]);
 const [session, setSession] = useState<any>(null);
 const [likedPosts, setLikedPosts] = useState<{[key: string]: boolean}>({});
 const [savedPosts, setSavedPosts] = useState<{[key: string]: boolean}>({});
 const [viewingPost, setViewingPost] = useState<any | null>(null);
 const [activeMenu, setActiveMenu] = useState<string | null>(null);
 
 const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
 const [currentImgIndex, setCurrentImgIndex] = useState(0);
 const [touchStart, setTouchStart] = useState<number | null>(null);
 const [activePhotoMenu, setActivePhotoMenu] = useState<number | null>(null);

 // --- ส่วนที่เพิ่มใหม่สำหรับ Pagination & Infinite Scroll ---
 const [page, setPage] = useState(0);
 const [hasMore, setHasMore] = useState(true);
 const [loadingMore, setLoadingMore] = useState(false);
 const PAGE_SIZE = 12;
 const observer = useRef<IntersectionObserver | null>(null);

 const lastPostElementRef = useCallback((node: any) => {
 if (loadingMore) return;
 if (observer.current) observer.current.disconnect();
 observer.current = new IntersectionObserver(entries => {
 if (entries[0].isIntersecting && hasMore) {
 setPage(prevPage => prevPage + 1);
 }
 });
 if (node) observer.current.observe(node);
 }, [loadingMore, hasMore]);
 // ----------------------------------------------------

 useEffect(() => {
 const checkUser = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (session) {
 setSession(session);
 setUserId(session.user.id);
 fetchProfile(session.user.id);
 fetchSavedStatus(session.user.id);
 fetchLikedStatus(session.user.id);
 } else {
 router.push('/register');
 }
 };
 checkUser();
 }, []);

 // รีเซ็ตค่าเมื่อเปลี่ยน Tab
 useEffect(() => {
 if (userId) {
 setPage(0);
 setHasMore(true);
 fetchMyPosts(0, true);
 }
 }, [tab, userId]);

 // โหลดเพิ่มเมื่อ page เปลี่ยน
 useEffect(() => {
 if (page > 0 && userId) {
 fetchMyPosts(page, false);
 }
 }, [page]);

 const fetchProfile = async (uid: string) => {
 const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
 if (data) {
 setUsername(data.username || '');
 setAvatarUrl(data.avatar_url || '');
 setPhone(data.phone || '');
 }
 };

 const fetchMyPosts = async (pageNum: number, isInitial: boolean) => {
 setLoadingMore(true);
 const from = pageNum * PAGE_SIZE;
 const to = from + PAGE_SIZE - 1;

 // แก้ไขจุดนี้: ดึงข้อมูลโดยไม่กรอง is_hidden เพื่อให้เจ้าของโพสต์เห็นโพสต์ที่ถูกซ่อนของตนเอง
 const { data, error } = await supabase
 .from('cars')
 .select(`*, profiles!cars_user_id_fkey (username, avatar_url, phone, last_seen)`)
 .eq('user_id', userId)
 .eq('status', tab)
 .order('created_at', { ascending: false })
 .range(from, to);

 if (!error && data) {
 if (isInitial) {
 setPosts(data);
 } else {
 setPosts(prev => [...prev, ...data]);
 }
 setHasMore(data.length === PAGE_SIZE);
 }
 setLoadingMore(false);
 };

 const fetchSavedStatus = async (uid: string) => {
 const { data } = await supabase.from('post_saves').select('post_id').eq('user_id', uid);
 if (data) {
 const savedMap: any = {};
 data.forEach(item => savedMap[item.post_id] = true);
 setSavedPosts(savedMap);
 }
 };

 const fetchLikedStatus = async (uid: string) => {
 const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', uid);
 if (data) {
 const likedMap: any = {};
 data.forEach(item => likedMap[item.post_id] = true);
 setLikedPosts(likedMap);
 }
 };

 const getOnlineStatus = (lastSeen: string | null) => {
 if (!lastSeen) return { isOnline: false, text: '' };
 const now = new Date().getTime();
 const lastActive = new Date(lastSeen).getTime();
 const diffInSeconds = Math.floor((now - lastActive) / 1000);
 if (diffInSeconds < 300) return { isOnline: true, text: 'ອອນລາຍ' };
 if (diffInSeconds < 60) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ເມື່ອຄູ່` };
 const diffInMinutes = Math.floor(diffInSeconds / 60);
 if (diffInMinutes < 60) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInMinutes} ນາທີທີ່ແລ້ວ` };
 const diffInHours = Math.floor(diffInMinutes / 60);
 if (diffInHours < 24) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInHours} ຊົ່ວໂມງທີ່ແລ້ວ` };
 const diffInDays = Math.floor(diffInHours / 24);
 if (diffInDays < 7) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInDays} ມື້ທີ່ແລ້ວ` };
 return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ເມື່ອດົນແລ້ວ` };
 };

 const togglePostStatus = async (postId: string, currentStatus: string) => {
 const newStatus = currentStatus === 'recommend' ? 'sold' : 'recommend';
 const { error } = await supabase.from('cars').update({ status: newStatus }).eq('id', postId);
 if (!error) {
 setPosts(prev => prev.filter(p => p.id !== postId));
 alert("ອັບເດດສະຖານະສຳເລັດ!");
 }
 };

 const uploadAvatar = async (event: any) => {
 try {
 setUploading(true);
 const file = event.target.files[0];
 if (!file) return;
 const filePath = `avatars/${userId}-${Date.now()}`;
 await supabase.storage.from('car-images').upload(filePath, file);
 const { data: { publicUrl } } = supabase.storage.from('car-images').getPublicUrl(filePath);
 
 await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
 setAvatarUrl(publicUrl);
 } finally { setUploading(false); }
 };

 const saveUsername = async () => {
 const { error } = await supabase.from('profiles').update({ username }).eq('id', userId);
 if (!error) {
 setIsEditingName(false);
 alert("ບັນທຶກຊື່ສຳເລັດ!");
 }
 };

 const savePhone = async () => {
 const { error } = await supabase.from('profiles').update({ phone }).eq('id', userId);
 if (!error) {
 setIsEditingPhone(false);
 alert("ບັນທຶກເບີໂທສຳເລັດ!");
 }
 };

 const formatTime = (dateString: string) => {
 const diffInSeconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
 if (diffInSeconds < 60) return 'ເມື່ອຄູ່';
 const diffInMinutes = Math.floor(diffInSeconds / 60);
 if (diffInMinutes < 60) return `${diffInMinutes} ນາທີ`;
 const diffInHours = Math.floor(diffInMinutes / 60);
 if (diffInHours < 24) return `${diffInHours} ຊົ່ວໂມງ`;
 const diffInDays = Math.floor(diffInHours / 24);
 return `${diffInDays} ມື້`;
 };

 const toggleLike = async (postId: string) => {
 if (!session) return;
 const isCurrentlyLiked = likedPosts[postId];
 const currentPost = posts.find(p => p.id === postId);
 const newLikesCount = isCurrentlyLiked ? Math.max(0, (currentPost?.likes || 1) - 1) : (currentPost?.likes || 0) + 1;
 
 // Optimistic UI update
 setLikedPosts(prev => ({ ...prev, [postId]: !isCurrentlyLiked }));
 setPosts(prev => prev.map(p => {
 if (p.id === postId) {
 return { ...p, likes: newLikesCount };
 }
 return p;
 }));

 if (isCurrentlyLiked) {
 const { error } = await supabase.from('post_likes').delete().eq('user_id', userId).eq('post_id', postId);
 if (!error) {
 await supabase.from('cars').update({ likes: newLikesCount }).eq('id', postId);
 }
 } else {
 const { error } = await supabase.from('post_likes').insert([{ user_id: userId, post_id: postId }]);
 if (!error) {
 await supabase.from('cars').update({ likes: newLikesCount }).eq('id', postId);
 }
 }
 };

 const toggleSave = async (postId: string) => {
 if (!session) return;
 const isCurrentlySaved = savedPosts[postId];
 const currentPost = posts.find(p => p.id === postId);
 const newSavesCount = isCurrentlySaved ? Math.max(0, (currentPost?.saves || 1) - 1) : (currentPost?.saves || 0) + 1;
 
 // Optimistic UI update
 setSavedPosts(prev => ({ ...prev, [postId]: !isCurrentlySaved }));
 setPosts(prev => prev.map(p => {
 if (p.id === postId) {
 return { ...p, saves: newSavesCount };
 }
 return p;
 }));

 if (isCurrentlySaved) {
 const { error } = await supabase.from('post_saves').delete().eq('user_id', userId).eq('post_id', postId);
 if (!error) {
 await supabase.from('cars').update({ saves: newSavesCount }).eq('id', postId);
 }
 } else {
 const { error } = await supabase.from('post_saves').insert([{ user_id: userId, post_id: postId }]);
 if (!error) {
 await supabase.from('cars').update({ saves: newSavesCount }).eq('id', postId);
 }
 }
 };

 const handleViewPost = async (post: any) => {
 setViewingPost(post);
 // Increment views in database
 const { error } = await supabase.rpc('increment_views', { post_id: post.id });
 if (error) {
 // Fallback if RPC fails
 await supabase.from('cars').update({ views: (post.views || 0) + 1 }).eq('id', post.id);
 }
 // Update local state to reflect view change
 setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: (p.views || 0) + 1 } : p));
 };

 const handleShare = async (post: any) => {
 try {
 if (navigator.share) {
 await navigator.share({ title: 'Car Post', text: post.caption, url: window.location.href });
 
 // บันทึกข้อมูลการแชร์ลงฐานข้อมูล (ถ้ามีตาราง post_shares)
 if (userId) {
 await supabase.from('post_shares').insert([{ user_id: userId, post_id: post.id }]);
 }

 // อัปเดตตัวเลขในตาราง cars
 const newSharesCount = (post.shares || 0) + 1;
 await supabase.from('cars').update({ shares: newSharesCount }).eq('id', post.id);
 setPosts(prev => prev.map(p => p.id === post.id ? { ...p, shares: newSharesCount } : p));
 } else {
 navigator.clipboard.writeText(window.location.href);
 alert("ຄັດລອກລິ້ງແລ້ວ!");
 }
 } catch (err) { console.log('Cancelled'); }
 };

 const handleDeletePost = async (postId: string) => {
 if (!confirm("ທ່ານແນ່ໃຈຫຼືບໍ່ວ່າຕ້ອງການລຶບໂພສນີ້?")) return;
 const { error } = await supabase.from('cars').delete().eq('id', postId);
 if (!error) {
 setPosts(prev => prev.filter(p => p.id !== postId));
 alert("ລຶບໂພສສຳເລັດແລ້ວ");
 } else {
 alert("ເກີດຂໍ້ຜິດພາດ: " + error.message);
 }
 setActiveMenu(null);
 };

 const downloadImage = async (url: string) => {
 try {
 const res = await fetch(url);
 const blob = await res.blob();
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `car-image-${Date.now()}.jpg`;
 link.click();
 setActivePhotoMenu(null);
 } catch (err) { alert("ບໍ່ສາມາດບັນທຶກຮູບໄດ້"); }
 };

 const PhotoGrid = ({ images, onPostClick }: { images: string[], onPostClick: () => void }) => {
 const count = images.length;
 if (count === 0) return null;
 if (count === 1) return <img src={images[0]} onClick={onPostClick} style={{ width: '100%', cursor: 'pointer', display: 'block' }} />;
 return (
 <div onClick={onPostClick} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', cursor: 'pointer' }}>
 {images.slice(0, 4).map((img, i) => (
 <div key={i} style={{ position: 'relative', height: '200px' }}>
 <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
 {i === 3 && count > 4 && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>+{count - 4}</div>}
 </div>
 ))}
 </div>
 );
 };

 const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
 const onTouchEnd = (e: React.TouchEvent) => {
 if (touchStart === null) return;
 const diff = touchStart - e.changedTouches[0].clientX;
 if (diff > 40 && currentImgIndex < (fullScreenImages?.length || 0) - 1) setCurrentImgIndex(prev => prev + 1);
 else if (diff < -40 && currentImgIndex > 0) setCurrentImgIndex(prev => prev - 1);
 setTouchStart(null);
 };

 return (
 <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: 'sans-serif', position: 'relative' }}>
 <style>{`
 @keyframes heartBeat { 0% { transform: scale(1); } 25% { transform: scale(1.3); } 50% { transform: scale(1); } 100% { transform: scale(1); } }
 @keyframes popOnce { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }
 .animate-heart { animation: heartBeat 0.4s linear; }
 .animate-pop { animation: popOnce 0.3s ease-out; }
 `}</style>

 {/* Header */}
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '15px', position: 'sticky', top: 0, background: '#fff', zIndex: 100, borderBottom: '1px solid #f0f0f0' }}>
 <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0' }}>
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1c1e21" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
 </button>
 <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>ແກ້ໄຂໂປຣໄຟລ໌</h1>
 </div>

 {/* Profile Section */}
 <div style={{ padding: '20px' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
 <div style={{ position: 'relative', width: '90px', height: '90px' }}>
 <div style={{ width: '90px', height: '90px', borderRadius: '50%', overflow: 'hidden', background: '#f0f2f5', border: '1px solid #ddd' }}>
 {avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px' }}>👤</div>}
 </div>
 <label htmlFor="avatar-up" style={{ position: 'absolute', bottom: 0, right: 0, background: '#fff', borderRadius: '50%', padding: '7px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', cursor: 'pointer', display: 'flex' }}>
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
 <input id="avatar-up" type="file" hidden onChange={uploadAvatar} accept="image/*" />
 </label>
 </div>
 <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
 {isEditingName ? (
 <>
 <input value={username} onChange={e => setUsername(e.target.value)} autoFocus style={{ fontSize: '18px', fontWeight: 'bold', border: 'none', borderBottom: '2px solid #1877f2', outline: 'none', width: '60%', padding: '4px 0' }} />
 <button onClick={saveUsername} style={{ padding: '4px 12px', background: '#1877f2', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>ບັນທຶກ</button>
 </>
 ) : (
 <>
 <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#1c1e21' }}>{username || 'ຊື່ຜູ້ໃຊ້'}</h2>
 <button onClick={() => setIsEditingName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}>
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1877f2" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
 </button>
 </>
 )}
 </div>
 </div>
 
 <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
 <input 
 type="text" 
 value={phone} 
 onChange={e => setPhone(e.target.value)} 
 onFocus={() => setIsEditingPhone(true)}
 placeholder="ເບີ WhatsApp (20XXXXXXXX)" 
 style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', fontSize: '15px' }} 
 />
 {isEditingPhone && (
 <button onClick={savePhone} style={{ padding: '0 15px', background: '#1877f2', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>ບັນທຶກ</button>
 )}
 </div>
 </div>

 <div style={{ height: '8px', background: '#f0f2f5' }}></div>

 {/* Tabs Section */}
 <div style={{ display: 'flex', borderBottom: '1px solid #ddd', position: 'sticky', top: '45px', background: '#fff', zIndex: 90 }}>
 {['recommend', 'sold'].map((t) => (
 <div key={t} onClick={() => setTab(t)} style={{ flex: 1, textAlign: 'center', padding: '15px', color: tab === t ? '#1877f2' : '#65676b', fontWeight: 'bold', borderBottom: tab === t ? '3px solid #1877f2' : 'none', cursor: 'pointer', fontSize: '15px' }}>
 {t === 'recommend' ? 'ພ້ອມຂາຍ' : 'ຂາຍແແລ້ວ'}
 </div>
 ))}
 </div>

 {/* Posts Feed */}
 {posts.length > 0 ? posts.map((post, index) => {
 const status = getOnlineStatus(post.profiles?.last_seen);
 const isLastElement = posts.length === index + 1;
 return (
 <div key={post.id} ref={isLastElement ? lastPostElementRef : null} style={{ borderBottom: '8px solid #f0f2f5', position: 'relative' }}>
 <div style={{ padding: '12px 15px 8px 15px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}>
 <img src={post.profiles?.avatar_url || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
 </div>
 <div style={{ flex: 1 }}>
 <div style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
 {post.profiles?.username || 'User'}
 {status.isOnline ? (
 <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
 <div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div>
 <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
 </div>
 ) : (
 status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
 )}
 </div>
 <div style={{ fontSize: '12px', color: '#65676b' }}>{formatTime(post.created_at)} · {post.province}</div>
 </div>

 <div style={{ position: 'relative', marginTop: '-4px' }}>
 <button onClick={() => setActiveMenu(activeMenu === post.id ? null : post.id)} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 <svg width="18" height="18" viewBox="0 0 24 24" fill="#65676b"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg>
 </button>
 {activeMenu === post.id && (
 <div style={{ position: 'absolute', right: 0, top: '40px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '8px', zIndex: 150, width: '130px', border: '1px solid #eee', overflow: 'hidden' }}>
 <div onClick={() => router.push(`/edit-post/${post.id}`)} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', borderBottom: '1px solid #eee' }}>ແກ້ໄຂ</div>
 <div onClick={() => handleDeletePost(post.id)} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', borderBottom: '1px solid #eee' }}>ລົບ</div>
 <div onClick={() => { alert("Boost post ກຳລັງພັດທະນາໃນອະນາຄົດ"); setActiveMenu(null); }} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff' }}>Boost post</div>
 </div>
 )}
 </div>
 </div>

 <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{post.caption}</div>
 <PhotoGrid images={post.images || []} onPostClick={() => handleViewPost(post)} />
 
 <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f2f5' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
 <div onClick={() => toggleLike(post.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
 <svg width="22" height="22" viewBox="0 0 24 24" className={likedPosts[post.id] ? "animate-heart" : ""} fill={likedPosts[post.id] ? "#e0245e" : "none"} stroke={likedPosts[post.id] ? "#e0245e" : "#65676b"} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
 <span style={{ fontSize: '14px', fontWeight: '600', color: likedPosts[post.id] ? '#e0245e' : '#65676b' }}>{post.likes || 0}</span>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#65676b' }}>
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
 <span style={{ fontSize: '14px', fontWeight: '500' }}>{post.views || 0}</span>
 </div>
 <div onClick={() => toggleSave(post.id)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
 <svg width="22" height="22" viewBox="0 0 24 24" className={savedPosts[post.id] ? "animate-pop" : ""} fill={savedPosts[post.id] ? "#FFD700" : "none"} stroke={savedPosts[post.id] ? "#FFD700" : "#65676b"} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
 <span style={{ fontSize: '14px', fontWeight: '600', color: savedPosts[post.id] ? '#FFD700' : '#65676b', marginLeft: '4px' }}>{post.saves || 0}</span>
 </div>
 <div onClick={() => handleShare(post)} style={{ cursor: 'pointer' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2.8"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg></div>
 </div>

 <button 
 onClick={() => togglePostStatus(post.id, post.status)}
 style={{ background: '#f0f2f5', padding: '6px 12px', borderRadius: '6px', border: 'none', color: '#1877f2', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
 >
 {tab === 'recommend' ? 'ຍ້າຍໄປຂາຍແລ້ວ' : 'ຍ້າຍໄປພ້ອມຂາຍ'}
 </button>
 </div>
 </div>
 );
 }) : (
 !loadingMore && <div style={{ textAlign: 'center', padding: '100px 20px', color: '#65676b', fontSize: '16px' }}>ຍັງບໍ່ມີລາຍການ</div>
 )}

 {loadingMore && (
 <div style={{ padding: '20px', textAlign: 'center', color: '#65676b', fontSize: '14px' }}>ກຳລັງໂຫຼດ...</div>
 )}

 {/* Viewing Post Mode */}
 {viewingPost && (() => {
 const status = getOnlineStatus(viewingPost.profiles?.last_seen);
 return (
 <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 2000, display: 'flex', justifyContent: 'center' }}>
 <div style={{ width: '100%', maxWidth: '600px', height: '100%', background: '#fff', position: 'relative', overflowY: 'auto' }}>
 <button onClick={() => setViewingPost(null)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', zIndex: 10, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
 <div style={{ padding: '20px 15px 15px 15px' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}>
 <img src={viewingPost.profiles?.avatar_url || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
 </div>
 <div>
 <div style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
 {viewingPost.profiles?.username || 'User'}
 {status.isOnline ? (
 <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
 <div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div>
 <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
 </div>
 ) : (
 status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
 )}
 </div>
 <div style={{ fontSize: '12px', color: '#65676b' }}>{formatTime(viewingPost.created_at)} · {viewingPost.province}</div>
 </div>
 </div>
 <div style={{ fontSize: '16px', lineHeight: '1.5', whiteSpace: 'pre-wrap', marginBottom: '20px', color: '#000' }}>{viewingPost.caption}</div>
 {viewingPost.images.map((img: string, idx: number) => (
 <div key={idx} style={{ marginBottom: '15px', width: '100%' }}>
 <img src={img} onClick={() => { setFullScreenImages(viewingPost.images); setCurrentImgIndex(idx); }} style={{ width: '100%', borderRadius: '4px', display: 'block', cursor: 'pointer' }} />
 </div>
 ))}
 </div>
 </div>
 </div>
 );
 })()}

 {/* Full Screen Images Mode */}
 {fullScreenImages && (
 <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000, display: 'flex', flexDirection: 'column', touchAction: 'none' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
 <div style={{ padding: '15px', display: 'flex', justifyContent: 'flex-end', gap: '15px', alignItems: 'center' }}>
 <div style={{ position: 'relative' }}>
 <button onClick={(e) => { e.stopPropagation(); setActivePhotoMenu(activePhotoMenu === currentImgIndex ? null : currentImgIndex); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
 <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg>
 </button>
 {activePhotoMenu === currentImgIndex && (
 <div style={{ position: 'absolute', right: 0, top: '45px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', borderRadius: '8px', width: '130px', zIndex: 3100, overflow: 'hidden' }}>
 <div onClick={() => downloadImage(fullScreenImages[currentImgIndex])} style={{ padding: '15px', fontSize: '14px', cursor: 'pointer', color: '#1c1e21', fontWeight: 'bold', textAlign: 'center' }}>ບັນທຶກຮູບ</div>
 </div>
 )}
 </div>
 <button onClick={() => { setFullScreenImages(null); setActivePhotoMenu(null); }} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
 </div>
 <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
 <div style={{ display: 'flex', transition: 'transform 0.3s ease-out', transform: `translateX(-${currentImgIndex * 100}%)`, width: '100%' }}>
 {fullScreenImages.map((img, idx) => (
 <div key={idx} style={{ minWidth: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
 <img src={img} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
 </div>
 ))}
 </div>
 </div>
 <div style={{ padding: '20px', textAlign: 'center', color: '#fff', fontSize: '16px', background: 'rgba(0,0,0,0.3)', fontWeight: 'bold' }}>{currentImgIndex + 1} / {fullScreenImages.length}</div>
 </div>
 )}
 </main>
 );
}
