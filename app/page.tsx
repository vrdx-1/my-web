'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';

let _fullScreenTouchY: number | null = null;

function HomeContent() {
 const router = useRouter();
const searchParams = useSearchParams();
const pathname = usePathname(); 
 const [posts, setPosts] = useState<any[]>([]);
 const [searchTerm, setSearchTerm] = useState('');
 const [session, setSession] = useState<any>(null);
 const [userProfile, setUserProfile] = useState<any>(null);
 const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
 const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});
 const [viewingPost, setViewingPost] = useState<any | null>(null);
 const [isViewingModeOpen, setIsViewingModeOpen] = useState(false);
 const [viewingModeDragOffset, setViewingModeDragOffset] = useState(0);
 const [viewingModeIsDragging, setViewingModeIsDragging] = useState(false);
 const [initialImageIndex, setInitialImageIndex] = useState(0);
 const [viewingModeTouchStart, setViewingModeTouchStart] = useState<{ x: number, y: number } | null>(null);
 const [savedScrollPosition, setSavedScrollPosition] = useState<number>(0);
 const [activeMenuState, setActiveMenu] = useState<string | null>(null);
 const [isMenuAnimating, setIsMenuAnimating] = useState(false);
 const [myGuestPosts, setMyGuestPosts] = useState<{ post_id: string, token: string }[]>([]);
 const [lastScrollY, setLastScrollY] = useState(0);
 const [isHeaderVisible, setIsHeaderVisible] = useState(true);

 const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
 const [currentImgIndex, setCurrentImgIndex] = useState(0);
 const [touchStart, setTouchStart] = useState<number | null>(null);
 const [activePhotoMenu, setActivePhotoMenu] = useState<number | null>(null);
 const [isPhotoMenuAnimating, setIsPhotoMenuAnimating] = useState(false);
 const [fullScreenDragOffset, setFullScreenDragOffset] = useState(0);
 const [fullScreenVerticalDragOffset, setFullScreenVerticalDragOffset] = useState(0);
 const [fullScreenIsDragging, setFullScreenIsDragging] = useState(false);
 const [fullScreenTransitionDuration, setFullScreenTransitionDuration] = useState(200);
 const [fullScreenShowDetails, setFullScreenShowDetails] = useState(true);
 const [fullScreenZoomScale, setFullScreenZoomScale] = useState(1);
 const [fullScreenZoomOrigin, setFullScreenZoomOrigin] = useState<string>('50% 50%');
 const [showImageForDownload, setShowImageForDownload] = useState<string | null>(null);
 const [showDownloadBottomSheet, setShowDownloadBottomSheet] = useState(false);
 const [isDownloadBottomSheetAnimating, setIsDownloadBottomSheetAnimating] = useState(false);

 // --- State สำหรับ Pop-up เงื่อนไข ---
 const [showTermsModal, setShowTermsModal] = useState(false);
 const [acceptedTerms, setAcceptedTerms] = useState(false);

 // --- ส่วนที่เพิ่มใหม่สำหรับ Pagination & Infinite Scroll ---
 const [page, setPage] = useState(0);
 const [hasMore, setHasMore] = useState(true);
 const [loadingMore, setLoadingMore] = useState(false);
const PAGE_SIZE = 12; 
const PREFETCH_COUNT = 10; 
 const observer = useRef<IntersectionObserver | null>(null);

// --- การจัดการแผง Interaction (BottomSheet) ---
 const [interactionModal, setInteractionModal] = useState<{ show: boolean, type: 'likes' | 'saves', postId: string | null }>({ show: false, type: 'likes', postId: null });
 const [interactionUsers, setInteractionUsers] = useState<any[]>([]);
 const [isInteractionModalAnimating, setIsInteractionModalAnimating] = useState(false);
 const [interactionLoading, setInteractionLoading] = useState(false);
 const [interactionSheetMode, setInteractionSheetMode] = useState<'half' | 'full' | 'hidden'>('hidden');

 const hiddenFileInputRef = useRef<HTMLInputElement>(null);
 const menuButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
 const photoMenuButtonRef = useRef<HTMLButtonElement | null>(null);
 const fullScreenTouchStartTimeRef = useRef<number>(0);
 const fullScreenTouchStartYRef = useRef<number>(0);
 const fullScreenLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const fullScreenLastTapTimeRef = useRef<number>(0);
 const fullScreenLastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
 const fullScreenDoubleTapHandledRef = useRef<boolean>(false);
 const fullScreenPinchStartRef = useRef<number>(0);
 const fullScreenPinchScaleStartRef = useRef<number>(1);
 const fullScreenPinchingRef = useRef<boolean>(false);
 const fullScreenLastClickTimeRef = useRef<number>(0);
 const fullScreenLastClickPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
 const fullScreenImageContainerRef = useRef<HTMLDivElement | null>(null);

 const lastPostElementRef = useCallback((node: any) => {
 if (loadingMore || !hasMore) return; 
 if (observer.current) observer.current.disconnect();
 observer.current = new IntersectionObserver(entries => {
 if (entries[0].isIntersecting && hasMore) {
 setPage(prevPage => prevPage + 1);
 }
}, { threshold: 0.1 });
 if (node) observer.current.observe(node);
 }, [loadingMore, hasMore]);

 const [reportingPost, setReportingPost] = useState<any | null>(null);
 const [reportReason, setReportReason] = useState('');
 const [isSubmittingReport, setIsSubmittingReport] = useState(false);

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

 const fetchPosts = async (isInitial = false) => {
if (loadingMore) return;
 setLoadingMore(true);
const startIndex = isInitial ? 0 : page * PAGE_SIZE;
const endIndex = startIndex + PREFETCH_COUNT - 1;

let postIds: string[] = [];

// ดึงข้อมูลเฉพาะสถานะ recommend เท่านั้น (ตัดเงื่อนไข tab === 'sold' ออก)
const { data, error } = await supabase
 .from('cars')
.select('id')
.eq('status', 'recommend')
 .eq('is_hidden', false)
.order('is_boosted', { ascending: false })
 .order('created_at', { ascending: false })
.range(startIndex, endIndex);

if (!error && data) {
postIds = data.map(p => p.id);
}

setHasMore(postIds.length === PREFETCH_COUNT);

 if (isInitial) {
setPosts([]); 
}

for (let i = 0; i < postIds.length; i++) {
const postId = postIds[i];
const { data: postData, error: postError } = await supabase
.from('cars')
.select('*, profiles!cars_user_id_fkey(*)')
.eq('id', postId)
.single();

if (!postError && postData) {
 setPosts(prev => {
 const existingIds = new Set(prev.map(p => p.id));
if (!existingIds.has(postData.id)) {
return [...prev, postData];
}
return prev;
});
}
}
 setLoadingMore(false);
 };

 useEffect(() => {
 router.prefetch('/profile');
 }, [router]);

 useEffect(() => {
 setPage(0);
 setHasMore(true);
 fetchPosts(true);
 if (searchTerm) {
 localStorage.setItem('last_searched_province', searchTerm);
 }
}, [searchTerm]);

 useEffect(() => {
 if (page > 0) {
 fetchPosts();
 }
 }, [page]);

