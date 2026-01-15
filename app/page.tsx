'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
 const router = useRouter();
 const [tab, setTab] = useState('recommend');
 const [posts, setPosts] = useState<any[]>([]);
 const [searchTerm, setSearchTerm] = useState('');
 const [session, setSession] = useState<any>(null);
 const [userProfile, setUserProfile] = useState<any>(null);
 const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
 const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
 const [viewingPost, setViewingPost] = useState<any | null>(null);
 const [activeMenu, setActiveMenu] = useState<string | null>(null);
 const [myGuestPosts, setMyGuestPosts] = useState<{ post_id: string, token: string }[]>([]);

 const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
 const [currentImgIndex, setCurrentImgIndex] = useState(0);
 const [touchStart, setTouchStart] = useState<number | null>(null);
 const [activePhotoMenu, setActivePhotoMenu] = useState<number | null>(null);

 // --- State สำหรับ Pop-up เงื่อนไข ---
 const [showTermsModal, setShowTermsModal] = useState(false);
 const [acceptedTerms, setAcceptedTerms] = useState(false);

 // --- ส่วนที่เพิ่มใหม่สำหรับ Pagination & Infinite Scroll ---
 const [page, setPage] = useState(0);
 const [hasMore, setHasMore] = useState(true);
 const [loadingMore, setLoadingMore] = useState(false);
 const PAGE_SIZE = 12; // โหลดครั้งละ 12 โพสต์
 const observer = useRef<IntersectionObserver | null>(null);

 // ตัวตรวจจับจุดสิ้นสุดหน้าจอ - แก้ไขให้เช็ค loadingMore ก่อนสร้าง Observer เพื่อลดการกระตุก
 const lastPostElementRef = useCallback((node: any) => {
 if (loadingMore || !hasMore) return; 
 if (observer.current) observer.current.disconnect();
 observer.current = new IntersectionObserver(entries => {
 if (entries[0].isIntersecting && hasMore) {
 setPage(prevPage => prevPage + 1);
 }
 }, { threshold: 0.1 }); // เพิ่ม threshold เล็กน้อยเพื่อให้สมูทขึ้น
 if (node) observer.current.observe(node);
 }, [loadingMore, hasMore]);
 // ----------------------------------------------------

 // --- เพิ่มเฉพาะส่วนที่เกี่ยวข้องกับรายงาน ---
 const [reportingPost, setReportingPost] = useState<any | null>(null);
 const [reportReason, setReportReason] = useState('');
 const [isSubmittingReport, setIsSubmittingReport] = useState(false);
 // ---------------------------------------

 const getPrimaryGuestToken = () => {
 const stored = JSON.parse(localStorage.getItem('my_guest_posts') || '[]');
 if (stored.length > 0) return stored[0].token;
 let deviceToken = localStorage.getItem('device_guest_token');
 if (!deviceToken) {
 deviceToken = 'guest-' + Math.random().toString(36).substr(2, 9);
 localStorage.setItem('device_guest_token', deviceToken);
 }
 return deviceToken;
 };

 const updateLastSeen = async (idOrToken: string) => {
 if (!idOrToken) return;
 await supabase
 .from('profiles')
 .update({ last_seen: new Date().toISOString() })
 .eq('id', idOrToken);
 };

 const fetchUserProfile = async (userId: string) => {
 const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
 if (data) setUserProfile(data);
 };

 // --- ส่วนที่แก้ไข: อัลกอริทึมการผสมโพสต์ Boost (ข้อ 2) ---
 const mixBoostedPosts = (normal: any[], boosted: any[]) => {
 if (boosted.length === 0) return normal;
 let mixed = [...normal];
 let boostIdx = 0;
 // แทรกทุกๆ 5 โพสต์ (ค่ากลางระหว่าง 3-8 ตามโจทย์)
 for (let i = 5; i < mixed.length && boostIdx < boosted.length; i += 6) {
 mixed.splice(i, 0, boosted[boostIdx]);
 boostIdx++;
 }
 return mixed;
 };

 // ปรับปรุงฟังก์ชัน Fetch ให้รองรับ Algorithm (ข้อ 1, 2, 3, 4, 5, 6)
 const fetchPosts = async (isInitial = false) => {
 if (loadingMore) return; // ป้องกันการเรียกซ้ำซ้อน
 setLoadingMore(true);
 const from = isInitial ? 0 : page * PAGE_SIZE;
 const to = from + PAGE_SIZE - 1;

 let finalData = [];

 // แยก Logic ตาม Tab
 if (tab === 'sold') {
 // ข้อ 6: ฟีดขายแล้วให้เรียงตามโพสต์ล่าสุดเท่านั้น
 const { data } = await supabase
 .from('cars')
 .select('*, profiles!cars_user_id_fkey(*)')
 .eq('status', 'sold')
 .eq('is_hidden', false)
 .order('created_at', { ascending: false })
 .range(from, to);
 finalData = data || [];
 } else {
 // ข้อ 1, 3, 4, 5: ใช้ Algorithm RPC (รวมความใหม่, ยอดนิยม, ความน่าเชื่อถือ และความสนใจ)
 // ดึงประวัติจังหวัดที่สนใจ (ข้อ 5)
 const lastProvince = localStorage.getItem('last_searched_province') || null;
 
 const { data: algoData, error: algoError } = await supabase
 .rpc('get_smart_feed', { user_interest_province: lastProvince })
 // เนื่องจาก RPC คืนค่าเซ็ตข้อมูล เรากรองเพิ่มในแอปหรือสร้าง RPC ให้รองรับ range/search
 .limit(PAGE_SIZE); 
 
 // หมายเหตุ: เพื่อความแม่นยำกับ Search เราจะใช้การ Filter เพิ่มเติม
 let filtered = algoData || [];
 if (searchTerm) {
 // แก้ไขจุดที่ 1: เติม : any เพื่อให้ build ผ่าน
 filtered = filtered.filter((p: any) => 
 p.caption?.toLowerCase().includes(searchTerm.toLowerCase()) || 
 p.province?.toLowerCase().includes(searchTerm.toLowerCase())
 );
 }
 
 // ใน SQL 'get_smart_feed' ล่าสุดได้รวม Boosted Posts เข้าไปแล้วตาม Logic คะแนน
 // เราจึงใช้ข้อมูลจาก RPC โดยตรงเพื่อป้องกันข้อมูลซ้ำซ้อน
 finalData = filtered;
 }

 if (isInitial) {
 setPosts(finalData);
 } else {
 // ป้องกันการเพิ่มข้อมูลซ้ำกรณี Pagination ดึงข้อมูลเดิม
 setPosts(prev => {
 const existingIds = new Set(prev.map(p => p.id));
 const newUniquePosts = finalData.filter(p => !existingIds.has(p.id));
 return [...prev, ...newUniquePosts];
 });
 }
 
 setHasMore(finalData.length === PAGE_SIZE); // ตรวจสอบว่ายังมีหน้าถัดไปไหม
 setLoadingMore(false);
 };

 // เมื่อเปลี่ยน Tab หรือ Search ให้รีเซ็ตหน้าใหม่
 useEffect(() => {
 setPage(0);
 setHasMore(true);
 fetchPosts(true);
 // เก็บประวัติการค้นหาเพื่อใช้ในข้อ 5
 if (searchTerm) {
 localStorage.setItem('last_searched_province', searchTerm);
 }
 }, [tab, searchTerm]);

 // เมื่อ Page เปลี่ยน (เลื่อนลงมา) ให้โหลดเพิ่ม
 useEffect(() => {
 if (page > 0) {
 fetchPosts();
 }
 }, [page]);

 const fetchSavedStatus = async (userIdOrToken: string) => {
 const { data } = await supabase
 .from('post_saves')
 .select('post_id')
 .eq('user_id', userIdOrToken);
 if (data) {
 const savedMap: { [key: string]: boolean } = {};
 data.forEach(item => savedMap[item.post_id] = true);
 setSavedPosts(savedMap);
 }
 };

 const fetchLikedStatus = async (userIdOrToken: string) => {
 const { data } = await supabase
 .from('post_likes')
 .select('post_id')
 .eq('user_id', userIdOrToken);
 if (data) {
 const likedMap: { [key: string]: boolean } = {};
 data.forEach(item => likedMap[item.post_id] = true);
 setLikedPosts(likedMap);
 }
 };

 useEffect(() => {
 const stored = JSON.parse(localStorage.getItem('my_guest_posts') || '[]');
 setMyGuestPosts(stored);

 const handleActiveStatus = async (currentSession: any) => {
 if (currentSession) {
 await updateLastSeen(currentSession.user.id);
 fetchUserProfile(currentSession.user.id);
 fetchSavedStatus(currentSession.user.id);
 fetchLikedStatus(currentSession.user.id);
 } else {
 const token = getPrimaryGuestToken();
 await updateLastSeen(token);
 setUserProfile(null);
 fetchSavedStatus(token);
 fetchLikedStatus(token);
 if (stored.length > 0) {
 const uniqueTokens = Array.from(new Set(stored.map((p: any) => p.token)));
 for (const t of uniqueTokens) {
 if (typeof t === 'string' && t !== token) await updateLastSeen(t);
 }
 }
 }
 };

 supabase.auth.getSession().then(({ data: { session } }) => {
 setSession(session);
 handleActiveStatus(session);
 });

 const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
 setSession(session);
 handleActiveStatus(session);
 });

 const interval = setInterval(() => {
 const latestStored = JSON.parse(localStorage.getItem('my_guest_posts') || '[]');
 supabase.auth.getSession().then(({ data: { session } }) => {
 if (session) {
 updateLastSeen(session.user.id);
 } else {
 const token = getPrimaryGuestToken();
 updateLastSeen(token);
 const uniqueTokens = Array.from(new Set(latestStored.map((p: any) => p.token)));
 uniqueTokens.forEach(t => {
 if (typeof t === 'string' && t !== token) updateLastSeen(t);
 });
 }
 });
 }, 120000);

 return () => {
 subscription.unsubscribe();
 clearInterval(interval);
 };
 }, []); // เอา tab/searchTerm ออกเพราะแยกไปจัดการด้านบนแล้ว

 const getOnlineStatus = (lastSeen: string | null) => {
 if (!lastSeen) return { isOnline: false, text: '' };
 const now = new Date().getTime();
 const lastActive = new Date(lastSeen).getTime();
 const diffInSeconds = Math.floor((now - lastActive) / 1000);
 if (diffInSeconds < 300) return { isOnline: true, text: 'ອອນລາຍ' };
 if (diffInSeconds < 60) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ເມື່ອຄູ່` };
 const diffInMinutes = Math.floor(diffInSeconds / 60);
 if (diffInMinutes < 60) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInMinutes} ນາທີທີ່ແລ้ว` };
 const diffInHours = Math.floor(diffInMinutes / 60);
 if (diffInHours < 24) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInHours} ຊົ່ວໂມงທີ່ແລ້ວ` };
 const diffInDays = Math.floor(diffInHours / 24);
 if (diffInDays < 7) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInDays} ມື้ທີ່ແล้ว` };
 const diffInWeeks = Math.floor(diffInDays / 7);
 if (diffInWeeks < 4) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInWeeks} ອາທິດທີ່ແລ້ว` };
 const diffInMonths = Math.floor(diffInDays / 30);
 return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInMonths} ເດືອນที่แล้ว` };
 };

 const handleLogoClick = () => {
 setPage(0);
 fetchPosts(true);
 window.scrollTo({ top: 0, behavior: 'smooth' });
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
 if (diffInDays < 7) return `${diffInDays} ມື້`;
 const diffInWeeks = Math.floor(diffInDays / 7);
 if (diffInWeeks < 4) return `${diffInWeeks} ອາທິດ`;
 const diffInMonths = Math.floor(diffInDays / 30);
 if (diffInMonths < 12) return `${diffInMonths} ເດືອນ`;
 return new Date(dateString).toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' });
 };

 // --- ส่วนที่แก้ไข: ปรับปรุง Logic ตรวจสอบความเป็นเจ้าของโพสต์ ---
 const isPostOwner = (post: any) => {
 // 1. เช็คจาก Session (กรณีล็อกอิน)
 if (session && String(post.user_id) === String(session.user.id)) return true;
 
 // 2. เช็คจาก Guest Token ใน LocalStorage (กรณีโพสต์แบบ Guest)
 try {
 const stored = JSON.parse(localStorage.getItem('my_guest_posts') || '[]');
 // แก้ไขจุดที่ 2: บังคับใช้ String() ทั้งสองฝั่งเพื่อให้ข้อมูลชนิดเดียวกันเทียบกันได้
 return stored.some((item: any) => String(item.post_id) === String(post.id));
 } catch (e) {
 return false;
 }
 };

 const toggleLike = async (postId: string) => {
 const userId = session ? session.user.id : getPrimaryGuestToken();
 const isCurrentlyLiked = likedPosts[postId];
 
 // Optimistic UI: อัปเดตหน้าจอทันที
 setLikedPosts(prev => ({ ...prev, [postId]: !isCurrentlyLiked }));
 setPosts(prev => prev.map(p => {
 if (p.id === postId) {
 return { ...p, likes: isCurrentlyLiked ? (p.likes || 1) - 1 : (p.likes || 0) + 1 };
 }
 return p;
 }));

 if (isCurrentlyLiked) {
 // 1. ลบจากตารางหลักฐาน
 const { error: relError } = await supabase.from('post_likes').delete().eq('user_id', userId).eq('post_id', postId);
 // 2. ลดจำนวนในตารางหลัก
 const { error: mainError } = await supabase.rpc('decrement_likes', { row_id: postId });
 
 if (relError || mainError) {
 setLikedPosts(prev => ({ ...prev, [postId]: true }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p));
 }
 } else {
 // 1. เพิ่มลงตารางหลักฐาน
 const { error: relError } = await supabase.from('post_likes').insert([{ user_id: userId, post_id: postId }]);
 // 2. เพิ่มจำนวนในตารางหลัก
 const { error: mainError } = await supabase.rpc('increment_likes', { row_id: postId });

 if (relError || mainError) {
 setLikedPosts(prev => ({ ...prev, [postId]: false }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: (p.likes || 1) - 1 } : p));
 }
 }
 };

 const toggleSave = async (postId: string) => {
 const userId = session ? session.user.id : getPrimaryGuestToken();
 const isCurrentlySaved = savedPosts[postId];

 // Optimistic UI: อัปเดตหน้าจอทันที
 setSavedPosts(prev => ({ ...prev, [postId]: !isCurrentlySaved }));
 setPosts(prev => prev.map(p => {
 if (p.id === postId) {
 return { ...p, saves: isCurrentlySaved ? (p.saves || 1) - 1 : (p.saves || 0) + 1 };
 }
 return p;
 }));

 if (isCurrentlySaved) {
 const { error: relError } = await supabase.from('post_saves').delete().eq('user_id', userId).eq('post_id', postId);
 const { error: mainError } = await supabase.rpc('decrement_saves', { row_id: postId });

 if (relError || mainError) {
 setSavedPosts(prev => ({ ...prev, [postId]: true }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: (p.saves || 0) + 1 } : p));
 }
 } else {
 const { error: relError } = await supabase.from('post_saves').insert([{ user_id: userId, post_id: postId }]);
 const { error: mainError } = await supabase.rpc('increment_saves', { row_id: postId });

 if (relError || mainError) {
 setSavedPosts(prev => ({ ...prev, [postId]: false }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: (p.saves || 1) - 1 } : p));
 }
 }
 };

 const handleViewPost = async (post: any) => {
 setViewingPost(post);
 // อัปเดตยอดวิวในตาราง cars ทันที
 const { error } = await supabase.rpc('increment_views', { post_id: post.id });
 // หรือถ้าไม่มี RPC ใช้การ Update ปกติ
 if (error) {
 await supabase.from('cars').update({ views: (post.views || 0) + 1 }).eq('id', post.id);
 }
 // อัปเดต State ในหน้าจอเพื่อให้ยอดวิวเด้งตาม
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

 const handleDeletePost = async (postId: string) => {
 if (!confirm("ທ່ານແນ່ໃຈຫຼືບໍ່ว่าต้องการลึบໂພສນີ້?")) return;
 const { error } = await supabase.from('cars').delete().eq('id', postId);
 if (!error) {
 setPosts(prev => prev.filter(p => p.id !== postId));
 alert("ລຶບໂພສສຳເລັດແລ้ວ");
 } else {
 alert("ເກີດຂໍ้ຜິດພາດ: " + error.message);
 }
 setActiveMenu(null);
 };

 // --- แก้ไขเฉพาะส่วน handleReport และปรับ submitReport ให้ตรงกับคอลัมน์ใหม่ ---
 const handleReport = (post: any) => {
 if (!session) {
 alert("ກະລຸນາລົງທະບຽນກ່ອນ");
 return;
 }
 setReportingPost(post);
 setActiveMenu(null);
 };

 const submitReport = async () => {
 if (!reportReason.trim()) {
 alert("ກະລຸນาລະบุสาเหดการรายงาน");
 return;
 }
 setIsSubmittingReport(true);
 const { error } = await supabase.from('reports').insert([
 { 
 post_id: reportingPost.id, 
 car_id: reportingPost.id,
 reporter_email: session.user.email,
 post_caption: reportingPost.caption,
 reason: reportReason, 
 status: 'pending' 
 }
 ]);

 if (error) {
 alert("ເກີດຂໍ້ຜິດພาด: " + error.message);
 } else {
 alert("ລາຍງານສຳເລັດແລ້ວ! Admin ຈະກວດສອບໂດຍໄວ");
 setReportingPost(null);
 setReportReason('');
 }
 setIsSubmittingReport(false);
 };
 // ----------------------------------------------------

 const handleShare = async (post: any) => {
 const userId = session ? session.user.id : getPrimaryGuestToken();
 const shareData = { title: 'Car Post', text: post.caption, url: window.location.href };
 try {
 if (navigator.share) {
 await navigator.share(shareData);
 // 1. บันทึกหลักฐานการแชร์
 await supabase.from('post_shares').insert([{ user_id: userId, post_id: post.id }]);
 // 2. อัปเดตจำนวนในตารางหลัก
 await supabase.rpc('increment_shares', { row_id: post.id });
 
 setPosts(prev => prev.map(p => p.id === post.id ? { ...p, shares: (p.shares || 0) + 1 } : p));
 }
 else { 
 navigator.clipboard.writeText(window.location.href); 
 alert("ຄັດລອກລິ້ງສຳເລັດແລ້ວ!"); 
 }
 } catch (err) { console.log('User cancelled share'); }
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
 } catch (err) { alert("ບໍ່ສາມາດບັນທຶກຮູບໄດ້ในขณะนี้"); }
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
 if (count === 2) return (
 <div onClick={onPostClick} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', cursor: 'pointer' }}>
 <img src={images[0]} style={{ width: '100%', height: '300px', objectFit: 'cover' }} />
 <img src={images[1]} style={{ width: '100%', height: '300px', objectFit: 'cover' }} />
 </div>
 );
 if (count === 3) return (
 <div onClick={onPostClick} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', cursor: 'pointer' }}>
 <img src={images[0]} style={{ width: '100%', height: '400px', objectFit: 'cover', gridRow: 'span 2' }} />
 <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '2px' }}>
 <img src={images[1]} style={{ width: '100%', height: '199px', objectFit: 'cover' }} />
 <img src={images[2]} style={{ width: '100%', height: '199px', objectFit: 'cover' }} />
 </div>
 </div>
 );
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

 // --- ฟังก์ชันจัดการการกดปุ่มสร้างโพสต์ (+) ---
 const handleCreatePostClick = () => {
 if (session) {
 // ถ้า Login แล้วไปหน้าสร้างโพสต์เลย
 router.push('/create-post');
 } else {
 // ถ้ายังไม่ Login ให้เปิด Modal ยอมรับเงื่อนไข
 setShowTermsModal(true);
 }
 };

 return (
 <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: 'sans-serif', position: 'relative' }}>
 <style>{`
 @keyframes heartBeat { 0% { transform: scale(1); } 25% { transform: scale(1.3); } 50% { transform: scale(1); } 75% { transform: scale(1.3); } 100% { transform: scale(1); } }
 @keyframes popOnce { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }
 .animate-heart { animation: heartBeat 0.4s linear; }
 .animate-pop { animation: popOnce 0.3s ease-out; }
 `}</style>

 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: 0, background: '#fff', zIndex: 100, borderBottom: '1px solid #f0f0f0' }}>
 <img src="https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/car-images/1000253086.jpg" alt="Logo" onClick={handleLogoClick} style={{ width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', objectFit: 'cover' }} />
 <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f0f2f5', borderRadius: '20px', padding: '6px 15px' }}>
 <span style={{ marginRight: '8px', color: '#65676b' }}>🔍</span>
 <input type="text" placeholder="ຄົ້ນຫາ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '14px' }} />
 </div>
 <button onClick={handleCreatePostClick} style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#1877f2', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
 
 {/* เพิ่มปุ่มกระดิ่งแจ้งเตือนตามความต้องการ */}
 <button 
 onClick={() => router.push('/notification')} 
 style={{ 
 width: '38px', 
 height: '38px', 
 borderRadius: '50%', 
 background: '#f0f2f5', 
 border: 'none', 
 cursor: 'pointer', 
 display: 'flex', 
 alignItems: 'center', 
 justifyContent: 'center', 
 flexShrink: 0 
 }}
 >
 <svg width="22" height="22" viewBox="0 0 24 24" fill="#65676b">
 <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
 </svg>
 </button>

 <div onClick={() => router.push('/profile')} style={{ cursor: 'pointer', flexShrink: 0 }}>
 <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
 {userProfile?.avatar_url ? (
 <img src={userProfile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
 ) : (
 <svg width="22" height="22" viewBox="0 0 24 24" fill={session ? "#1877f2" : "#65676b"}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
 )}
 </div>
 </div>
 </div>

 <div style={{ display: 'flex', borderBottom: '1px solid #ddd' }}>
 {['recommend', 'sold'].map((t) => (
 <div key={t} onClick={() => setTab(t)} style={{ flex: 1, textAlign: 'center', padding: '15px', color: tab === t ? '#1877f2' : '#65676b', fontWeight: 'bold', borderBottom: tab === t ? '3px solid #1877f2' : 'none', cursor: 'pointer' }}>{t === 'recommend' ? 'ພ້ອມຂາຍ' : 'ຂາຍແລ້ວ'}</div>
 ))}
 </div>

 {posts.map((post, index) => {
 const status = getOnlineStatus(post.profiles?.last_seen);
 const isLastElement = posts.length === index + 1;
 return (
 <div 
 key={`${post.id}-${index}`} 
 ref={isLastElement ? lastPostElementRef : null} 
 style={{ borderBottom: '8px solid #f0f2f5', position: 'relative' }}
 >
 <div style={{ padding: '12px 15px 8px 15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
 <div style={{ position: 'relative' }}>
 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
 {post.profiles?.avatar_url ? (
 <img src={post.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
 ) : (
 <svg width="26" height="26" viewBox="0 0 24 24" fill="#65676b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
 )}
 </div>
 </div>
 <div style={{ flex: 1 }}>
 <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
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
 {/* แก้ไขจุดการแสดงผล Ad สำหรับโพสต์ที่ Boost - เปลี่ยนสี Ad เป็นสีเทาตามโจทย์ */}
 <div style={{ fontSize: '12px', color: '#65676b', lineHeight: '16px' }}>
 {post.is_boosted ? (
 <span style={{ display: 'inline-flex', alignItems: 'center' }}>
 <span style={{ fontWeight: 'bold', color: '#65676b' }}>• Ad</span> 
 <span style={{ marginLeft: '4px' }}>{formatTime(post.created_at)}</span>
 <span style={{ margin: '0 4px' }}>•</span>
 {post.province}
 </span>
 ) : (
 <>{formatTime(post.created_at)} · {post.province}</>
 )}
 </div>
 </div>
 <div style={{ position: 'relative', marginTop: '-4px' }}>
 <button onClick={() => setActiveMenu(activeMenu === post.id ? null : post.id)} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="#65676b"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg></button>
 {activeMenu === post.id && (
 <div style={{ position: 'absolute', right: 0, top: '40px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '8px', zIndex: 150, width: '130px', border: '1px solid #eee', overflow: 'hidden' }}>
 {isPostOwner(post) ? (
 <>
 <div onClick={() => { setActiveMenu(null); router.push(`/edit-post/${post.id}`); }} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', borderBottom: '1px solid #eee', fontWeight: 'normal' }}>แກ้ไข</div>
 <div onClick={() => handleDeletePost(post.id)} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', borderBottom: '1px solid #eee', fontWeight: 'normal' }}>ລົບ</div>
 <div onClick={() => { setActiveMenu(null); router.push(`/boost_post?id=${post.id}`); }} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', fontWeight: 'normal' }}>Boost Post</div>
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
 <div style={{ borderTop: '1px solid #f0f2f5' }}>
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
 <div onClick={() => toggleLike(post.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><svg width="22" height="22" viewBox="0 0 24 24" className={likedPosts[post.id] ? "animate-heart" : ""} fill={likedPosts[post.id] ? "#e0245e" : "none"} stroke={likedPosts[post.id] ? "#e0245e" : "#65676b"} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span style={{ fontSize: '14px', fontWeight: '600', color: likedPosts[post.id] ? '#e0245e' : '#65676b' }}>{post.likes || 0}</span></div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#65676b' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg><span style={{ fontSize: '14px', fontWeight: '500' }}>{post.views || 0}</span></div>
 <div onClick={() => toggleSave(post.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" className={savedPosts[post.id] ? "animate-pop" : ""} fill={savedPosts[post.id] ? "#FFD700" : "none"} stroke={savedPosts[post.id] ? "#FFD700" : "#65676b"} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg><span style={{ fontSize: '14px', fontWeight: '600', color: savedPosts[post.id] ? '#FFD700' : '#65676b', marginLeft: '4px' }}>{post.saves || 0}</span></div>
 <div onClick={() => handleShare(post)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14L21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg></div>
 </div>
 {isPostOwner(post) ? (
 <button onClick={() => togglePostStatus(post.id, post.status)} style={{ background: '#f0f2f5', padding: '6px 12px', borderRadius: '6px', border: 'none', color: '#8e8e8e', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>{tab === 'recommend' ? 'ຍ້າຍໄປຂາຍແລ້ວ' : 'ຍ້າຍໄປພ້ອມຂາຍ'}</button>
 ) : (
 post.profiles?.phone && (
 <a href={`https://wa.me/${post.profiles.phone.replace(/\+/g, '').replace(/ /g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0f2f5', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none', color: '#65676b', fontWeight: '600', fontSize: '13px' }}>WhatsApp</a>
 )
 )}
 </div>
 </div>
 </div>
 )
 })}

 {/* Loading Indicator */}
 {loadingMore && (
 <div style={{ padding: '20px', textAlign: 'center', color: '#65676b', fontSize: '14px' }}>
 ກຳລັງໂຫຼດ...
 </div>
 )}

 {/* --- Modal ยอมรับเงื่อนไขสำหรับ Guest --- */}
 {showTermsModal && (
 <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
 <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '350px', padding: '30px 20px', position: 'relative', textAlign: 'center' }}>
 <button onClick={() => setShowTermsModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#65676b' }}>✕</button>
 
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '40px 0 30px 0' }}>
 <input 
 type="checkbox" 
 id="modal-terms"
 checked={acceptedTerms}
 onChange={(e) => setAcceptedTerms(e.target.checked)}
 style={{ width: '20px', height: '20px', cursor: 'pointer' }}
 />
 <label htmlFor="modal-terms" style={{ fontSize: '15px', color: '#000', cursor: 'pointer' }}>
 ຍອມຮັບ <Link 
 href="/terms" 
 style={{ color: '#1877f2', textDecoration: 'none', fontWeight: 'bold' }}
 >
 ຂໍ້ກຳນົດແລະນະໂຍບາຍ
 </Link>
 </label>
 </div>

 <button 
 onClick={() => {
 if(acceptedTerms) {
 setShowTermsModal(false);
 router.push('/create-post');
 }
 }}
 disabled={!acceptedTerms}
 style={{ 
 width: '120px', 
 padding: '12px', 
 background: acceptedTerms ? '#1877f2' : '#e4e6eb', 
 color: acceptedTerms ? '#fff' : '#999', 
 border: 'none', 
 borderRadius: '12px', 
 fontWeight: 'bold', 
 fontSize: '16px', 
 cursor: acceptedTerms ? 'pointer' : 'not-allowed',
 transition: '0.3s'
 }}
 >
 ຕໍ່ໄປ
 </button>
 </div>
 </div>
 )}

 {/* --- ส่วนของ Modal รายงาน --- */}
 {reportingPost && (
 <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
 <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '20px' }}>
 <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', textAlign: 'center' }}>ລາຍງານໂພສ</h3>
 <p style={{ fontSize: '14px', color: '#65676b', marginBottom: '10px' }}>ກະລຸນาລະບุສາເຫດ:</p>
 <textarea 
 value={reportReason}
 onChange={(e) => setReportReason(e.target.value)}
 placeholder="ພິມລາຍລະອຽດ..."
 style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', marginBottom: '20px', outline: 'none' }}
 />
 <div style={{ display: 'flex', gap: '10px' }}>
 <button onClick={() => setReportingPost(null)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background: '#f0f2f5', fontWeight: 'bold' }}>ຍົກເລີກ</button>
 <button onClick={submitReport} disabled={isSubmittingReport} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: '#1877f2', color: '#fff', fontWeight: 'bold', opacity: isSubmittingReport ? 0.6 : 1 }}>
 {isSubmittingReport ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງລายງານ'}
 </button>
 </div>
 </div>
 </div>
 )}

 {viewingPost && (() => {
 const status = getOnlineStatus(viewingPost.profiles?.last_seen);
 return (
 <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 2000, display: 'flex', justifyContent: 'center' }}>
 <div style={{ width: '100%', maxWidth: '600px', height: '100%', background: '#fff', position: 'relative', overflowY: 'auto', borderLeft: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }}>
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
 <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
 {viewingPost.profiles?.avatar_url ? (<img src={viewingPost.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (<svg width="22" height="22" viewBox="0 0 24 24" fill="#65676b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>)}
 </div>
 <div>
 <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
 {viewingPost.profiles?.username || 'User'}
 {status.isOnline ? (<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div><span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span></div>) : (status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>)}
 </div>
 {/* แก้ไขจุดการแสดงผล Ad สำหรับโพสต์ที่ Boost (ในหน้า View) - เปลี่ยนสี Ad เป็นสีเทาตามโจทย์ */}
 <div style={{ fontSize: '12px', color: '#65676b', lineHeight: '16px' }}>
 {viewingPost.is_boosted ? (
 <span style={{ display: 'inline-flex', alignItems: 'center' }}>
 <span style={{ fontWeight: 'bold', color: '#65676b' }}>• Ad</span> 
 <span style={{ marginLeft: '4px' }}>{formatTime(viewingPost.created_at)}</span>
 <span style={{ margin: '0 4px' }}>•</span>
 {viewingPost.province}
 </span>
 ) : (
 <>{formatTime(viewingPost.created_at)} · {viewingPost.province}</>
 )}
 </div>
 </div>
 </div>
 <button onClick={() => setViewingPost(null)} style={{ background: '#f0f2f5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
 </div>
 <div style={{ padding: '15px' }}><div style={{ color: '#000', fontSize: '16px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{viewingPost.caption}</div></div>
 {viewingPost.images.map((img: string, idx: number) => (
 <div key={idx} style={{ position: 'relative', background: '#fff', marginBottom: '24px' }}><div style={{ width: '100%', overflow: 'hidden' }}><img src={img} onClick={() => { setFullScreenImages(viewingPost.images); setCurrentImgIndex(idx); }} style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }} /></div></div>
 ))}
 <div style={{ height: '80px' }}></div>
 </div>
 </div>
 )})()}

 {fullScreenImages && (
 <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000, display: 'flex', flexDirection: 'column', touchAction: 'none' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
 <div style={{ padding: '15px', display: 'flex', justifyContent: 'flex-end', gap: '15px', alignItems: 'center' }}>
 <div style={{ position: 'relative' }}>
 <button onClick={(e) => { e.stopPropagation(); setActivePhotoMenu(activeMenu === currentImgIndex ? null : currentImgIndex); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg></button>
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
