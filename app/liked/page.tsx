'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LikedPosts() {
 const router = useRouter();
 const [tab, setTab] = useState('recommend');
 const [posts, setPosts] = useState<any[]>([]);
 const [session, setSession] = useState<any>(null);
 const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
 const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
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

 const fetchLikedPosts = async (userId: string, isInitial = false) => {
 setLoadingMore(true);
 const from = isInitial ? 0 : page * PAGE_SIZE;
 const to = from + PAGE_SIZE - 1;

 const { data, error } = await supabase
 .from('post_likes')
 .select(`
 post_id,
 cars (
 *,
 profiles!cars_user_id_fkey (
 username,
 avatar_url,
 phone,
 last_seen
 )
 )
 `)
 .eq('user_id', userId)
 .order('created_at', { ascending: false })
 .range(from, to);

 if (data) {
 // กรองเอาเฉพาะโพสต์ที่มีข้อมูลรถ, ตรงกับ Tab และจัดการระบบ Shadow Hide
 const formattedPosts = data
 .map((item: any) => item.cars)
 .filter(p => {
 if (!p) return false;
 // เช็คสถานะ Tab
 if (p.status !== tab) return false;

 // Shadow Hide Logic: แสดงถ้าไม่ได้ถูกซ่อน OR (ถูกซ่อนแต่เป็นเจ้าของโพสต์)
 const isNotHidden = !p.is_hidden;
 const isOwner = userId && p.user_id === userId;

 return isNotHidden || isOwner;
 });
 
 if (isInitial) {
 setPosts(formattedPosts);
 } else {
 setPosts(prev => [...prev, ...formattedPosts]);
 }

 // อัปเดตสถานะ Like (ในหน้านี้เป็น true ทั้งหมดอยู่แล้ว)
 const newLikedMap = { ...likedPosts };
 formattedPosts.forEach(p => newLikedMap[p.id] = true);
 setLikedPosts(newLikedMap);

 // เช็คว่ายังมีข้อมูลหน้าถัดไปหรือไม่
 setHasMore(data.length === PAGE_SIZE);

 // ดึงสถานะ Saved ของโพสต์เหล่านี้
 const { data: savedData } = await supabase
 .from('post_saves')
 .select('post_id')
 .eq('user_id', userId);
 
 if (savedData) {
 const savedMap: { [key: string]: boolean } = {};
 savedData.forEach(item => savedMap[item.post_id] = true);
 setSavedPosts(savedMap);
 }
 }
 setLoadingMore(false);
 };

 // เริ่มต้นโหลดข้อมูลเมื่อเข้าหน้าเว็บหรือเปลี่ยน Tab
 useEffect(() => {
 const init = async () => {
 const { data: { session: currentSession } } = await supabase.auth.getSession();
 setSession(currentSession);
 if (currentSession) {
 setPage(0);
 setHasMore(true);
 fetchLikedPosts(currentSession.user.id, true);
 } else {
 router.push('/register');
 }
 };
 init();
 }, [tab]);

 // โหลดเพิ่มเมื่อเลื่อนหน้าจอ
 useEffect(() => {
 if (page > 0 && session) {
 fetchLikedPosts(session.user.id);
 }
 }, [page]);

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

 const formatTime = (dateString: string) => {
 const now = new Date().getTime();
 const postTime = new Date(dateString).getTime();
 const diffInSeconds = Math.floor((now - postTime) / 1000);
 if (diffInSeconds < 60) return 'ເມື່ອຄູ່';
 const diffInMinutes = Math.floor(diffInSeconds / 60);
 if (diffInMinutes < 60) return `${diffInMinutes} ນາທີ`;
 const diffInHours = Math.floor(diffInMinutes / 60);
 if (diffInHours < 24) return `${diffInHours} ຊົ່ວໂມງ`;
 const diffInDays = Math.floor(diffInHours / 24);
 return `${diffInDays} ມື້`;
 };

 const isPostOwner = (post: any) => {
 if (session && post.user_id === session.user.id) return true;
 return false;
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

 const handleReport = async (post: any) => {
 if (!session) {
 alert("ກະລຸນາລົງທະບຽນກ່ອນ");
 return;
 }
 const { error } = await supabase.from('reports').insert([
 { post_id: post.id, reporter_email: session.user.email, post_caption: post.caption, status: 'pending' }
 ]);
 if (error) alert("ເກີດຂໍ້ຜິດພາດ: " + error.message);
 else alert("ລາຍງານສຳເລັດແລ້ວ! Admin ຈະກວດສອບໂດຍໄວ");
 setActiveMenu(null);
 };

 const toggleLike = async (postId: string) => {
 if (!session) return;
 const userId = session.user.id;

 // Optimistic UI: กรองออกทันทีเพราะเป็นหน้า Liked Posts
 setLikedPosts(prev => ({ ...prev, [postId]: false }));
 setPosts(prev => prev.filter(p => p.id !== postId));
 
 // 1. ลบจากตารางหลักฐาน
 const { error: relError } = await supabase.from('post_likes').delete().eq('user_id', userId).eq('post_id', postId);
 // 2. ลดจำนวนในตารางหลัก
 const { error: mainError } = await supabase.rpc('decrement_likes', { row_id: postId });

 if (relError || mainError) {
 console.error("Error toggling like:", relError || mainError);
 }
 };

 const toggleSave = async (postId: string) => {
 if (!session) return;
 const userId = session.user.id;
 const isCurrentlySaved = savedPosts[postId];
 
 // Optimistic UI update
 setSavedPosts(prev => ({ ...prev, [postId]: !isCurrentlySaved }));
 setPosts(prev => prev.map(p => {
 if (p.id === postId) {
 return { ...p, saves: isCurrentlySaved ? (p.saves || 1) - 1 : (p.saves || 0) + 1 };
 }
 return p;
 }));

 if (isCurrentlySaved) {
 // 1. ลบหลักฐาน
 const { error: relError } = await supabase.from('post_saves').delete().eq('user_id', userId).eq('post_id', postId);
 // 2. ลดจำนวนรวม
 const { error: mainError } = await supabase.rpc('decrement_saves', { row_id: postId });
 if (relError || mainError) {
 setSavedPosts(prev => ({ ...prev, [postId]: true }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: (p.saves || 0) + 1 } : p));
 }
 } else {
 // 1. เพิ่มหลักฐาน
 const { error: relError } = await supabase.from('post_saves').insert([{ user_id: userId, post_id: postId }]);
 // 2. เพิ่มจำนวนรวม
 const { error: mainError } = await supabase.rpc('increment_saves', { row_id: postId });
 if (relError || mainError) {
 setSavedPosts(prev => ({ ...prev, [postId]: false }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: (p.saves || 1) - 1 } : p));
 }
 }
 };

 const handleViewPost = async (post: any) => {
 setViewingPost(post);
 const { error } = await supabase.rpc('increment_views', { post_id: post.id });
 if (error) {
 await supabase.from('cars').update({ views: (post.views || 0) + 1 }).eq('id', post.id);
 }
 setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: (p.views || 0) + 1 } : p));
 };

 const togglePostStatus = async (postId: string, currentStatus: string) => {
 const newStatus = currentStatus === 'recommend' ? 'sold' : 'recommend';
 const { error } = await supabase.from('cars').update({ status: newStatus }).eq('id', postId);
 if (!error) {
 setPosts(prev => prev.filter(p => p.id !== postId));
 alert("ອັບເດດສະຖານະສຳເລັດ!");
 }
 };

 const handleShare = async (post: any) => {
 if (!session) return;
 const userId = session.user.id;
 try {
 if (navigator.share) {
 await navigator.share({ title: 'Car Post', text: post.caption, url: window.location.href });
 // 1. บันทึกหลักฐาน
 await supabase.from('post_shares').insert([{ user_id: userId, post_id: post.id }]);
 // 2. เพิ่มจำนวนรวม
 await supabase.rpc('increment_shares', { row_id: post.id });
 
 setPosts(prev => prev.map(p => p.id === post.id ? { ...p, shares: (p.shares || 0) + 1 } : p));
 } else {
 navigator.clipboard.writeText(window.location.href);
 alert("ຄັດລອກລິ້ງສຳເລັດແລ້ວ!");
 }
 } catch (err) { console.log('Cancelled'); }
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

 const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
 const onTouchEnd = (e: React.TouchEvent) => {
 if (touchStart === null) return;
 const diff = touchStart - e.changedTouches[0].clientX;
 if (diff > 40 && currentImgIndex < (fullScreenImages?.length || 0) - 1) setCurrentImgIndex(prev => prev + 1);
 else if (diff < -40 && currentImgIndex > 0) setCurrentImgIndex(prev => prev - 1);
 setTouchStart(null);
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
 {i === 3 && count > 4 && (
 <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>+{count - 4}</div>
 )}
 </div>
 ))}
 </div>
 );
 };

 return (
 <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: 'sans-serif', position: 'relative' }}>
 <style>{`
 @keyframes heartBeat { 0% { transform: scale(1); } 25% { transform: scale(1.3); } 50% { transform: scale(1); } 75% { transform: scale(1.3); } 100% { transform: scale(1); } }
 @keyframes popOnce { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }
 .animate-heart { animation: heartBeat 0.4s linear; }
 .animate-pop { animation: popOnce 0.3s ease-out; }
 `}</style>

 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '15px', position: 'sticky', top: 0, background: '#fff', zIndex: 100, borderBottom: '1px solid #f0f2f5' }}>
 <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: '0' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
 <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>ລາຍການທີ່ຖືກໃຈ</h1>
 </div>

 <div style={{ display: 'flex', borderBottom: '1px solid #ddd' }}>
 {['recommend', 'sold'].map((t) => (
 <div key={t} onClick={() => setTab(t)} style={{ flex: 1, textAlign: 'center', padding: '15px', color: tab === t ? '#1877f2' : '#65676b', fontWeight: 'bold', borderBottom: tab === t ? '3px solid #1877f2' : 'none', cursor: 'pointer' }}>{t === 'recommend' ? 'ພ້ອມຂາຍ' : 'ຂາຍແລ້ວ'}</div>
 ))}
 </div>

 {posts.length > 0 ? (
 posts.map((post, index) => {
 const status = getOnlineStatus(post.profiles?.last_seen);
 const isLastElement = posts.length === index + 1;
 return (
 <div 
 key={post.id} 
 ref={isLastElement ? lastPostElementRef : null} 
 style={{ borderBottom: '8px solid #f0f2f5', position: 'relative' }}
 >
 <div style={{ padding: '12px 15px 8px 15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}><img src={post.profiles?.avatar_url || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
 <div style={{ flex: 1 }}>
 <div style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
 {post.profiles?.username || 'User'}
 {status.isOnline ? (<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div><span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span></div>) : (status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>)}
 </div>
 <div style={{ fontSize: '12px', color: '#65676b' }}>{formatTime(post.created_at)} · {post.province}</div>
 </div>
 <div style={{ position: 'relative', marginTop: '-4px' }}>
 <button onClick={() => setActiveMenu(activeMenu === post.id ? null : post.id)} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="#65676b"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg></button>
 {activeMenu === post.id && (
 <div style={{ position: 'absolute', right: 0, top: '40px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '8px', zIndex: 150, width: '130px', border: '1px solid #eee', overflow: 'hidden' }}>
 {isPostOwner(post) ? (
 <>
 <div onClick={() => router.push(`/edit-post/${post.id}`)} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', borderBottom: '1px solid #eee', fontWeight: 'normal' }}>ແກ້ໄຂ</div>
 <div onClick={() => handleDeletePost(post.id)} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', borderBottom: '1px solid #eee', fontWeight: 'normal' }}>ລົບ</div>
 <div onClick={() => alert("Boost post ກຳລັງພັດທະນາໃນອະນາຄົດ")} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', fontWeight: 'normal' }}>Boost post</div>
 </>
 ) : (
 <div onClick={() => handleReport(post)} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', fontWeight: 'normal' }}>ລາຍງານ</div>
 )}
 </div>
 )}
 </div>
 </div>
 <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{post.caption}</div>
 <PhotoGrid images={post.images || []} onPostClick={() => handleViewPost(post)} />
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f0f2f5' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
 <div onClick={() => toggleLike(post.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><svg width="22" height="22" viewBox="0 0 24 24" className="animate-heart" fill="#e0245e" stroke="#e0245e" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span style={{ fontSize: '14px', fontWeight: '600', color: '#e0245e' }}>{post.likes || 0}</span></div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#65676b' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg><span style={{ fontSize: '14px', fontWeight: '500' }}>{post.views || 0}</span></div>
 <div onClick={() => toggleSave(post.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" className={savedPosts[post.id] ? "animate-pop" : ""} fill={savedPosts[post.id] ? "#FFD700" : "none"} stroke={savedPosts[post.id] ? "#FFD700" : "#65676b"} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg><span style={{ fontSize: '14px', fontWeight: '600', color: savedPosts[post.id] ? '#FFD700' : '#65676b', marginLeft: '4px' }}>{post.saves || 0}</span></div>
 <div onClick={() => handleShare(post)} style={{ cursor: 'pointer' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2.8"><path d="M15 3h6v6" /><path d="M10 14L21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg></div>
 </div>
 {isPostOwner(post) ? (
 <button onClick={() => togglePostStatus(post.id, post.status)} style={{ background: '#f0f2f5', padding: '6px 12px', borderRadius: '6px', border: 'none', color: '#8e8e8e', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>{tab === 'recommend' ? 'ຍ້າຍໄປຂາຍແລ້ວ' : 'ຍ້າຍໄປພ້ອມຂาย'}</button>
 ) : (
 post.profiles?.phone && <a href={`https://wa.me/${post.profiles.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0f2f5', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none', color: '#65676b', fontWeight: '600', fontSize: '13px' }}>WhatsApp</a>
 )}
 </div>
 </div>
 );
 })
 ) : (
 !loadingMore && <div style={{ textAlign: 'center', padding: '100px 20px', color: '#65676b', fontSize: '16px' }}>ຍັງບໍ່ມີລາຍການ</div>
 )}

 {loadingMore && (
 <div style={{ padding: '20px', textAlign: 'center', color: '#65676b', fontSize: '14px' }}>ກຳລັງໂຫຼດ...</div>
 )}

 {viewingPost && (() => {
 const status = getOnlineStatus(viewingPost.profiles?.last_seen);
 return (
 <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 2000, display: 'flex', justifyContent: 'center' }}>
 <div style={{ width: '100%', maxWidth: '600px', height: '100%', background: '#fff', position: 'relative', overflowY: 'auto' }}>
 <button onClick={() => setViewingPost(null)} style={{ position: 'absolute', right: '15px', top: '15px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', zIndex: 10, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
 <div style={{ padding: '20px 15px 15px 15px' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}><img src={viewingPost.profiles?.avatar_url || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
 <div>
 <div style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
 {viewingPost.profiles?.username || 'User'}
 {status.isOnline ? (<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div><span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span></div>) : (status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>)}
 </div>
 <div style={{ fontSize: '12px', color: '#65676b' }}>{formatTime(viewingPost.created_at)} · {viewingPost.province}</div>
 </div>
 </div>
 <div style={{ fontSize: '16px', lineHeight: '1.5', whiteSpace: 'pre-wrap', marginBottom: '20px', color: '#000' }}>{viewingPost.caption}</div>
 {viewingPost.images.map((img: string, idx: number) => (
 <div key={idx} style={{ marginBottom: '15px', width: '100%' }}><img src={img} onClick={() => { setFullScreenImages(viewingPost.images); setCurrentImgIndex(idx); }} style={{ width: '100%', borderRadius: '4px', display: 'block', cursor: 'pointer' }} /></div>
 ))}
 </div>
 </div>
 </div>
 );
 })()}

 {fullScreenImages && (
 <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000, display: 'flex', flexDirection: 'column', touchAction: 'none' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
 <div style={{ padding: '15px', display: 'flex', justifyContent: 'flex-end', gap: '15px', alignItems: 'center' }}>
 <div style={{ position: 'relative' }}>
 <button onClick={(e) => { e.stopPropagation(); setActivePhotoMenu(activePhotoMenu === currentImgIndex ? null : currentImgIndex); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg></button>
 {activePhotoMenu === currentImgIndex && (<div style={{ position: 'absolute', right: 0, top: '45px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', borderRadius: '8px', width: '130px', zIndex: 3100, overflow: 'hidden' }}><div onClick={() => downloadImage(fullScreenImages[currentImgIndex])} style={{ padding: '15px', fontSize: '14px', cursor: 'pointer', color: '#1c1e21', fontWeight: 'bold', textAlign: 'center' }}>ບັນທຶກຮູບ</div></div>)}
 </div>
 <button onClick={() => { setFullScreenImages(null); setActivePhotoMenu(null); }} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
 </div>
 <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
 <div style={{ display: 'flex', transition: 'transform 0.3s ease-out', transform: `translateX(-${currentImgIndex * 100}%)`, width: '100%' }}>
 {fullScreenImages.map((img, idx) => (<div key={idx} style={{ minWidth: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><img src={img} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} /></div>))}
 </div>
 </div>
 <div style={{ padding: '20px', textAlign: 'center', color: '#fff', fontSize: '16px', background: 'rgba(0,0,0,0.3)', fontWeight: 'bold' }}>{currentImgIndex + 1} / {fullScreenImages.length}</div>
 </div>
 )}
 </main>
 );
}