// ปิดเมนูไข่ปลาเมื่อเลื่อนหน้าจอ
useEffect(() => {
const handleScroll = () => {
if (activeMenuState) {
setIsMenuAnimating(true);
setTimeout(() => {
setActiveMenu(null);
setIsMenuAnimating(false);
}, 300);
}
};
window.addEventListener('scroll', handleScroll);
return () => window.removeEventListener('scroll', handleScroll);
}, [activeMenuState]);

// ปิดเมนูไข่ปลาเมื่อคลิกที่อื่น
useEffect(() => {
if (!activeMenuState) return;
const handleClickOutside = (e: MouseEvent | TouchEvent) => {
const target = (e.target || (e as TouchEvent).touches?.[0]?.target) as HTMLElement;
if (!target) return;
// ตรวจสอบว่า element ที่คลิกอยู่นอกเมนูและไม่ใช่ปุ่มไข่ปลาหรือไม่
if (!target.closest('[data-menu-container]') && !target.closest('[data-menu-button]')) {
setIsMenuAnimating(true);
setTimeout(() => {
setActiveMenu(null);
setIsMenuAnimating(false);
}, 300);
}
};
document.addEventListener('mousedown', handleClickOutside as EventListener);
document.addEventListener('touchstart', handleClickOutside as EventListener);
return () => {
document.removeEventListener('mousedown', handleClickOutside as EventListener);
document.removeEventListener('touchstart', handleClickOutside as EventListener);
};
}, [activeMenuState]);

useEffect(() => {
if (!viewingPost) {
setIsViewingModeOpen(false);
setViewingModeDragOffset(0);
setViewingModeIsDragging(false);
document.body.style.overflow = '';
setTimeout(() => {
window.scrollTo(0, savedScrollPosition);
}, 100);
} else if (viewingPost.images) {
document.body.style.overflow = 'hidden';
setViewingModeDragOffset(0);
setViewingModeIsDragging(false);
setTimeout(() => {
const imageElement = document.getElementById(`viewing-image-${initialImageIndex}`);
const container = document.getElementById('viewing-mode-container');
if (imageElement && container) {
const headerHeight = 60;
const imageTop = imageElement.offsetTop - headerHeight;
container.scrollTop = imageTop;
setTimeout(() => {
setIsViewingModeOpen(true);
}, 50);
} else {
setIsViewingModeOpen(true);
}
}, 10);
}
return () => {
if (!viewingPost) {
document.body.style.overflow = '';
}
};
}, [viewingPost, initialImageIndex, savedScrollPosition]);

useEffect(() => {
if (fullScreenImages) {
setFullScreenDragOffset(0);
setFullScreenVerticalDragOffset(0);
setFullScreenZoomScale(1);
setFullScreenZoomOrigin('50% 50%');
setFullScreenIsDragging(false);
setFullScreenTransitionDuration(200);
setFullScreenShowDetails(true);
fullScreenTouchStartYRef.current = 0;
}
}, [fullScreenImages]);

useEffect(() => {
if (interactionModal.show) {
document.body.style.overflow = 'hidden';
} else {
document.body.style.overflow = '';
}
return () => {
document.body.style.overflow = '';
};
}, [interactionModal.show]);

useEffect(() => {
const postId = searchParams.get('post');
if (postId && posts.length > 0) {
const sharedPost = posts.find(p => p.id === postId);
if (sharedPost) {
setInitialImageIndex(0);
setIsViewingModeOpen(false);
setViewingPost(sharedPost);
router.replace(window.location.pathname, { scroll: false });
}
} else if (postId && posts.length === 0) {
const checkPost = async () => {
const { data } = await supabase
.from('cars')
.select('*, profiles!cars_user_id_fkey(*)')
.eq('id', postId)
.single();
if (data) {
setInitialImageIndex(0);
setIsViewingModeOpen(false);
setViewingPost(data);
router.replace(window.location.pathname, { scroll: false });
}
};
checkPost();
}
}, [searchParams, posts, router]);

 const fetchSavedStatus = async (userIdOrToken: string) => {
 const table = session ? 'post_saves' : 'post_saves_guest';
 const column = session ? 'user_id' : 'guest_token';
const { data } = await supabase.from(table).select('post_id').eq(column, userIdOrToken);
 if (data) {
 const savedMap: { [key: string]: boolean } = {};
 data.forEach(item => savedMap[item.post_id] = true);
 setSavedPosts(savedMap);
 }
 };

 const fetchLikedStatus = async (userIdOrToken: string) => {
 const table = session ? 'post_likes' : 'post_likes_guest';
 const column = session ? 'user_id' : 'guest_token';
const { data } = await supabase.from(table).select('post_id').eq(column, userIdOrToken);
 if (data) {
 const likedMap: { [key: string]: boolean } = {};
 data.forEach(item => likedMap[item.post_id] = true);
 setLikedPosts(likedMap);
 }
 };

 const fetchInteractions = async (type: 'likes' | 'saves', postId: string) => {
 setInteractionLoading(true);
 setInteractionModal({ show: true, type, postId });
setInteractionSheetMode('half');
setIsInteractionModalAnimating(true);
requestAnimationFrame(() => {
 requestAnimationFrame(() => {
  setIsInteractionModalAnimating(false);
 });
}); 
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
 const handleScroll = () => {
 const currentScrollY = window.scrollY;
 const scrollDelta = Math.abs(currentScrollY - lastScrollY);
 
 if (currentScrollY < 10) {
 setIsHeaderVisible(true);
 } else if (currentScrollY > lastScrollY && currentScrollY > 80 && scrollDelta > 5) {
 setIsHeaderVisible(false);
 } else if (currentScrollY < lastScrollY && scrollDelta > 5) {
 setIsHeaderVisible(true);
 }
 setLastScrollY(currentScrollY);
 };
 window.addEventListener('scroll', handleScroll, { passive: true });
 return () => window.removeEventListener('scroll', handleScroll);
 }, [lastScrollY]);

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
}, [session]);

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
 const diffInWeeks = Math.floor(diffInDays / 7);
