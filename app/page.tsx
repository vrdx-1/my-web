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
 const [activeMenuState, setActiveMenu] = useState<string | null>(null);
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

 // --- ส่วนที่แก้ไข: การจัดการแผง Interaction (BottomSheet) ---
 const [interactionModal, setInteractionModal] = useState<{ show: boolean, type: 'likes' | 'saves', postId: string | null }>({ show: false, type: 'likes', postId: null });
 const [interactionUsers, setInteractionUsers] = useState<any[]>([]);
 const [interactionLoading, setInteractionLoading] = useState(false);
 const [interactionSheetMode, setInteractionSheetMode] = useState<'half' | 'full' | 'hidden'>('hidden');

 // --- ตัวตรวจจับการคลิกไฟล์ (ส่วนที่แก้ไขใหม่) ---
 const hiddenFileInputRef = useRef<HTMLInputElement>(null);

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

 // --- STATE ใหม่สำหรับแผงควบคุม (BottomSheet) ---
 const [startY, setStartY] = useState(0);
 const [currentY, setCurrentY] = useState(0);

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
 // เช็คทั้งตารางจริงและตาราง guest
 const table = session ? 'post_saves' : 'post_saves_guest';
 const column = session ? 'user_id' : 'guest_token';
 
 const { data } = await supabase
 .from(table)
 .select('post_id')
 .eq(column, userIdOrToken);
 if (data) {
 const savedMap: { [key: string]: boolean } = {};
 data.forEach(item => savedMap[item.post_id] = true);
 setSavedPosts(savedMap);
 }
 };

 const fetchLikedStatus = async (userIdOrToken: string) => {
 // เช็คทั้งตารางจริงและตาราง guest
 const table = session ? 'post_likes' : 'post_likes_guest';
 const column = session ? 'user_id' : 'guest_token';

 const { data } = await supabase
 .from(table)
 .select('post_id')
 .eq(column, userIdOrToken);
 if (data) {
 const likedMap: { [key: string]: boolean } = {};
 data.forEach(item => likedMap[item.post_id] = true);
 setLikedPosts(likedMap);
 }
 };

 // ฟังก์ชันสำหรับดึงรายชื่อคนที่กดใจหรือกดบันทึก
 const fetchInteractions = async (type: 'likes' | 'saves', postId: string) => {
 setInteractionLoading(true);
 setInteractionModal({ show: true, type, postId });
 setInteractionSheetMode('half'); // เปิดแผงครึ่งจอทันที
 try {
 const table = type === 'likes' ? 'post_likes' : 'post_saves';
 const guestTable = `${table}_guest`;

 const { data: userData } = await supabase.from(table).select(`created_at, profiles:user_id(username, avatar_url)`).eq('post_id', postId);
 const { data: guestData } = await supabase.from(guestTable).select(`created_at`).eq('post_id', postId);

 const formatted = [
 ...(userData || []).map((item: any) => ({
 username: item.profiles?.username || 'Unknown User',
 avatar_url: item.profiles?.avatar_url || 'https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/car-images/default-avatar.png',
 created_at: item.created_at
 })),
 ...(guestData || []).map((item: any) => ({
 username: 'User',
 avatar_url: 'https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/car-images/default-avatar.png',
 created_at: item.created_at
 }))
 ];
 formatted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
 setInteractionUsers(formatted);
 } catch (err) { console.error(err); } finally { setInteractionLoading(false); }
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
 supabase.auth.getSession().then(({ data: sessionData }) => {
 const currentSession = sessionData?.session;
 if (currentSession) {
 updateLastSeen(currentSession.user.id);
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
 }, [session]); // เพิ่ม session เข้าไปเพื่อให้ fetch status ใหม่เมื่อเปลี่ยนสถานะ

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
 if (diffInHours < 24) return { isOnline: false, text: `ອອນลາຍລ່າສຸດ ${diffInHours} ຊົ່ວໂມງທີ່ແລ້ວ` };
 const diffInDays = Math.floor(diffInHours / 24);
 if (diffInDays < 7) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInDays} ມື้ທີ່ແล้ว` };
 const diffInWeeks = Math.floor(diffInDays / 7);
 if (diffInWeeks < 4) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInWeeks} ອາທິດที่แล้ว` };
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
 const isUser = !!session;
 const userId = isUser ? session.user.id : getPrimaryGuestToken();
 const table = isUser ? 'post_likes' : 'post_likes_guest';
 const column = isUser ? 'user_id' : 'guest_token';
 
 const isCurrentlyLiked = likedPosts[postId];
 const currentPost = posts.find(p => p.id === postId);
 const newLikesCount = isCurrentlyLiked ? (currentPost?.likes || 1) - 1 : (currentPost?.likes || 0) + 1;
 
 // Optimistic UI
 setLikedPosts(prev => ({ ...prev, [postId]: !isCurrentlyLiked }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikesCount } : p));

 if (isCurrentlyLiked) {
 const { error } = await supabase.from(table).delete().eq(column, userId).eq('post_id', postId);
 if (!error) {
 await supabase.from('cars').update({ likes: newLikesCount }).eq('id', postId);
 } else {
 setLikedPosts(prev => ({ ...prev, [postId]: true }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p));
 }
 } else {
 const { error } = await supabase.from(table).insert([{ [column]: userId, post_id: postId }]);
 if (!error) {
 await supabase.from('cars').update({ likes: newLikesCount }).eq('id', postId);
 } else {
 setLikedPosts(prev => ({ ...prev, [postId]: false }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: (p.likes || 1) - 1 } : p));
 }
 }
 };

 const toggleSave = async (postId: string) => {
 const isUser = !!session;
 const userId = isUser ? session.user.id : getPrimaryGuestToken();
 const table = isUser ? 'post_saves' : 'post_saves_guest';
 const column = isUser ? 'user_id' : 'guest_token';

 const isCurrentlySaved = savedPosts[postId];
 const currentPost = posts.find(p => p.id === postId);
 const newSavesCount = isCurrentlySaved ? (currentPost?.saves || 1) - 1 : (currentPost?.saves || 0) + 1;

 // Optimistic UI
 setSavedPosts(prev => ({ ...prev, [postId]: !isCurrentlySaved }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: newSavesCount } : p));

 if (isCurrentlySaved) {
 const { error } = await supabase.from(table).delete().eq(column, userId).eq('post_id', postId);
 if (!error) {
 await supabase.from('cars').update({ saves: newSavesCount }).eq('id', postId);
 } else {
 setSavedPosts(prev => ({ ...prev, [postId]: true }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: (p.saves || 0) + 1 } : p));
 }
 } else {
 const { error } = await supabase.from(table).insert([{ [column]: userId, post_id: postId }]);
 if (!error) {
 await supabase.from('cars').update({ saves: newSavesCount }).eq('id', postId);
 } else {
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
 if (!confirm("ທ່ານแນ่ใจหรือบ่ว่าต้องการลึบโพสนี้?")) return;
 const { error } = await supabase.from('cars').delete().eq('id', postId);
 if (!error) {
 setPosts(prev => prev.filter(p => p.id !== postId));
 alert("ລຶບໂພສສຳເລັດແລ้ว");
 } else {
 alert("ເກີດຂໍ้ຜິດພาด: " + error.message);
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
 alert("ເກີດຂໍ້ຜິດພາດ: " + error.message);
 } else {
 alert("ລາຍງານສຳເລັດແລ້ວ! Admin ຈະກວດສອບໂດຍໄວ");
 setReportingPost(null);
 setReportReason('');
 }
 setIsSubmittingReport(false);
 };
 // ----------------------------------------------------

 const handleShare = async (post: any) => {
 const shareData = { title: 'Car Post', text: post.caption, url: window.location.href };
 try {
 if (navigator.share) {
 await navigator.share(shareData);
 
 const isUser = !!session;
 const userId = isUser ? session.user.id : getPrimaryGuestToken();
 const table = isUser ? 'post_shares' : 'post_shares_guest';
 const column = isUser ? 'user_id' : 'guest_token';

 await supabase.from(table).insert([{ [column]: userId, post_id: post.id }]);

 // อัปเดตยอดแชร์
 await supabase.from('cars').update({ shares: (post.shares || 0) + 1 }).eq('id', post.id);
 setPosts(prev => prev.map(p => p.id === post.id ? { ...p, shares: (p.shares || 0) + 1 } : p));
 }
 else { navigator.clipboard.writeText(window.location.href); alert("ຄັດລອກລິ້ງສຳເລັດແລ້ວ!"); }
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
 <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>+{count - 4}</div>
 )}
 </div>
 ))}
 </div>
 );
 };

 // --- ส่วนที่แก้ไข: ฟังก์ชันจัดการการเลือกไฟล์จากหน้าโฮม (จุดสำคัญ) ---
 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files && e.target.files.length > 0) {
 const filesArray = Array.from(e.target.files);
 const previewUrls = filesArray.map(file => URL.createObjectURL(file));
 sessionStorage.setItem('pending_images', JSON.stringify(previewUrls));
 router.push('/create-post');
 }
 };

 // --- ฟังก์ชันจัดการการกดปุ่มสร้างโพสต์ (+) ---
 const handleCreatePostClick = () => {
 if (session) {
 hiddenFileInputRef.current?.click();
 } else {
 setShowTermsModal(true);
 }
 };

 // --- ส่วนฟังก์ชันจัดการ Sheet (ลากขึ้นลง) สำหรับ Interaction ---
 const onSheetTouchStart = (e: React.TouchEvent) => {
 setStartY(e.touches[0].clientY);
 };

 const onSheetTouchMove = (e: React.TouchEvent) => {
 const moveY = e.touches[0].clientY - startY;
 setCurrentY(moveY);
 };

 const onSheetTouchEnd = () => {
 if (currentY < -50) {
 setInteractionSheetMode('full');
 } else if (currentY > 50) {
 if (interactionSheetMode === 'full') {
 setInteractionSheetMode('half');
 } else {
 setInteractionSheetMode('hidden');
 setInteractionModal({ ...interactionModal, show: false });
 }
 }
 setCurrentY(0);
 };

 return (
 <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: 'sans-serif', position: 'relative' }}>
 <style>{`
 @keyframes heartBeat { 0% { transform: scale(1); } 25% { transform: scale(1.3); } 50% { transform: scale(1); } 75% { transform: scale(1.3); } 100% { transform: scale(1); } }
 @keyframes popOnce { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }
 .animate-heart { animation: heartBeat 0.4s linear; }
 .animate-pop { animation: popOnce 0.3s ease-out; }
 `}</style>

 {/* Input ลับสำหรับเลือกรูปที่หน้าโฮม */}
 <input 
 type="file" 
 ref={hiddenFileInputRef} 
 multiple 
 accept="image/*" 
 onChange={handleFileChange} 
 style={{ display: 'none' }} 
 />

 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: 0, background: '#fff', zIndex: 100, borderBottom: '1px solid #f0f0f0' }}>
 <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f0f2f5', borderRadius: '20px', padding: '6px 15px' }}>
 <span style={{ marginRight: '8px', color: '#65676b' }}>🔍</span>
 <input type="text" placeholder="ຄົ້ນຫາ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '14px' }} />
 </div>
 
 {/* แก้ไขไอคอนโพส (+) ให้มีขนาด 38x38 เท่ากับปุ่มอื่น */}
 <button onClick={handleCreatePostClick} style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#1877f2', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <span style={{ fontSize: '32px', marginTop: '-4px' }}>+</span>
 </button>
 
 {/* ปุ่มแจ้งเตือน (Notification Bell) ขนาด 38x38 */}
 <button onClick={() => router.push('/notification')} style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#f0f2f5', color: '#65676b', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a2.98 2.98 0 0 0 2.818-2H9.182A2.98 2.98 0 0 0 12 22zm7-7.414V11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C8.63 5.36 7 7.92 7 11v3.586l-2 2V18h14v-1.414l-2-2z" /></svg>
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

 <div style={{ display: 'flex', borderBottom: '1px solid #ddd', position: 'sticky', top: '59px', background: '#fff', zIndex: 90 }}>
 {['recommend', 'sold'].map((t) => (
 <div key={t} onClick={() => { setTab(t); handleLogoClick(); }} style={{ flex: 1, textAlign: 'center', padding: '15px', color: tab === t ? '#1877f2' : '#65676b', fontWeight: 'bold', borderBottom: tab === t ? '3px solid #1877f2' : 'none', cursor: 'pointer' }}>{t === 'recommend' ? 'ພ້ອມຂາຍ' : 'ຂາຍແລ້ວ'}</div>
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
 <button onClick={() => setActiveMenu(activeMenuState === post.id ? null : post.id)} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="#65676b"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg></button>
 {activeMenuState === post.id && (
 <div style={{ position: 'absolute', right: 0, top: '40px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '8px', zIndex: 150, width: '130px', border: '1px solid #eee', overflow: 'hidden' }}>
 {isPostOwner(post) ? (
 <>
 <div onClick={() => { setActiveMenu(null); router.push(`/edit-post/${post.id}`); }} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', borderBottom: '1px solid #eee', fontWeight: 'normal' }}>แก้ไข</div>
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
 <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
 <div onClick={() => fetchInteractions('likes', post.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><svg width="22" height="22" viewBox="0 0 24 24" className={likedPosts[post.id] ? "animate-heart" : ""} fill={likedPosts[post.id] ? "#e0245e" : "none"} stroke={likedPosts[post.id] ? "#e0245e" : "#65676b"} strokeWidth="2" onClick={(e) => { e.stopPropagation(); toggleLike(post.id); }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span style={{ fontSize: '14px', fontWeight: '600', color: likedPosts[post.id] ? '#e0245e' : '#65676b' }}>{post.likes || 0}</span></div>
 {/* แก้ไข: ย้าย icon save มาต่อจาก likes พร้อมตัวเลข */}
 <div onClick={() => fetchInteractions('saves', post.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="22" height="22" viewBox="0 0 24 24" className={savedPosts[post.id] ? "animate-pop" : ""} fill={savedPosts[post.id] ? "#FFD700" : "none"} stroke={savedPosts[post.id] ? "#FFD700" : "#65676b"} strokeWidth="2" onClick={(e) => { e.stopPropagation(); toggleSave(post.id); }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg><span style={{ fontSize: '14px', fontWeight: '600', color: savedPosts[post.id] ? '#FFD700' : '#65676b' }}>{post.saves || 0}</span></div>
 
 {/* ส่วนที่แก้ไข: ไอคอนรูปตา (Views) กลับมาเป็นแบบเดิม */}
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#65676b' }}>
   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
     <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
     <circle cx="12" cy="12" r="3"></circle>
   </svg>
   <span style={{ fontSize: '14px', fontWeight: '600' }}>{post.views || 0}</span>
 </div>

 <div onClick={() => handleShare(post)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14L21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg></div>
 </div>
 {isPostOwner(post) ? (
 <button onClick={() => togglePostStatus(post.id, post.status)} style={{ background: '#ff0000', padding: '6px 12px', borderRadius: '6px', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>{tab === 'recommend' ? 'ຍ້າຍໄປຂາຍແລ້ວ' : 'ຍ້າຍໄປພ້ອມຂາຍ'}</button>
 ) : (
 post.profiles?.phone && (
 <a href={`https://wa.me/${post.profiles.phone.replace(/\+/g, '').replace(/ /g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#25D366', width: '36px', height: '36px', borderRadius: '50%', textDecoration: 'none', color: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
 <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
 </a>
 )
 )}
 </div>
 </div>
 </div>
 )
 })}

 {/* ส่วนที่แก้ไขใหม่: Interaction Users Modal (BottomSheet แบบลากได้) */}
 {interactionModal.show && (
 <div style={{ position: 'fixed', inset: 0, background: interactionSheetMode === 'full' ? '#fff' : 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'flex-end', transition: 'background 0.3s' }} onClick={() => { setInteractionSheetMode('hidden'); setInteractionModal({ ...interactionModal, show: false }); }}>
 <div 
 onClick={e => e.stopPropagation()} 
 onTouchStart={onSheetTouchStart}
 onTouchMove={onSheetTouchMove}
 onTouchEnd={onSheetTouchEnd}
 style={{ 
 width: '100%', 
 maxWidth: '600px', 
 margin: '0 auto', 
 background: '#fff', 
 borderRadius: interactionSheetMode === 'full' ? '0' : '20px 20px 0 0', 
 height: interactionSheetMode === 'full' ? 'calc(100% - 110px)' : '50%', 
 transform: `translateY(${currentY > 0 ? currentY : 0}px)`,
 transition: currentY === 0 ? '0.3s ease-out' : 'none',
 display: 'flex',
 flexDirection: 'column',
 overflow: 'hidden'
 }}
 >
 {/* Handle ลาก - แก้ไขให้กดแล้วออกจากหน้าแสดงคนกดได้ทันที */}
 <div 
 onClick={() => { setInteractionSheetMode('hidden'); setInteractionModal({ ...interactionModal, show: false }); }}
 style={{ padding: '12px 0', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
 <div style={{ width: '40px', height: '5px', background: '#000', borderRadius: '10px' }}></div>
 </div>

 {/* ส่วนหัวแสดงไอคอนพร้อมตัวเลขด้านข้างและมีระยะห่างที่พอเหมาะ */}
 <div style={{ display: 'flex', alignItems: 'center', gap: '40px', padding: '10px 25px', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
 <div onClick={() => fetchInteractions('likes', interactionModal.postId!)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
 <svg width="24" height="24" viewBox="0 0 24 24" fill={interactionModal.type === 'likes' ? "#e0245e" : "none"} stroke={interactionModal.type === 'likes' ? "#e0245e" : "#65676b"} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
 <span style={{ fontSize: '15px', fontWeight: 'bold', color: interactionModal.type === 'likes' ? '#e0245e' : '#65676b' }}>
 {posts.find(p => p.id === interactionModal.postId)?.likes || 0}
 </span>
 </div>
 <div style={{ width: '100%', height: '3px', background: interactionModal.type === 'likes' ? '#e0245e' : 'transparent', marginTop: '6px', borderRadius: '2px' }}></div>
 </div>
 <div onClick={() => fetchInteractions('saves', interactionModal.postId!)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
 <svg width="24" height="24" viewBox="0 0 24 24" fill={interactionModal.type === 'saves' ? "#FFD700" : "none"} stroke={interactionModal.type === 'saves' ? "#FFD700" : "#65676b"} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
 <span style={{ fontSize: '15px', fontWeight: 'bold', color: interactionModal.type === 'saves' ? '#FFD700' : '#65676b' }}>
 {posts.find(p => p.id === interactionModal.postId)?.saves || 0}
 </span>
 </div>
 <div style={{ width: '100%', height: '3px', background: interactionModal.type === 'saves' ? '#FFD700' : 'transparent', marginTop: '6px', borderRadius: '2px' }}></div>
 </div>
 </div>

 <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
 {interactionLoading ? <div style={{ textAlign: 'center', padding: '20px' }}>ກຳລັງໂຫຼດ...</div> :
 interactionUsers.length > 0 ? interactionUsers.map((u, i) => (
 <div key={i} style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
 <img src={u.avatar_url} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
 <div style={{ fontWeight: '600', color: u.username === 'User' ? '#888' : '#000' }}>{u.username}</div>
 </div>
 )) : <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>ບໍ່ມີລາຍຊື່</div>
 }
 </div>
 </div>
 </div>
 )}

 {/* Loading Indicator */}
 {loadingMore && (
 <div style={{ padding: '20px', textAlign: 'center', color: '#65676b', fontSize: '14px' }}>
 ກຳລັງໂຫຼດ...
 </div>
 )}

 {/* Modal ยอมรับเงื่อนไข */}
 {showTermsModal && (
 <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
 <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '350px', padding: '30px 20px', position: 'relative', textAlign: 'center' }}>
 <button onClick={() => setShowTermsModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#65676b' }}>✕</button>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '40px 0 30px 0' }}>
 <input type="checkbox" id="modal-terms" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
 <label htmlFor="modal-terms" style={{ fontSize: '15px', color: '#000', cursor: 'pointer' }}>ຍອມຮັບ <Link href="/terms" style={{ color: '#1877f2', textDecoration: 'none', fontWeight: 'bold' }}>ຂໍ້ກຳນົດແລະນະໂຍບາຍ</Link></label>
 </div>
 <button onClick={() => { if(acceptedTerms) { setShowTermsModal(false); hiddenFileInputRef.current?.click(); } }} disabled={!acceptedTerms} style={{ width: '120px', padding: '12px', background: acceptedTerms ? '#1877f2' : '#e4e6eb', color: acceptedTerms ? '#fff' : '#999', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: acceptedTerms ? 'pointer' : 'not-allowed', transition: '0.3s' }}>ຕໍ່ໄປ</button>
 </div>
 </div>
 )}

 {/* Modal รายงาน */}
 {reportingPost && (
 <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
 <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '20px' }}>
 <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', textAlign: 'center' }}>ລາຍງານໂພສ</h3>
 <p style={{ fontSize: '14px', color: '#65676b', marginBottom: '10px' }}>ກະລຸນาລະບุສາເຫດ:</p>
 <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="ພິມລາຍລະອຽດ..." style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', marginBottom: '20px', outline: 'none' }} />
 <div style={{ display: 'flex', gap: '10px' }}>
 <button onClick={() => setReportingPost(null)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background: '#f0f2f5', fontWeight: 'bold' }}>ຍົກເລີກ</button>
 <button onClick={submitReport} disabled={isSubmittingReport} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: '#1877f2', color: '#fff', fontWeight: 'bold', opacity: isSubmittingReport ? 0.6 : 1 }}>{isSubmittingReport ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງລາຍງານ'}</button>
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
 <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{viewingPost.profiles?.avatar_url ? (<img src={viewingPost.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (<svg width="22" height="22" viewBox="0 0 24 24" fill="#65676b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>)}</div>
 <div>
 <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>{viewingPost.profiles?.username || 'User'}{status.isOnline ? (<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div><span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span></div>) : (status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>)}</div>
 <div style={{ fontSize: '12px', color: '#65676b', lineHeight: '16px' }}>{viewingPost.is_boosted ? (<span style={{ display: 'inline-flex', alignItems: 'center' }}><span style={{ fontWeight: 'bold', color: '#65676b' }}>• Ad</span> <span style={{ marginLeft: '4px' }}>{formatTime(viewingPost.created_at)}</span><span style={{ margin: '0 4px' }}>•</span>{viewingPost.province}</span>) : (<>{formatTime(viewingPost.created_at)} · {viewingPost.province}</>)}</div>
 </div>
 </div>
 <button onClick={() => setViewingPost(null)} style={{ background: '#f0f2f5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
 </div>
 <div style={{ padding: '15px' }}><div style={{ color: '#000', fontSize: '16px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{viewingPost.caption}</div></div>
 {viewingPost.images.map((img: string, idx: number) => (<div key={idx} style={{ position: 'relative', background: '#fff', marginBottom: '24px' }}><div style={{ width: '100%', overflow: 'hidden' }}><img src={img} onClick={() => { setFullScreenImages(viewingPost.images); setCurrentImgIndex(idx); }} style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }} /></div></div>))}
 <div style={{ height: '80px' }}></div>
 </div>
 </div>
 )})()}

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
