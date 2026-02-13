import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Shared Hooks
import { getDisplayAvatarUrl, isProviderDefaultAvatar } from '@/utils/avatarUtils';
import { getPrimaryGuestToken } from '@/utils/postUtils';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useMenu } from '@/hooks/useMenu';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useViewingPost } from '@/hooks/useViewingPost';
import { usePostModals } from '@/hooks/usePostModals';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { usePostListData } from '@/hooks/usePostListData';
import { usePostFeedHandlers } from '@/hooks/usePostFeedHandlers';
import { useInteractionModal } from '@/hooks/useInteractionModal';

export function useEditProfilePage() {
  const router = useRouter();

  // Profile States
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editingUsername, setEditingUsername] = useState('');
  const [editingPhone, setEditingPhone] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showPhoneCharWarning, setShowPhoneCharWarning] = useState(false);

  // Feed States
  const [tab, setTab] = useState<'recommend' | 'sold'>('recommend');
  const [tabRefreshing, setTabRefreshing] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [justLikedPosts, setJustLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [justSavedPosts, setJustSavedPosts] = useState<{ [key: string]: boolean }>({});

  // Use shared hooks
  const menu = useMenu();
  const fullScreenViewer = useFullScreenViewer();
  const viewingPostHook = useViewingPost();
  const headerScroll = useHeaderScroll();

  // Use interaction modal hook (bottom sheet for likes/saves)
  const interactionModalHook = useInteractionModal();

  // Use post list data hook for my-posts
  const postListData = usePostListData({
    type: 'my-posts',
    userIdOrToken: userId || undefined,
    session,
    tab,
  });

  // Use shared infinite scroll hook
  const { lastElementRef: lastPostElementRef } = useInfiniteScroll({
    loadingMore: postListData.loadingMore,
    hasMore: postListData.hasMore,
    onLoadMore: () => postListData.setPage(prevPage => prevPage + 1),
    threshold: 0.1,
  });

  // Use shared post interactions hook
  const { toggleLike, toggleSave } = usePostInteractions({
    session: postListData.session,
    posts: postListData.posts,
    setPosts: postListData.setPosts,
    likedPosts: postListData.likedPosts,
    savedPosts: postListData.savedPosts,
    setLikedPosts: postListData.setLikedPosts,
    setSavedPosts: postListData.setSavedPosts,
    setJustLikedPosts,
    setJustSavedPosts,
  });

  // Fetch liked status for all posts (like home page)
  const fetchLikedStatus = useCallback(async (userIdOrToken: string, currentSession: any) => {
    const table = currentSession ? 'post_likes' : 'post_likes_guest';
    const column = currentSession ? 'user_id' : 'guest_token';
    const { data } = await supabase.from(table).select('post_id').eq(column, userIdOrToken);
    if (data) {
      const likedMap: { [key: string]: boolean } = {};
      data.forEach(item => likedMap[item.post_id] = true);
      postListData.setLikedPosts(likedMap);
    }
  }, [postListData.setLikedPosts]);

  // Fetch saved status for all posts (like home page)
  const fetchSavedStatus = useCallback(async (userIdOrToken: string, currentSession: any) => {
    const table = currentSession ? 'post_saves' : 'post_saves_guest';
    const column = currentSession ? 'user_id' : 'guest_token';
    const { data } = await supabase.from(table).select('post_id').eq(column, userIdOrToken);
    if (data) {
      const savedMap: { [key: string]: boolean } = {};
      data.forEach(item => savedMap[item.post_id] = true);
      postListData.setSavedPosts(savedMap);
    }
  }, [postListData.setSavedPosts]);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (currentSession) {
        const uid = currentSession.user.id;
        userIdRef.current = uid;
        setSession(currentSession);
        setUserId(uid);
        await fetchProfile(uid);
      } else {
        router.push('/register');
      }
    };

    checkUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize data when tab changes (ไม่ใส่ postListData ใน deps เพื่อไม่ให้ effect รันทุก re-render)
  useEffect(() => {
    if (userId && session) {
      postListData.setPage(0);
      postListData.setHasMore(true);
      postListData.fetchPosts(true);
      // Fetch liked and saved status when tab changes (like home page)
      fetchLikedStatus(userId, session);
      fetchSavedStatus(userId, session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ใช้ postListData จาก closure เฉพาะเมื่อ tab/userId/session เปลี่ยน
  }, [tab, userId, session, fetchLikedStatus, fetchSavedStatus]);

  useEffect(() => {
    if (!postListData.loadingMore) setTabRefreshing(false);
  }, [postListData.loadingMore]);

  // Load more when page changes (ไม่ใส่ postListData ทั้งก้อนใน deps เพื่อลดการรัน effect ซ้ำ)
  useEffect(() => {
    if (postListData.page > 0 && !postListData.loadingMore && userId && session) {
      postListData.fetchPosts(false, postListData.page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ใช้ postListData จาก closure เฉพาะเมื่อ page/loadingMore/userId/session เปลี่ยน
  }, [postListData.page, postListData.loadingMore, userId, session]);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url, phone, last_seen')
      .eq('id', uid)
      .single();

    if (data) {
      setUsername(data.username || '');
      const rawAvatar = data.avatar_url || '';
      if (rawAvatar && isProviderDefaultAvatar(rawAvatar)) {
        await supabase.from('profiles').update({ avatar_url: null }).eq('id', uid);
        setAvatarUrl('');
      } else {
        setAvatarUrl(getDisplayAvatarUrl(rawAvatar) || '');
      }
      setPhone(data.phone || '');
    }
  };

  const uploadAvatar = async (event: any) => {
    const uid = userId ?? userIdRef.current;
    if (!uid) return;
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;
      const filePath = `avatars/${uid}-${Date.now()}`;
      await supabase.storage.from('car-images').upload(filePath, file);
      const {
        data: { publicUrl },
      } = supabase.storage.from('car-images').getPublicUrl(filePath);

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', uid);
      setAvatarUrl(publicUrl);
    } finally {
      setUploading(false);
    }
  };

  const saveUsername = async (name: string) => {
    const uid = userId ?? userIdRef.current;
    if (!uid) return;
    const { error } = await supabase.from('profiles').update({ username: name }).eq('id', uid);
    if (!error) {
      setUsername(name);
      setIsEditingName(false);
      if (typeof document !== 'undefined') document.body.style.overflow = '';
    }
  };

  const savePhone = async (phoneNum: string) => {
    const uid = userId ?? userIdRef.current;
    if (!uid) return;
    const { error } = await supabase.from('profiles').update({ phone: phoneNum }).eq('id', uid);
    if (!error) {
      setPhone(phoneNum);
      setIsEditingPhone(false);
      if (typeof document !== 'undefined') document.body.style.overflow = '';
    }
  };

  // Use shared post feed handlers
  const handlers = usePostFeedHandlers({
    session: postListData.session,
    posts: postListData.posts,
    setPosts: postListData.setPosts,
    viewingPostHook,
    headerScroll,
    menu,
  });

  // Use shared post modals hook for managing modal side effects
  usePostModals({
    viewingPost: viewingPostHook.viewingPost,
    isViewingModeOpen: viewingPostHook.isViewingModeOpen,
    setIsViewingModeOpen: viewingPostHook.setIsViewingModeOpen,
    setViewingModeDragOffset: viewingPostHook.setViewingModeDragOffset,
    setViewingModeIsDragging: viewingPostHook.setViewingModeIsDragging,
    initialImageIndex: viewingPostHook.initialImageIndex,
    savedScrollPosition: viewingPostHook.savedScrollPosition,
    fullScreenImages: fullScreenViewer.fullScreenImages,
    setFullScreenDragOffset: fullScreenViewer.setFullScreenDragOffset,
    setFullScreenVerticalDragOffset: fullScreenViewer.setFullScreenVerticalDragOffset,
    setFullScreenZoomScale: fullScreenViewer.setFullScreenZoomScale,
    setFullScreenZoomOrigin: fullScreenViewer.setFullScreenZoomOrigin,
    setFullScreenIsDragging: fullScreenViewer.setFullScreenIsDragging,
    setFullScreenTransitionDuration: fullScreenViewer.setFullScreenTransitionDuration,
    setFullScreenShowDetails: fullScreenViewer.setFullScreenShowDetails,
    interactionModalShow: interactionModalHook.interactionModal.show,
    setIsHeaderVisible: headerScroll.setIsHeaderVisible,
  });

  // Fetch liked and saved status when session is available (like home page)
  useEffect(() => {
    if (session?.user?.id) {
      fetchLikedStatus(session.user.id, session);
      fetchSavedStatus(session.user.id, session);
    }
  }, [session, fetchLikedStatus, fetchSavedStatus]);

  // Fetch interactions for bottom sheet (likes / saves)
  const fetchInteractions = useCallback(
    async (type: 'likes' | 'saves', postId: string) => {
      await interactionModalHook.fetchInteractions(type, postId, postListData.posts);
    },
    [interactionModalHook, postListData.posts],
  );

  // Lock background scroll while edit-name / edit-phone / phone-warning popup is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const shouldLock = isEditingName || isEditingPhone || showPhoneCharWarning;
    if (shouldLock) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isEditingName, isEditingPhone, showPhoneCharWarning]);

  const handleEditNameClick = useCallback(() => {
    setEditingUsername(username);
    setIsEditingName(true);
  }, [username]);

  const handleEditPhoneClick = useCallback(() => {
    const initialPhone = phone && phone.startsWith('020') ? phone : '020';
    setEditingPhone(initialPhone);
    setIsEditingPhone(true);
  }, [phone]);

  const handleCancelPhoneEdit = useCallback(() => {
    setIsEditingPhone(false);
    const initialPhone = phone && phone.startsWith('020') ? phone : '020';
    setEditingPhone(initialPhone);
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  }, [phone]);

  const handleCloseNameModal = useCallback(() => {
    setIsEditingName(false);
    setEditingUsername(username);
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  }, [username]);

  const handleSaveUsername = useCallback((name: string) => {
    if (name.trim().length >= 1) {
      saveUsername(name.trim());
    }
  }, []);

  const handleSavePhone = useCallback((phoneNum: string) => {
    if (phoneNum === '020' || (phoneNum.startsWith('020') && phoneNum.length === 11)) {
      savePhone(phoneNum);
    }
  }, []);

  return {
    // profile
    username,
    phone,
    avatarUrl,
    isEditingName,
    isEditingPhone,
    editingUsername,
    editingPhone,
    setEditingUsername,
    setEditingPhone,
    uploading,
    showPhoneCharWarning,
    setShowPhoneCharWarning,

    // feed / tab
    tab,
    setTab,
    tabRefreshing,
    setTabRefreshing,
    justLikedPosts,
    justSavedPosts,

    // hooks / data
    menu,
    fullScreenViewer,
    viewingPostHook,
    headerScroll,
    interactionModalHook,
    postListData,
    lastPostElementRef,
    handlers,
    toggleLike,
    toggleSave,
    fetchInteractions,

    // ui handlers
    uploadAvatar,
    handleEditNameClick,
    handleEditPhoneClick,
    handleCancelPhoneEdit,
    handleCloseNameModal,
    handleSaveUsername,
    handleSavePhone,
  };
}