if (diffInWeeks < 4) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInWeeks} ອາທິດທີ່ແລ້ວ` };
 const diffInMonths = Math.floor(diffInDays / 30);
if (diffInMonths < 12) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInMonths} ເດືອນທີ່ແລ້ວ` };
const diffInYears = Math.floor(diffInDays / 365);
return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInYears} ປີທີ່ແລ້ວ` };
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
const diffInYears = Math.floor(diffInDays / 365);
if (diffInYears >= 1) return `${diffInYears} ປີທີ່ແລ້ວ`;
 return new Date(dateString).toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' });
 };

 const isPostOwner = (post: any) => {
 if (session && String(post.user_id) === String(session.user.id)) return true;
 try {
 const stored = JSON.parse(localStorage.getItem('my_guest_posts') || '[]');
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
 
 setLikedPosts(prev => ({ ...prev, [postId]: !isCurrentlyLiked }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikesCount } : p));

if (!isCurrentlyLiked) {
setJustLikedPosts(prev => ({ ...prev, [postId]: true }));
setTimeout(() => setJustLikedPosts(prev => {
const newState = { ...prev };
delete newState[postId];
return newState;
}), 300);
}

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

 setSavedPosts(prev => ({ ...prev, [postId]: !isCurrentlySaved }));
 setPosts(prev => prev.map(p => p.id === postId ? { ...p, saves: newSavesCount } : p));

if (!isCurrentlySaved) {
setJustSavedPosts(prev => ({ ...prev, [postId]: true }));
setTimeout(() => setJustSavedPosts(prev => {
const newState = { ...prev };
delete newState[postId];
return newState;
}), 300);
}

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

 const handleViewPost = async (post: any, imageIndex: number = 0) => {
 setSavedScrollPosition(window.scrollY);
 setInitialImageIndex(imageIndex);
 setIsViewingModeOpen(false);
 setViewingPost(post);
 const { error } = await supabase.rpc('increment_views', { post_id: post.id });
 if (error) {
 await supabase.from('cars').update({ views: (post.views || 0) + 1 }).eq('id', post.id);
 }
 setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: (p.views || 0) + 1 } : p));
 };

 const handleViewingModeTouchStart = (e: React.TouchEvent) => {
 setViewingModeTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
 setViewingModeIsDragging(true);
 setViewingModeDragOffset(0);
 };

 const handleViewingModeTouchMove = (e: React.TouchEvent) => {
 if (!viewingModeTouchStart) return;
 const clientX = e.touches[0].clientX;
 const deltaX = clientX - viewingModeTouchStart.x;
 const maxDrag = typeof window !== 'undefined' ? window.innerWidth : 600;
 if (deltaX > 0) {
 const dragOffset = Math.min(maxDrag, deltaX);
 setViewingModeDragOffset(dragOffset);
 }
 };

 const handleViewingModeTouchEnd = (e: React.TouchEvent) => {
 if (!viewingModeTouchStart) return;
 const diffX = e.changedTouches[0].clientX - viewingModeTouchStart.x;
 const diffY = Math.abs(viewingModeTouchStart.y - e.changedTouches[0].clientY);
 const absDiffX = Math.abs(diffX);
 const container = document.getElementById('viewing-mode-container');
 const isAtBottom = container && container.scrollHeight - container.scrollTop <= container.clientHeight + 10;
 const isAtTop = container && container.scrollTop <= 10;
 
 const isHorizontalSwipe = absDiffX > diffY * 1.5;
 const isStrongHorizontalSwipe = diffX > 100 && isHorizontalSwipe;
 const isAtBottomAndSwipeDown = isAtBottom && diffY > 50 && diffY > absDiffX * 1.5;
 const isScrolling = !isAtTop && !isAtBottom && diffY > 30;
 
 if ((isStrongHorizontalSwipe || isAtBottomAndSwipeDown) && !isScrolling) {
 setViewingModeIsDragging(false);
 setViewingModeDragOffset(window.innerWidth);
 setTimeout(() => {
 setIsViewingModeOpen(false);
 setIsHeaderVisible(true);
 setViewingModeDragOffset(0);
 setTimeout(() => { setViewingPost(null); window.scrollTo(0, savedScrollPosition); }, 50);
 }, 300);
 } else if (Math.abs(viewingModeDragOffset) > 20) {
 setViewingModeDragOffset(0);
 setViewingModeIsDragging(false);
 }
 setViewingModeTouchStart(null);
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
alert("ລຶບໂພສສຳເລັດແລ້ວ");
 } else {
alert("ເກີດຂໍ້ຜິດພາດ: " + error.message);
 }
 };

 const handleReport = (post: any) => {
 if (!session) {
 alert("ກະລຸນາລົງທະບຽນກ່ອນ");
 return;
 }
 setReportingPost(post);
 };

 const submitReport = async () => {
 if (!reportReason.trim()) {
alert("ກະລຸນາລະບຸສາເຫດການລາຍງານ");
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

 const handleShare = async (post: any) => {
const shareUrl = `${window.location.origin}${window.location.pathname}?post=${post.id}`;
const shareData = { title: 'Car Post', text: post.caption, url: shareUrl };
 try {
 if (navigator.share) {
 await navigator.share(shareData);
 const isUser = !!session;
 const userId = isUser ? session.user.id : getPrimaryGuestToken();
 const table = isUser ? 'post_shares' : 'post_shares_guest';
 const column = isUser ? 'user_id' : 'guest_token';
 await supabase.from(table).insert([{ [column]: userId, post_id: post.id }]);
 await supabase.from('cars').update({ shares: (post.shares || 0) + 1 }).eq('id', post.id);
 setPosts(prev => prev.map(p => p.id === post.id ? { ...p, shares: (p.shares || 0) + 1 } : p));
} else { 
navigator.clipboard.writeText(shareUrl); 
alert("ຄັດລອກລິ້ງສຳເລັດແລ້ວ!"); 
 }
 } catch (err) { console.log('User cancelled share'); }
 };

 const downloadImage = async (url: string) => {
 try {
 // ตรวจสอบว่าเป็นมือถือหรือไม่
 const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
 
 if (isMobile) {
 // สำหรับมือถือ: แสดงรูปใน overlay เพื่อให้ผู้ใช้สามารถ long-press เพื่อบันทึกได้
 setShowImageForDownload(url);
 setActivePhotoMenu(null);
 } else {
 // สำหรับเดสก์ท็อป: ใช้วิธีเดิม
 const res = await fetch(url);
 const blob = await res.blob();
 const fileName = `car-image-${Date.now()}.jpg`;
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = fileName;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 setTimeout(() => URL.revokeObjectURL(link.href), 100);
 setActivePhotoMenu(null);
 }
 } catch (err) { 
 alert("ບໍ່ສາມາດບັນທຶກຮູບໄດ້ในขณะนี้"); 
 }
 };

 const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
 const onTouchEnd = (e: React.TouchEvent) => {
 if (touchStart === null) return;
 const diff = touchStart - e.changedTouches[0].clientX;
 if (diff > 40 && currentImgIndex < (fullScreenImages?.length || 0) - 1) setCurrentImgIndex(prev => prev + 1);
 else if (diff < -40 && currentImgIndex > 0) setCurrentImgIndex(prev => prev - 1);
 setTouchStart(null);
 };

 const fullScreenOnTouchStart = (e: React.TouchEvent) => {
 onTouchStart(e);
 _fullScreenTouchY = e.touches[0].clientY;
 fullScreenTouchStartYRef.current = e.touches[0].clientY;
 fullScreenTouchStartTimeRef.current = Date.now();
 setFullScreenIsDragging(true);
 setFullScreenDragOffset(0);
 setFullScreenVerticalDragOffset(0);
 setFullScreenTransitionDuration(0);
 fullScreenDoubleTapHandledRef.current = false;

 const t = (e.target as HTMLElement);
 if (!t.closest('button') && !t.closest('[data-menu-container]') && !t.closest('[data-menu-button]')) {
 if (e.touches.length >= 2) {
 fullScreenPinchingRef.current = true;
 const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
 fullScreenPinchStartRef.current = d;
 fullScreenPinchScaleStartRef.current = fullScreenZoomScale;
 if (fullScreenLongPressTimerRef.current) {
 clearTimeout(fullScreenLongPressTimerRef.current);
 fullScreenLongPressTimerRef.current = null;
 }
 } else {
 fullScreenPinchingRef.current = false;
 fullScreenLongPressTimerRef.current = setTimeout(() => {
 setShowDownloadBottomSheet(true);
 setIsDownloadBottomSheetAnimating(true);
 requestAnimationFrame(() => {
 requestAnimationFrame(() => setIsDownloadBottomSheetAnimating(false));
 });
 }, 500);
 }
 }
 };

 const fullScreenOnTouchMove = (e: React.TouchEvent) => {
 if (fullScreenLongPressTimerRef.current) {
 clearTimeout(fullScreenLongPressTimerRef.current);
 fullScreenLongPressTimerRef.current = null;
 }
 if (e.touches.length >= 2 && fullScreenPinchingRef.current) {
 const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
 const start = fullScreenPinchStartRef.current || 1;
 const s = fullScreenPinchScaleStartRef.current * (d / start);
 const scale = Math.max(1, Math.min(4, s));
 setFullScreenZoomScale(scale);
 return;
 }
 if (touchStart === null || fullScreenTouchStartYRef.current === 0) return;
 const n = fullScreenImages?.length ?? 0;
 if (n === 0) return;
 const clientX = e.touches[0].clientX;
 const clientY = e.touches[0].clientY;
 
 const deltaX = touchStart - clientX;
 const deltaY = fullScreenTouchStartYRef.current - clientY;
 const absX = Math.abs(deltaX);
 const absY = Math.abs(deltaY);
 
 if (absY > absX) {
 let verticalDelta = deltaY;
 const maxVerticalDrag = typeof window !== 'undefined' ? window.innerHeight * 0.6 : 500;
 verticalDelta = Math.max(-maxVerticalDrag, Math.min(maxVerticalDrag, verticalDelta));
 setFullScreenVerticalDragOffset(verticalDelta);
 setFullScreenDragOffset(0);
 } else {
 let horizontalDelta = deltaX;
 const maxDrag = typeof window !== 'undefined' ? window.innerWidth * 0.85 : 400;
 if (currentImgIndex === 0) horizontalDelta = Math.min(0, horizontalDelta);
 else if (currentImgIndex === n - 1) horizontalDelta = Math.max(0, horizontalDelta);
 else horizontalDelta = Math.max(-maxDrag, Math.min(maxDrag, horizontalDelta));
 setFullScreenDragOffset(horizontalDelta);
 setFullScreenVerticalDragOffset(0);
 }
 };

 const fullScreenOnTouchEnd = (e: React.TouchEvent) => {
 if (fullScreenLongPressTimerRef.current) {
 clearTimeout(fullScreenLongPressTimerRef.current);
 fullScreenLongPressTimerRef.current = null;
 }
 const wasPinching = fullScreenPinchingRef.current;
 fullScreenPinchingRef.current = false;
 const startY = fullScreenTouchStartYRef.current;

 const t = (e.target as HTMLElement);
 if (!t.closest?.('[data-menu-button]') && !t.closest?.('[data-menu-container]')) {
 if (activePhotoMenu !== null) {
 setIsPhotoMenuAnimating(true);
 setTimeout(() => { setActivePhotoMenu(null); setIsPhotoMenuAnimating(false); }, 300);
 }
 if (_fullScreenTouchY != null && fullScreenTouchStartYRef.current !== 0) {
 const ey = e.changedTouches[0].clientY;
 const dy = Math.abs(ey - _fullScreenTouchY);
 const dx = touchStart != null ? Math.abs(touchStart - e.changedTouches[0].clientX) : 0;
 const verticalDelta = fullScreenTouchStartYRef.current - ey;
 
	if (dy > 40 && dy > dx) {
	setFullScreenIsDragging(false);
	setFullScreenTransitionDuration(350);
	setFullScreenVerticalDragOffset(verticalDelta > 0 ? window.innerHeight : -window.innerHeight);
	setFullScreenZoomScale(1);
	setTimeout(() => {
	setFullScreenDragOffset(0);
	setFullScreenVerticalDragOffset(0);
	setFullScreenImages(null);
	setTouchStart(null);
	_fullScreenTouchY = null;
	fullScreenTouchStartYRef.current = 0;
	}, 350);
	return;
 } else if (Math.abs(fullScreenVerticalDragOffset) > 20) {
 setFullScreenVerticalDragOffset(0);
 setFullScreenIsDragging(false);
 setFullScreenTransitionDuration(250);
 setTouchStart(null);
 _fullScreenTouchY = null;
 fullScreenTouchStartYRef.current = 0;
 return;
 }
 }
 }
 _fullScreenTouchY = null;
 fullScreenTouchStartYRef.current = 0;

 if (touchStart === null) { setTouchStart(null); return; }
 const n = fullScreenImages?.length ?? 0;
 if (n === 0) { setTouchStart(null); return; }
 const endX = e.changedTouches[0].clientX;
 const endY = e.changedTouches[0].clientY;
 const endTime = Date.now();
 const elapsed = Math.max(1, endTime - fullScreenTouchStartTimeRef.current);
 const velocity = (touchStart - endX) / elapsed;
 const diff = touchStart - endX;
 const moveX = Math.abs(diff);
 const moveY = Math.abs(endY - startY);
 const fast = Math.abs(velocity) > 0.5;
 const dur = fast ? 120 : 200;

 if (diff > 40 || (velocity > 0.35 && diff > 15)) {
 if (currentImgIndex < n - 1) {
 setCurrentImgIndex((i) => i + 1);
 setFullScreenDragOffset(0);
 setFullScreenVerticalDragOffset(0);
 setFullScreenZoomScale(1);
 setFullScreenIsDragging(false);
 setFullScreenTransitionDuration(dur);
 }
 else {
 setFullScreenDragOffset(0);
 setFullScreenVerticalDragOffset(0);
 setFullScreenIsDragging(false);
 setFullScreenTransitionDuration(200);
 }
 } else if (diff < -40 || (velocity < -0.35 && diff < -15)) {
 if (currentImgIndex > 0) {
 setCurrentImgIndex((i) => i - 1);
 setFullScreenDragOffset(0);
 setFullScreenVerticalDragOffset(0);
 setFullScreenZoomScale(1);
 setFullScreenIsDragging(false);
 setFullScreenTransitionDuration(dur);
 }
 else {
 setFullScreenDragOffset(0);
 setFullScreenVerticalDragOffset(0);
 setFullScreenIsDragging(false);
 setFullScreenTransitionDuration(200);
 }
 } else {
 setFullScreenDragOffset(0);
 setFullScreenVerticalDragOffset(0);
 setFullScreenIsDragging(false);
 setFullScreenTransitionDuration(200);

 if (!wasPinching && moveX < 15 && moveY < 15) {
 const now = endTime;
 const last = fullScreenLastTapTimeRef.current;
 const lastPos = fullScreenLastTapPosRef.current;
 const near = Math.abs(endX - lastPos.x) < 50 && Math.abs(endY - lastPos.y) < 50;
 if (now - last < 350 && near) {
 fullScreenDoubleTapHandledRef.current = true;
 const container = fullScreenImageContainerRef.current;
 if (container) {
 const rect = container.getBoundingClientRect();
 const x = ((endX - rect.left) / rect.width) * 100;
 const y = ((endY - rect.top) / rect.height) * 100;
 setFullScreenZoomOrigin(`${x}% ${y}%`);
 }
 setFullScreenZoomScale((z) => (z > 1 ? 1 : 2));
 fullScreenLastTapTimeRef.current = 0;
 } else {
 fullScreenLastTapTimeRef.current = now;
 fullScreenLastTapPosRef.current = { x: endX, y: endY };
 }
 }
 }
 setTouchStart(null);
 };

 const fullScreenOnClick = (e: React.MouseEvent) => {
 const t = (e.target as HTMLElement);
 if (t.closest('button') || t.closest('[data-menu-container]') || t.closest('[data-menu-button]')) return;
 if (fullScreenDoubleTapHandledRef.current) {
 fullScreenDoubleTapHandledRef.current = false;
 return;
 }
 if (activePhotoMenu !== null) {
 setIsPhotoMenuAnimating(true);
 setTimeout(() => { setActivePhotoMenu(null); setIsPhotoMenuAnimating(false); }, 300);
 return;
 }
 const now = Date.now();
 const x = e.clientX;
 const y = e.clientY;
 const last = fullScreenLastClickTimeRef.current;
 const lastPos = fullScreenLastClickPosRef.current;
 const near = Math.abs(x - lastPos.x) < 50 && Math.abs(y - lastPos.y) < 50;
 if (now - last < 350 && near) {
 const container = fullScreenImageContainerRef.current;
 if (container) {
 const rect = container.getBoundingClientRect();
 const xPercent = ((x - rect.left) / rect.width) * 100;
 const yPercent = ((y - rect.top) / rect.height) * 100;
 setFullScreenZoomOrigin(`${xPercent}% ${yPercent}%`);
 }
 setFullScreenZoomScale((z) => (z > 1 ? 1 : 2));
 fullScreenLastClickTimeRef.current = 0;
 return;
 }
 fullScreenLastClickTimeRef.current = now;
 fullScreenLastClickPosRef.current = { x, y };
 setFullScreenShowDetails((prev) => !prev);
 };

 const PhotoGrid = ({ images, onPostClick }: { images: string[], onPostClick: (imageIndex: number) => void }) => {
 const count = images.length;
 if (count === 0) return null;
 if (count === 1) return <img src={images[0]} onClick={() => onPostClick(0)} style={{ width: '100%', cursor: 'pointer', display: 'block', objectFit: 'cover', objectPosition: 'center', height: '400px' }} />;
 if (count === 2) return (
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', cursor: 'pointer' }}>
 <img src={images[0]} onClick={() => onPostClick(0)} style={{ width: '100%', height: '300px', objectFit: 'cover', objectPosition: 'center', background: '#f0f0f0' }} />
 <img src={images[1]} onClick={() => onPostClick(1)} style={{ width: '100%', height: '300px', objectFit: 'cover', objectPosition: 'center', background: '#f0f0f0' }} />
 </div>
 );
 if (count === 3) return (
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', cursor: 'pointer' }}>
 <img src={images[0]} onClick={() => onPostClick(0)} style={{ width: '100%', height: '400px', objectFit: 'cover', objectPosition: 'center', background: '#f0f0f0', gridRow: 'span 2' }} />
<div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '4px' }}>
 <img src={images[1]} onClick={() => onPostClick(1)} style={{ width: '100%', height: '199px', objectFit: 'cover', objectPosition: 'center', background: '#f0f0f0' }} />
 <img src={images[2]} onClick={() => onPostClick(2)} style={{ width: '100%', height: '199px', objectFit: 'cover', objectPosition: 'center', background: '#f0f0f0' }} />
 </div>
 </div>
 );
 return (
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', cursor: 'pointer' }}>
 {images.slice(0, 2).map((img, i) => (
 <div key={i} style={{ position: 'relative', aspectRatio: '1', background: '#f0f0f0', overflow: 'hidden' }}>
 <img src={img} onClick={() => onPostClick(i)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
 </div>
 ))}
 <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
 {images.slice(2, 5).map((img, i) => (
 <div key={i + 2} style={{ position: 'relative', aspectRatio: '1', background: '#f0f0f0', cursor: 'pointer', overflow: 'hidden' }} onClick={() => onPostClick(i + 2)}>
 <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', pointerEvents: 'none' }} />
 {i === 2 && count > 5 && (
<div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', color: '#fff', WebkitTextStroke: '3px #000', paintOrder: 'stroke fill', pointerEvents: 'none' }}>
+{count - 5}
</div>
 )}
 </div>
 ))}
 </div>
 </div>
 );
 };

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files && e.target.files.length > 0) {
 const filesArray = Array.from(e.target.files);
 const previewUrls = filesArray.map(file => URL.createObjectURL(file));
 sessionStorage.setItem('pending_images', JSON.stringify(previewUrls));
 router.push('/create-post');
 }
 };

 const handleCreatePostClick = () => {
 if (session) {
 hiddenFileInputRef.current?.click();
 } else {
 setShowTermsModal(true);
 }
 };

const onSheetTouchStart = (e: React.TouchEvent) => setStartY(e.touches[0].clientY);
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
 setIsInteractionModalAnimating(true);
 setTimeout(() => {
 setInteractionSheetMode('hidden');
 setInteractionModal({ ...interactionModal, show: false });
 setIsInteractionModalAnimating(false);
 }, 300);
 }
 }
 setCurrentY(0);
 };

 return (
 <main style={{ width: '100%', margin: '0', background: '#fff', minHeight: '100vh', fontFamily: 'sans-serif', position: 'relative' }}>
 <style>{`
 @keyframes heartBeat { 0% { transform: scale(1); } 25% { transform: scale(1.3); } 50% { transform: scale(1); } 75% { transform: scale(1.3); } 100% { transform: scale(1); } }
 @keyframes popOnce { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }
