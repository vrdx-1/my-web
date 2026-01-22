'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';

function SoldPageContent() {
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
  const [activeMenuState, setActiveMenu] = useState<string | null>(null);
  const [myGuestPosts, setMyGuestPosts] = useState<{ post_id: string, token: string }[]>([]);

  const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [activePhotoMenu, setActivePhotoMenu] = useState<number | null>(null);

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 12;
  const PREFETCH_COUNT = 10;
  const observer = useRef<IntersectionObserver | null>(null);

  const [interactionModal, setInteractionModal] = useState<{ show: boolean, type: 'likes' | 'saves', postId: string | null }>({ show: false, type: 'likes', postId: null });
  const [interactionUsers, setInteractionUsers] = useState<any[]>([]);
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [interactionSheetMode, setInteractionSheetMode] = useState<'half' | 'full' | 'hidden'>('hidden');

  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

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
    if (typeof window === 'undefined') return '';
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
    await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', idOrToken);
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

    const { data } = await supabase
      .from('cars')
      .select('id')
      .eq('status', 'sold')
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .range(startIndex, endIndex);
    
    postIds = (data || []).map(p => p.id);
    setHasMore(postIds.length === PREFETCH_COUNT);

    if (isInitial) setPosts([]);

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
          if (!existingIds.has(postData.id)) return [...prev, postData];
          return prev;
        });
      }
    }
    setLoadingMore(false);
  };

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchPosts(true);
  }, [searchTerm]);

  useEffect(() => {
    if (page > 0) fetchPosts();
  }, [page]);

  useEffect(() => {
    const postId = searchParams.get('post');
    if (postId && posts.length > 0) {
      const sharedPost = posts.find(p => p.id === postId);
      if (sharedPost) {
        setViewingPost(sharedPost);
        router.replace(window.location.pathname, { scroll: false });
      }
    } else if (postId && posts.length === 0) {
      const checkPost = async () => {
        const { data } = await supabase.from('cars').select('*, profiles!cars_user_id_fkey(*)').eq('id', postId).single();
        if (data) {
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
    return () => subscription.unsubscribe();
  }, [session]);

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
    if (diffInHours < 24) return { isOnline: false, text: `ອອນลາຍລ່າສຸດ ${diffInHours} ຊົ່ວໂມງທີ່แລ້ວ` };
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInDays} ມື้ທີ່แล้ว` };
    return { isOnline: false, text: 'ອອນລາຍລ່າສຸດ' };
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
    return `${diffInDays} ມື້`;
  };

  const isPostOwner = (post: any) => {
    if (session && String(post.user_id) === String(session.user.id)) return true;
    try {
      const stored = JSON.parse(localStorage.getItem('my_guest_posts') || '[]');
      return stored.some((item: any) => String(item.post_id) === String(post.id));
    } catch (e) { return false; }
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
      if (!error) await supabase.from('cars').update({ likes: newLikesCount }).eq('id', postId);
    } else {
      const { error } = await supabase.from(table).insert([{ [column]: userId, post_id: postId }]);
      if (!error) await supabase.from('cars').update({ likes: newLikesCount }).eq('id', postId);
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

    if (isCurrentlySaved) {
      const { error } = await supabase.from(table).delete().eq(column, userId).eq('post_id', postId);
      if (!error) await supabase.from('cars').update({ saves: newSavesCount }).eq('id', postId);
    } else {
      const { error } = await supabase.from(table).insert([{ [column]: userId, post_id: postId }]);
      if (!error) await supabase.from('cars').update({ saves: newSavesCount }).eq('id', postId);
    }
  };

  const handleViewPost = async (post: any) => {
    setViewingPost(post);
    await supabase.rpc('increment_views', { post_id: post.id });
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
    }
    setActiveMenu(null);
  };

  const handleReport = (post: any) => {
    if (!session) { alert("ກະລຸນາລົງທະບຽນກ່ອນ"); return; }
    setReportingPost(post);
    setActiveMenu(null);
  };

  const submitReport = async () => {
    if (!reportReason.trim()) { alert("ກະລຸນาລະบุสาเหดการรายงาน"); return; }
    setIsSubmittingReport(true);
    const { error } = await supabase.from('reports').insert([{ post_id: reportingPost.id, car_id: reportingPost.id, reporter_email: session.user.email, post_caption: reportingPost.caption, reason: reportReason, status: 'pending' }]);
    if (!error) { alert("ລາຍງານສຳເລັດແລ້ວ!"); setReportingPost(null); setReportReason(''); }
    setIsSubmittingReport(false);
  };

  const handleShare = async (post: any) => {
    const shareUrl = `${window.location.origin}/sold?post=${post.id}`;
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
      } else { navigator.clipboard.writeText(shareUrl); alert("ຄັດລອກລິ້ງສຳເລັດແລ້ວ!"); }
    } catch (err) { }
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
    return (
      <div onClick={onPostClick} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', cursor: 'pointer' }}>
        {images.slice(0, 4).map((img, i) => (
          <div key={i} style={{ position: 'relative', height: '200px' }}>
            <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {i === 3 && count > 4 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', color: '#fff', WebkitTextStroke: '3px #000', paintOrder: 'stroke fill' }}>
                +{count - 4}
              </div>
            )}
          </div>
        ))}
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

  const onSheetTouchStart = (e: React.TouchEvent) => setStartY(e.touches[0].clientY);
  const onSheetTouchMove = (e: React.TouchEvent) => {
    const moveY = e.touches[0].clientY - startY;
    setCurrentY(moveY);
  };
  const onSheetTouchEnd = () => {
    if (currentY < -50) setInteractionSheetMode('full');
    else if (currentY > 50) {
      if (interactionSheetMode === 'full') setInteractionSheetMode('half');
      else { setInteractionSheetMode('hidden'); setInteractionModal({ ...interactionModal, show: false }); }
    }
    setCurrentY(0);
  };

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', fontFamily: 'sans-serif', position: 'relative' }}>
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
      `}</style>

      <input type="file" ref={hiddenFileInputRef} multiple accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

      <div style={{ padding: '8px 15px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: 0, background: '#fff', zIndex: 100, borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f0f2f5', borderRadius: '20px', padding: '6px 15px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', flexShrink: 0 }}><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
          <input type="text" placeholder="ຄົ້ນຫາ" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '14px' }} />
        </div>
        <button onClick={() => session ? hiddenFileInputRef.current?.click() : setShowTermsModal(true)} style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#e4e6eb', color: '#000', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button onClick={() => router.push('/notification')} style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#e4e6eb', color: '#65676b', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11a7 7 0 0 1 14 0c0 3.5 1.5 5.5 2 6H3c.5-.5 2-2.5 2-6Z"></path><path d="M10 20a2 2 0 0 0 4 0"></path></svg>
        </button>
        <div onClick={() => router.push('/profile')} style={{ cursor: 'pointer', flexShrink: 0 }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {userProfile?.avatar_url ? (<img src={userProfile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (<svg width="22" height="22" viewBox="0 0 24 24" fill={session ? "#1877f2" : "#65676b"}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', position: 'fixed', top: '48px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '600px', background: '#fff', zIndex: 90 }}>
        {['recommend', 'sold'].map((t) => {
          const isActive = (t === 'recommend' && pathname === '/') || (t === 'sold' && pathname === '/sold');
          return (
            <div
              key={t}
              onClick={() => { 
                if (t === 'recommend') {
                  router.push('/');
                } else {
                  handleLogoClick();
                }
              }}
              style={{
                flex: 1,
                padding: '13px 10px 7px 10px',
                color: isActive ? '#1877f2' : '#65676b',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span>{t === 'recommend' ? 'ພ້ອມຂາຍ' : 'ຂາຍແລ້ວ'}</span>
              {isActive && (
                <div
                  style={{
                    marginTop: '4px',
                    width: '40%',
                    height: '3px',
                    background: '#1877f2',
                    borderRadius: '999px',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ height: '48px' }}></div>

      {posts.map((post, index) => {
        const status = getOnlineStatus(post.profiles?.last_seen);
        const isLastElement = posts.length === index + 1;
        return (
          <div key={`${post.id}-${index}`} ref={isLastElement ? lastPostElementRef : null} style={{ borderBottom: '8px solid #d1d5db', position: 'relative' }}>
            <div style={{ padding: '12px 15px 8px 15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {post.profiles?.avatar_url ? (<img src={post.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (<svg width="26" height="26" viewBox="0 0 24 24" fill="#65676b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {post.profiles?.username || 'User'}
                  {status.isOnline && <div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div>}
                </div>
                <div style={{ fontSize: '12px', color: '#65676b' }}>{formatTime(post.created_at)} · {post.province}</div>
              </div>
              <button onClick={() => setActiveMenu(activeMenuState === post.id ? null : post.id)} style={{ background: 'none', border: 'none', padding: '8px' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="#65676b"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg></button>
              {activeMenuState === post.id && (
                <div style={{ position: 'absolute', right: 0, top: '40px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '8px', zIndex: 150, width: '130px', border: '1px solid #eee', overflow: 'hidden' }}>
                  {isPostOwner(post) ? (
                    <>
                      <div onClick={() => { setActiveMenu(null); router.push(`/edit-post/${post.id}`); }} style={{ padding: '12px 15px', fontSize: '14px', borderBottom: '1px solid #eee' }}>แก้ไข</div>
                      <div onClick={() => handleDeletePost(post.id)} style={{ padding: '12px 15px', fontSize: '14px', borderBottom: '1px solid #eee' }}>ລົບ</div>
                    </>
                  ) : (
                    <div onClick={() => handleReport(post)} style={{ padding: '12px 15px', fontSize: '14px' }}>ລາຍງານ</div>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', whiteSpace: 'pre-wrap' }}>{post.caption}</div>
            <PhotoGrid images={post.images || []} onPostClick={() => handleViewPost(post)} />
            <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f0f2f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div onClick={() => fetchInteractions('likes', post.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" className={justLikedPosts[post.id] ? "animate-pop" : ""} fill={likedPosts[post.id] ? "#e0245e" : "none"} stroke={likedPosts[post.id] ? "#e0245e" : "#65676b"} strokeWidth="2" onClick={(e) => { e.stopPropagation(); toggleLike(post.id); }}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path></svg>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: likedPosts[post.id] ? '#e0245e' : '#65676b' }}>{post.likes || 0}</span>
                </div>
                <div onClick={() => fetchInteractions('saves', post.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill={savedPosts[post.id] ? "#FFD700" : "none"} stroke={savedPosts[post.id] ? "#FFD700" : "#65676b"} strokeWidth="2" onClick={(e) => { e.stopPropagation(); toggleSave(post.id); }}><path d="M6 2h12a2 2 0 0 1 2 2v18l-8-5-8 5V4a2 2 0 0 1 2-2z"></path></svg>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: savedPosts[post.id] ? '#FFD700' : '#65676b' }}>{post.saves || 0}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#65676b' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg><span style={{ fontSize: '14px', fontWeight: '600' }}>{post.views || 0}</span></div>
                <div onClick={() => handleShare(post)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg></div>
              </div>
              {isPostOwner(post) && (
                <button onClick={() => togglePostStatus(post.id, post.status)} style={{ background: '#1877f2', padding: '6px 16px', borderRadius: '999px', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '13px' }}>ຍ້າຍໄປພ້ອມຂາຍ</button>
              )}
            </div>
          </div>
        )
      })}

      {interactionModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setInteractionModal({ ...interactionModal, show: false })}>
          <div onClick={e => e.stopPropagation()} onTouchStart={onSheetTouchStart} onTouchMove={onSheetTouchMove} onTouchEnd={onSheetTouchEnd} style={{ width: '100%', maxWidth: '600px', margin: '0 auto', background: '#fff', borderRadius: '20px 20px 0 0', height: '50%', transform: `translateY(${currentY > 0 ? currentY : 0}px)`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 0', display: 'flex', justifyContent: 'center' }} onClick={() => setInteractionModal({ ...interactionModal, show: false })}><div style={{ width: '40px', height: '5px', background: '#000', borderRadius: '10px' }}></div></div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {interactionUsers.map((u, i) => (
                <div key={i} style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={u.avatar_url} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ fontWeight: '600' }}>{u.username}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loadingMore && <div style={{ textAlign: 'center', padding: '20px' }}><div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div></div>}
    </main>
  );
}

export default function SoldPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div></div>}>
      <SoldPageContent />
    </Suspense>
  );
}