@keyframes fadeColor { 0%, 100% { background: #f0f0f0; } 12.5% { background: #1a1a1a; } 25% { background: #4a4a4a; } 37.5% { background: #6a6a6a; } 50% { background: #8a8a8a; } 62.5% { background: #b0b0b0; } 75% { background: #d0d0d0; } 87.5% { background: #e5e5e5; } }
 .animate-heart { animation: heartBeat 0.4s linear; }
 .animate-pop { animation: popOnce 0.3s ease-out; }
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
 /* ซ่อน scrollbar แต่ยังคงสามารถเลื่อนได้ */
 * { scrollbar-width: none; -ms-overflow-style: none; }
 *::-webkit-scrollbar { display: none; }
 `}</style>

<input type="file" ref={hiddenFileInputRef} multiple accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

<div style={{ position: 'fixed', top: 0, left: 0, transform: `translateY(${isHeaderVisible ? '0' : '-100%'})`, width: '100%', background: '#fff', zIndex: 100, transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: isHeaderVisible ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
 <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f0f0f0' }}>
 <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f0f2f5', borderRadius: '20px', padding: '10px 18px' }}>
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', flexShrink: 0 }}>
<circle cx="11" cy="11" r="8"></circle>
<path d="m21 21-4.35-4.35"></path>
</svg>
<input type="text" placeholder="ຄົ້ນຫາ" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '16px' }} />
 </div>
<button onClick={handleCreatePostClick} style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#e4e6eb', color: '#000', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, touchAction: 'manipulation' }}>
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
<line x1="12" y1="5" x2="12" y2="19"></line>
<line x1="5" y1="12" x2="19" y2="12"></line>
</svg>
</button>
<button onClick={() => router.push('/notification')} style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#e4e6eb', color: '#000', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, touchAction: 'manipulation' }}>
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
</svg>
</button>

<Link href="/profile" style={{ cursor: 'pointer', flexShrink: 0, touchAction: 'manipulation', display: 'block', textDecoration: 'none' }}>
 <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
 {userProfile?.avatar_url ? (
 <img src={userProfile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
 ) : (
 <svg width="24" height="24" viewBox="0 0 24 24" fill={session ? "#1877f2" : "#65676b"}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
 )}
 </div>
 </Link>
 </div>

<div style={{ display: 'flex', borderBottom: '1px solid #ddd' }}>
  {['recommend', 'sold'].map((t) => {
    const isActive = (t === 'recommend' && pathname === '/') || (t === 'sold' && pathname === '/sold');
    return (
      <div
        key={t}
        onClick={() => { 
          if (t === 'recommend') {
            router.push('/');
          } else {
            router.push('/sold');
          }
          handleLogoClick();
        }}
        style={{
          flex: 1,
          padding: '12px 15px 10px 15px',
          color: isActive ? '#1877f2' : '#65676b',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'manipulation',
          position: 'relative',
        }}
      >
        <div style={{ display: 'inline-block', position: 'relative' }}>
          <span style={{ fontSize: '17px' }}>{t === 'recommend' ? 'ພ້ອມຂາຍ' : 'ຂາຍແລ້ວ'}</span>
          {isActive && (
            <div
              style={{
                position: 'absolute',
                bottom: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '200%',
                height: '4px',
                background: '#1877f2',
                borderRadius: '999px',
              }}
            />
          )}
        </div>
 </div>
    );
  })}
</div>
</div>
<div style={{ height: '118px' }}></div>

 {posts.map((post, index) => {
 const status = getOnlineStatus(post.profiles?.last_seen);
 const isLastElement = posts.length === index + 1;
 return (
<div key={`${post.id}-${index}`} ref={isLastElement ? lastPostElementRef : null} style={{ borderBottom: '8px solid #d1d5db', position: 'relative' }}>
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
<button ref={(el) => { menuButtonRefs.current[post.id] = el; }} data-menu-button onClick={() => { if (activeMenuState === post.id) { setIsMenuAnimating(true); setTimeout(() => { setActiveMenu(null); setIsMenuAnimating(false); }, 300); } else { setActiveMenu(post.id); setIsMenuAnimating(true); requestAnimationFrame(() => { requestAnimationFrame(() => { setIsMenuAnimating(false); }); }); } }} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="#65676b"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg></button>
 {activeMenuState === post.id && (() => {
 const buttonEl = menuButtonRefs.current[post.id];
 const rect = buttonEl?.getBoundingClientRect();
 const menuTop = rect ? rect.bottom + 4 : 0;
 const menuRight = rect ? window.innerWidth - rect.right : 0;
 return (
<div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 10001, pointerEvents: 'auto' }} onClick={() => { setIsMenuAnimating(true); setTimeout(() => { setActiveMenu(null); setIsMenuAnimating(false); }, 300); }}></div>
<div data-menu-container onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} style={{ position: 'fixed', right: `${menuRight}px`, top: `${menuTop}px`, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '8px', zIndex: 10002, width: '130px', border: '1px solid #eee', overflow: 'hidden', touchAction: 'manipulation', transform: isMenuAnimating ? 'translateY(-10px) scale(0.95)' : 'translateY(0) scale(1)', opacity: isMenuAnimating ? 0 : 1, transition: 'transform 0.2s ease-out, opacity 0.2s ease-out', pointerEvents: 'auto' }}>
 {isPostOwner(post) ? (
 <>
<div onClick={() => { setActiveMenu(null); router.push(`/edit-post/${post.id}`); }} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', borderBottom: '1px solid #eee', fontWeight: 'normal', touchAction: 'manipulation' }}>ແກ້ໄຂ</div>
<div onClick={() => { setActiveMenu(null); handleDeletePost(post.id); }} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', borderBottom: '1px solid #eee', fontWeight: 'normal', touchAction: 'manipulation' }}>ລົບ</div>
<div onClick={() => { setActiveMenu(null); router.push(`/boost_post?id=${post.id}`); }} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', fontWeight: 'normal', touchAction: 'manipulation' }}>Boost</div>
 </>
 ) : (
<div onClick={() => { setActiveMenu(null); handleReport(post); }} style={{ padding: '12px 15px', fontSize: '14px', color: '#000', cursor: 'pointer', background: '#fff', fontWeight: 'normal', touchAction: 'manipulation' }}>ລາຍງານ</div>
 )}
 </div>
 </div>
 ); })()}
 </div>
 </div>
 <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{post.caption}</div>
 <PhotoGrid images={post.images || []} onPostClick={(imageIndex) => handleViewPost(post, imageIndex)} />
 <div style={{ borderTop: '1px solid #f0f2f5' }}>
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
<div onClick={() => fetchInteractions('likes', post.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><svg width="22" height="22" viewBox="0 0 24 24" className={justLikedPosts[post.id] ? "animate-pop" : ""} fill={likedPosts[post.id] ? "#e0245e" : "none"} stroke={likedPosts[post.id] ? "#e0245e" : "#65676b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" onClick={(e) => { e.stopPropagation(); toggleLike(post.id); }}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path></svg><span style={{ fontSize: '14px', fontWeight: '600', color: likedPosts[post.id] ? '#e0245e' : '#65676b' }}>{post.likes || 0}</span></div>
<div onClick={() => fetchInteractions('saves', post.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="22" height="22" viewBox="0 0 24 24" className={justSavedPosts[post.id] ? "animate-pop" : ""} fill={savedPosts[post.id] ? "#FFD700" : "none"} stroke={savedPosts[post.id] ? "#FFD700" : "#65676b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" onClick={(e) => { e.stopPropagation(); toggleSave(post.id); }}><path d="M6 2h12a2 2 0 0 1 2 2v18l-8-5-8 5V4a2 2 0 0 1 2-2z"></path></svg><span style={{ fontSize: '14px', fontWeight: '600', color: savedPosts[post.id] ? '#FFD700' : '#65676b' }}>{post.saves || 0}</span></div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#65676b' }}>
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
   <span style={{ fontSize: '14px', fontWeight: '600' }}>{post.views || 0}</span>
 </div>
<div onClick={() => handleShare(post)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg></div>
 </div>
 {isPostOwner(post) ? (
<button onClick={() => togglePostStatus(post.id, post.status)} style={{ background: '#ff0000', padding: '6px 16px', borderRadius: '999px', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>ຍ້າຍໄປຂາຍແລ້ວ</button>
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

 {interactionModal.show && (
 <div style={{ position: 'fixed', inset: 0, background: interactionSheetMode === 'full' ? '#fff' : 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'flex-end', transition: 'background 0.3s', touchAction: 'none', overflow: 'hidden' }} onClick={() => { setIsInteractionModalAnimating(true); setTimeout(() => { setInteractionSheetMode('hidden'); setInteractionModal({ ...interactionModal, show: false }); setIsInteractionModalAnimating(false); }, 300); }}>
<div onClick={e => e.stopPropagation()} onTouchStart={onSheetTouchStart} onTouchMove={onSheetTouchMove} onTouchEnd={onSheetTouchEnd} style={{ width: '100%', background: '#fff', borderRadius: interactionSheetMode === 'full' ? '0' : '20px 20px 0 0', height: interactionSheetMode === 'full' ? 'calc(100% - 110px)' : '70%', transform: isInteractionModalAnimating ? 'translateY(100%)' : 'translateY(0)', transition: 'transform 0.3s ease-out', display: 'flex', flexDirection: 'column', overflow: 'hidden', touchAction: 'auto' }}>
<div onClick={() => { setIsInteractionModalAnimating(true); setTimeout(() => { setInteractionSheetMode('hidden'); setInteractionModal({ ...interactionModal, show: false }); setIsInteractionModalAnimating(false); }, 300); }} style={{ padding: '8px 0', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
 <div style={{ width: '40px', height: '5px', background: '#000', borderRadius: '10px' }}></div>
 </div>
 <div style={{ position: 'sticky', display: 'flex', alignItems: 'center', gap: '40px', padding: '6px 25px 0px 25px', top: 0, background: '#fff', zIndex: 10 }}>
 <div onClick={() => fetchInteractions('likes', interactionModal.postId!)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', width: 'fit-content' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
 <svg width="22" height="22" viewBox="0 0 24 24" fill={interactionModal.type === 'likes' ? "#e0245e" : "none"} stroke={interactionModal.type === 'likes' ? "#e0245e" : "#65676b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path></svg>
<span style={{ fontSize: '15px', fontWeight: 'bold', color: interactionModal.type === 'likes' ? '#e0245e' : '#65676b' }}>{posts.find(p => p.id === interactionModal.postId)?.likes || 0}</span>
 </div>
 <div style={{ width: '100%', height: '3px', background: interactionModal.type === 'likes' ? '#e0245e' : 'transparent', marginTop: '6px', borderRadius: '2px' }}></div>
 </div>
 <div onClick={() => fetchInteractions('saves', interactionModal.postId!)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', width: 'fit-content' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
 <svg width="22" height="22" viewBox="0 0 24 24" fill={interactionModal.type === 'saves' ? "#FFD700" : "none"} stroke={interactionModal.type === 'saves' ? "#FFD700" : "#65676b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h12a2 2 0 0 1 2 2v18l-8-5-8 5V4a2 2 0 0 1 2-2z"></path></svg>
<span style={{ fontSize: '15px', fontWeight: 'bold', color: interactionModal.type === 'saves' ? '#FFD700' : '#65676b' }}>{posts.find(p => p.id === interactionModal.postId)?.saves || 0}</span>
 </div>
 <div style={{ width: '100%', height: '3px', background: interactionModal.type === 'saves' ? '#FFD700' : 'transparent', marginTop: '6px', borderRadius: '2px' }}></div>
 </div>
 <div style={{ position: 'absolute', bottom: '0px', left: 0, right: 0, height: '1px', background: '#f0f0f0' }}></div>
 </div>
 <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
{interactionLoading ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}><div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div></div> :
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

 {loadingMore && (
<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
<div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
 </div>
 )}

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

 {reportingPost && (
 <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
 <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '20px' }}>
 <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', textAlign: 'center' }}>ລາຍງານໂພສ</h3>
<p style={{ fontSize: '14px', color: '#65676b', marginBottom: '10px' }}>ກະລຸນາລະບຸສາເຫດ:</p>
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
<div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 2000, transform: isViewingModeOpen ? `translateX(calc(${viewingModeDragOffset}px))` : 'translateX(100%)', transition: viewingModeIsDragging ? 'none' : 'transform 0.3s ease-out' }} onTouchStart={handleViewingModeTouchStart} onTouchMove={handleViewingModeTouchMove} onTouchEnd={handleViewingModeTouchEnd}>
<div id="viewing-mode-container" style={{ width: '100%', height: '100%', background: '#fff', position: 'relative', overflowY: 'auto' }}>
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 2001 }}>
<button onClick={() => { setIsViewingModeOpen(false); setIsHeaderVisible(true); setTimeout(() => { setViewingPost(null); window.scrollTo(0, savedScrollPosition); }, 300); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', touchAction: 'manipulation' }}>
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<polyline points="15 18 9 12 15 6"></polyline>
</svg>
</button>
 <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{viewingPost.profiles?.avatar_url ? (<img src={viewingPost.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (<svg width="22" height="22" viewBox="0 0 24 24" fill="#65676b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>)}</div>
 <div>
 <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>{viewingPost.profiles?.username || 'User'}{status.isOnline ? (<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div><span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span></div>) : (status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>)}</div>
 <div style={{ fontSize: '12px', color: '#65676b', lineHeight: '16px' }}>{viewingPost.is_boosted ? (<span style={{ display: 'inline-flex', alignItems: 'center' }}><span style={{ fontWeight: 'bold', color: '#65676b' }}>• Ad</span> <span style={{ marginLeft: '4px' }}>{formatTime(viewingPost.created_at)}</span><span style={{ margin: '0 4px' }}>•</span>{viewingPost.province}</span>) : (<>{formatTime(viewingPost.created_at)} · {viewingPost.province}</>)}</div>
 </div>
 </div>
{viewingPost.images.map((img: string, idx: number) => (<div key={idx} id={`viewing-image-${idx}`} style={{ position: 'relative', background: '#fff', marginBottom: '12px' }}><div style={{ width: '100%', overflow: 'hidden' }}><img src={img} onClick={() => { setFullScreenImages(viewingPost.images); setCurrentImgIndex(idx); }} style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }} /></div></div>))}
 </div>
 </div>
 )})()}

 {fullScreenImages && (
 <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000, display: 'flex', flexDirection: 'column', touchAction: 'none' }} onTouchStart={fullScreenOnTouchStart} onTouchMove={fullScreenOnTouchMove} onTouchEnd={fullScreenOnTouchEnd} onClick={fullScreenOnClick}>
 <div style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', opacity: fullScreenShowDetails ? 1 : 0, transition: 'opacity 0.35s ease-out', pointerEvents: fullScreenShowDetails ? 'auto' : 'none' }}>
 <button onClick={() => { setFullScreenImages(null); if (activePhotoMenu !== null) { setIsPhotoMenuAnimating(true); setTimeout(() => { setActivePhotoMenu(null); setIsPhotoMenuAnimating(false); }, 300); } }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', touchAction: 'manipulation' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
 <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: '16px', fontWeight: 'bold', padding: 0, margin: 0 }}>{currentImgIndex + 1}/{fullScreenImages.length}</div>
 <div style={{ position: 'relative' }}>
 <button ref={photoMenuButtonRef} data-menu-button onClick={(e) => { e.stopPropagation(); if (activePhotoMenu === currentImgIndex) { setIsPhotoMenuAnimating(true); setTimeout(() => { setActivePhotoMenu(null); setIsPhotoMenuAnimating(false); }, 300); } else { setActivePhotoMenu(currentImgIndex); setIsPhotoMenuAnimating(true); requestAnimationFrame(() => { requestAnimationFrame(() => { setIsPhotoMenuAnimating(false); }); }); } }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', touchAction: 'manipulation' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg></button>
 {activePhotoMenu === currentImgIndex && (() => {
 const buttonEl = photoMenuButtonRef.current;
 const rect = buttonEl?.getBoundingClientRect();
 const menuTop = rect ? rect.bottom + 4 : 0;
 const menuRight = rect ? window.innerWidth - rect.right : 0;
 return (
<div style={{ position: 'fixed', inset: 0, zIndex: 3100, pointerEvents: 'none' }}>
<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 3101, pointerEvents: 'auto' }} onClick={() => { setIsPhotoMenuAnimating(true); setTimeout(() => { setActivePhotoMenu(null); setIsPhotoMenuAnimating(false); }, 300); }}></div>
<div data-menu-container onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} style={{ position: 'fixed', right: `${menuRight}px`, top: `${menuTop}px`, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', borderRadius: '8px', width: '130px', zIndex: 3102, overflow: 'hidden', touchAction: 'manipulation', transform: isPhotoMenuAnimating ? 'translateY(-10px) scale(0.95)' : 'translateY(0) scale(1)', opacity: isPhotoMenuAnimating ? 0 : 1, transition: 'transform 0.2s ease-out, opacity 0.2s ease-out', pointerEvents: 'auto' }}>
<div onClick={() => { setActivePhotoMenu(null); downloadImage(fullScreenImages[currentImgIndex]); }} style={{ padding: '15px', fontSize: '14px', cursor: 'pointer', color: '#1c1e21', fontWeight: 'bold', textAlign: 'center' }}>ບັນທຶກຮູບ</div>
</div>
 </div>
 ); })()}
 </div>
 </div>
 <div ref={fullScreenImageContainerRef} style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
 <div style={{ display: 'flex', transition: fullScreenIsDragging ? 'none' : `transform ${fullScreenTransitionDuration}ms ease-out`, transform: `translateX(calc(-${currentImgIndex * 100}% + ${fullScreenDragOffset}px)) translateY(${fullScreenVerticalDragOffset}px)`, width: '100%', height: '100%' }}>
 {fullScreenImages.map((img, idx) => (<div key={idx} style={{ minWidth: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', transform: idx === currentImgIndex ? `scale(${fullScreenZoomScale})` : 'scale(1)', transformOrigin: idx === currentImgIndex ? fullScreenZoomOrigin : 'center center', transition: fullScreenIsDragging ? 'none' : 'transform 0.2s ease-out' }}><img src={img} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }} /></div>))}
 </div>
 </div>
 </div>
 )}

 {fullScreenImages && showDownloadBottomSheet && (
 <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 4000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', transition: 'background 0.3s' }} onClick={() => { setIsDownloadBottomSheetAnimating(true); setTimeout(() => { setShowDownloadBottomSheet(false); setIsDownloadBottomSheetAnimating(false); }, 300); }}>
 <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '20px 20px 0 0', transform: isDownloadBottomSheetAnimating ? 'translateY(100%)' : 'translateY(0)', transition: 'transform 0.3s ease-out', overflow: 'hidden', border: '1px solid #eee' }}>
 <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center', cursor: 'pointer' }} onClick={() => { setIsDownloadBottomSheetAnimating(true); setTimeout(() => { setShowDownloadBottomSheet(false); setIsDownloadBottomSheetAnimating(false); }, 300); }}>
 <div style={{ width: '40px', height: '5px', background: '#000', borderRadius: '10px' }}></div>
 </div>
 <div onClick={() => { setIsDownloadBottomSheetAnimating(true); setTimeout(() => { setShowDownloadBottomSheet(false); setIsDownloadBottomSheetAnimating(false); fullScreenImages && downloadImage(fullScreenImages[currentImgIndex]); }, 300); }} style={{ padding: '15px', fontSize: '14px', cursor: 'pointer', color: '#1c1e21', fontWeight: 'bold', textAlign: 'center', background: '#fff', borderBottom: '1px solid #eee' }}>ບັນທຶກຮູບ</div>
 <div onClick={() => { setIsDownloadBottomSheetAnimating(true); setTimeout(() => { setShowDownloadBottomSheet(false); setIsDownloadBottomSheetAnimating(false); }, 300); }} style={{ padding: '15px', fontSize: '14px', cursor: 'pointer', color: '#65676b', textAlign: 'center', background: '#fff' }}>ຍົກເລີກ</div>
 </div>
 </div>
 )}

 {showImageForDownload && (
 <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowImageForDownload(null)}>
 <img src={showImageForDownload} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'default' }} onContextMenu={(e) => e.preventDefault()} />
 </div>
 )}
 </main>
 );
}

export default function Home() {
return (
<Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div></div>}>
<HomeContent />
</Suspense>
);
}
