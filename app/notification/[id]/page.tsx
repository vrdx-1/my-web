'use client'
import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';

// Shared Components
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PhotoGrid } from '@/components/PhotoGrid';
import { Avatar } from '@/components/Avatar';

// Shared Hooks
import { useViewingPost } from '@/hooks/useViewingPost';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { useMenu } from '@/hooks/useMenu';

// Shared Utils
import { formatTime, getOnlineStatus, isPostOwner } from '@/utils/postUtils';
import { deletePost } from '@/utils/postManagement';

// Dynamic Imports
const ViewingPostModal = lazy(() => 
  import('@/components/modals/ViewingPostModal').then(m => ({ default: m.ViewingPostModal }))
) as React.LazyExoticComponent<React.ComponentType<any>>;
const FullScreenImageViewer = lazy(() => 
  import('@/components/modals/FullScreenImageViewer').then(m => ({ default: m.FullScreenImageViewer }))
) as React.LazyExoticComponent<React.ComponentType<any>>;

export default function NotificationDetail() {
 const router = useRouter();
 const { id } = useParams();

 // --- States หลัก ---
 const [post, setPost] = useState<any>(null);
 const [session, setSession] = useState<any>(null);
 const [loading, setLoading] = useState(true);

 // Use shared hooks
 const menu = useMenu();
 const viewingPostHook = useViewingPost();
 const fullScreenViewer = useFullScreenViewer();

 // --- States สำหรับแท็บด้านล่าง ---
 const [activeTab, setActiveTab] = useState<'likes' | 'saves' | 'shares'>('likes');
 const [userList, setUserList] = useState<any[]>([]);
 const [listLoading, setListLoading] = useState(false);

 useEffect(() => {
 supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
 }, []);

 const fetchPostDetail = useCallback(async () => {
 setLoading(true);
 const { data } = await supabase
 .from('cars')
 .select('*, profiles!cars_user_id_fkey(*)')
 .eq('id', id)
 .single();
 if (data) {
   setPost(data);
   // Increment views
   await supabase.rpc('increment_views', { post_id: id }).catch(() => {
     supabase.from('cars').update({ views: (data.views || 0) + 1 }).eq('id', id);
   });
 }
 setLoading(false);
 }, [id]);

 // แก้ไขจุดที่เกี่ยวข้อง: ดึงข้อมูลจากทั้งตารางสมาชิก และตาราง Guest พร้อมกัน
 const fetchInteractions = useCallback(async (tab: string) => {
 setListLoading(true);
 try {
  const baseTable = tab === 'likes' ? 'post_likes' : tab === 'saves' ? 'post_saves' : 'post_shares';
  const guestTable = `${baseTable}_guest`;

  // 1. ดึงข้อมูลจากตารางสมาชิก (Profiles)
  const { data: userData, error: userError } = await supabase
    .from(baseTable)
    .select(`created_at, profiles:user_id (username, avatar_url)`)
    .eq('post_id', id);

  if (userError) throw userError;

  // 2. ดึงข้อมูลจากตาราง Guest
  const { data: guestData, error: guestError } = await supabase
    .from(guestTable)
    .select(`created_at`)
    .eq('post_id', id);

  if (guestError) throw guestError;

  // 3. รวมข้อมูลและจัดรูปแบบ
  const formattedUsers = [
    ...(userData || []).map((item: any) => ({
      username: item.profiles?.username || 'Unknown User',
      avatar_url: item.profiles?.avatar_url || 'https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/car-images/default-avatar.png',
      created_at: item.created_at
    })),
    ...(guestData || []).map((item: any) => ({
      username: 'User', // ชื่อ Default สำหรับ Guest
      avatar_url: 'https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/car-images/default-avatar.png',
      created_at: item.created_at
    }))
  ];

  // เรียงลำดับตามเวลาล่าสุด
  formattedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  setUserList(formattedUsers);
 } catch (err) {
  console.error('Fetch Interaction Error:', err);
 } finally {
  setListLoading(false);
 }
 }, [id]);

 useEffect(() => {
 if (id) {
 fetchPostDetail();
 fetchInteractions(activeTab);
 }
 }, [id, activeTab, fetchPostDetail, fetchInteractions]);

 // Removed duplicate functions - using from shared utils

 // --- Action Functions (ใช้งานได้จริง) ---
 const handleDeletePost = useCallback(async (postId: string) => {
   if (!confirm("ທ່ານແນ່ໃຈຫຼືບໍ່ວ່າຕ້ອງການລົບໂພສນີ້?")) return;
   const { error } = await supabase.from('cars').delete().eq('id', postId);
   if (!error) {
     setPost(null);
     menu.setActiveMenu(null);
     alert("ລົບໂພສສຳເລັດແລ້ວ");
     router.back();
   } else {
     alert("ເກີດຂໍ້ຜິດພາດ: " + error.message);
   }
 }, [router, menu]);

 if (loading || !post) return (
   <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
     <LoadingSpinner />
   </div>
 );

 const status = getOnlineStatus(post.profiles?.last_seen);

 return (
 <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', position: 'relative', fontFamily: 'sans-serif' }}>
 
 {/* 1. Header คลีนๆ ตามที่สั่ง */}
 <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 100, borderBottom: '1px solid #f0f0f0' }}>
 <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', marginRight: '15px' }}>←</button>
 <span style={{ fontWeight: 'bold', fontSize: '18px' }}>ລາຍລະອຽດໂພສ</span>
 </div>

 {/* 2. ฟีดสไตล์หน้า Home - ใช้ PostCard หรือ custom UI */}
 <div style={{ borderBottom: '8px solid #f0f2f5' }}>
 <div style={{ padding: '12px 15px 8px 15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}>
 <Avatar avatarUrl={post.profiles?.avatar_url} size={40} session={session} />
 </div>
 <div style={{ flex: 1 }}>
 <div style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
 {post.profiles?.username}
 {status.isOnline && (
 <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
 <div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div>
 <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
 </div>
 )}
 </div>
 <div style={{ fontSize: '12px', color: '#65676b' }}>
 {post.is_boosted && <span style={{ fontWeight: 'bold' }}>• Ad </span>}
 {formatTime(post.created_at)} · {post.province}
 </div>
 </div>
 
 <div style={{ position: 'relative' }}>
 <button 
   ref={(el) => { menu.menuButtonRefs.current[post.id] = el; }}
   onClick={() => menu.setActiveMenu(menu.activeMenuState === post.id ? null : post.id)} 
   style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer' }}
 >
 <svg width="18" height="18" viewBox="0 0 24 24" fill="#65676b"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg>
 </button>
 {menu.activeMenuState === post.id && (
 <div style={{ position: 'absolute', right: 0, top: '40px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '8px', zIndex: 150, width: '140px', border: '1px solid #eee', overflow: 'hidden' }}>
 {isPostOwner(post, session) ? (
 <>
 <div onClick={() => { menu.setActiveMenu(null); router.push(`/edit-post/${post.id}`); }} style={{ padding: '12px 15px', fontSize: '14px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>ແກ້ໄຂ</div>
 <div onClick={() => { handleDeletePost(post.id); }} style={{ padding: '12px 15px', fontSize: '14px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>ລົບ</div>
 <div onClick={() => { menu.setActiveMenu(null); router.push(`/boost_post?id=${post.id}`); }} style={{ padding: '12px 15px', fontSize: '14px', cursor: 'pointer' }}>Boost Post</div>
 </>
 ) : (
 <div style={{ padding: '12px 15px', fontSize: '14px', cursor: 'pointer' }}>ລາຍງານ</div>
 )}
 </div>
 )}
 </div>
 </div>
 <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{post.caption}</div>
 <PhotoGrid images={post.images || []} onPostClick={() => viewingPostHook.handleViewPost(post, 0, setPost, () => {})} />
 </div>

 {/* 3. แท็บแจ้งเตือน */}
 <div style={{ position: 'sticky', top: '53px', background: '#fff', zIndex: 90 }}>
 <div style={{ display: 'flex', borderBottom: '1px solid #ddd' }}>
 {[{ key: 'likes', icon: '❤️', c: (post.likes || 0) + (post.likes_guest || 0) }, { key: 'saves', icon: '🔖', c: (post.saves || 0) + (post.saves_guest || 0) }, { key: 'shares', icon: '🔗', c: (post.shares || 0) + (post.shares_guest || 0) }].map((t) => (
 <div key={t.key} onClick={() => setActiveTab(t.key as any)} style={{ flex: 1, textAlign: 'center', padding: '15px', cursor: 'pointer', borderBottom: activeTab === t.key ? '3px solid #1877f2' : 'none', color: activeTab === t.key ? '#1877f2' : '#65676b', fontWeight: 'bold' }}>
 {t.icon} {t.c || 0}
 </div>
 ))}
 </div>
 </div>

 {/* รายชื่อ Users - แสดงผลได้ทั้ง User และ Guest */}
 <div style={{ paddingBottom: '100px' }}>
 {listLoading ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}><div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div></div> : 
 userList.map((user, idx) => (
 <div key={idx} style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f0f0f0' }}>
 <img 
 src={user.avatar_url} 
 style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', background: '#f0f0f0' }} 
 alt="user"
 />
 <div style={{ fontWeight: '600', color: user.username === 'User' ? '#888' : '#000' }}>
 {user.username}
 </div>
 </div>
 ))
 }
 </div>

 {/* 4. Viewing Post Modal - Using shared components */}
 {viewingPostHook.viewingPost && (
   <Suspense fallback={null}>
     <ViewingPostModal
       viewingPost={viewingPostHook.viewingPost}
       session={session}
       isViewingModeOpen={viewingPostHook.isViewingModeOpen}
       viewingModeDragOffset={viewingPostHook.viewingModeDragOffset}
       viewingModeIsDragging={viewingPostHook.viewingModeIsDragging}
       savedScrollPosition={viewingPostHook.savedScrollPosition}
       onClose={() => {
         viewingPostHook.setIsViewingModeOpen(false);
         setTimeout(() => {
           viewingPostHook.setViewingPost(null);
           window.scrollTo(0, viewingPostHook.savedScrollPosition);
         }, 300);
       }}
       onTouchStart={viewingPostHook.handleViewingModeTouchStart}
       onTouchMove={viewingPostHook.handleViewingModeTouchMove}
       onTouchEnd={(e: React.TouchEvent) => viewingPostHook.handleViewingModeTouchEnd(e, () => {})}
       onImageClick={(images: string[], index: number) => {
         fullScreenViewer.setFullScreenImages(images);
         fullScreenViewer.setCurrentImgIndex(index);
       }}
     />
   </Suspense>
 )}

 {/* 5. Full Screen Image Viewer - Using shared component */}
 {fullScreenViewer.fullScreenImages && (
   <Suspense fallback={null}>
     <FullScreenImageViewer
       images={fullScreenViewer.fullScreenImages}
       currentImgIndex={fullScreenViewer.currentImgIndex}
       fullScreenDragOffset={fullScreenViewer.fullScreenDragOffset}
       fullScreenVerticalDragOffset={fullScreenViewer.fullScreenVerticalDragOffset}
       fullScreenIsDragging={fullScreenViewer.fullScreenIsDragging}
       fullScreenTransitionDuration={fullScreenViewer.fullScreenTransitionDuration}
       fullScreenShowDetails={fullScreenViewer.fullScreenShowDetails}
       fullScreenZoomScale={fullScreenViewer.fullScreenZoomScale}
       fullScreenZoomOrigin={fullScreenViewer.fullScreenZoomOrigin}
       activePhotoMenu={fullScreenViewer.activePhotoMenu}
       isPhotoMenuAnimating={fullScreenViewer.isPhotoMenuAnimating}
       showDownloadBottomSheet={fullScreenViewer.showDownloadBottomSheet}
       isDownloadBottomSheetAnimating={fullScreenViewer.isDownloadBottomSheetAnimating}
       showImageForDownload={fullScreenViewer.showImageForDownload}
       onClose={() => {
         fullScreenViewer.setFullScreenImages(null);
         if (fullScreenViewer.activePhotoMenu !== null) {
           setTimeout(() => {
             fullScreenViewer.setActivePhotoMenu(null);
           }, 300);
         }
       }}
       onTouchStart={fullScreenViewer.fullScreenOnTouchStart}
       onTouchMove={fullScreenViewer.fullScreenOnTouchMove}
       onTouchEnd={fullScreenViewer.fullScreenOnTouchEnd}
       onClick={fullScreenViewer.fullScreenOnClick}
       onDownload={fullScreenViewer.downloadImage}
       onImageIndexChange={fullScreenViewer.setCurrentImgIndex}
       onPhotoMenuToggle={fullScreenViewer.setActivePhotoMenu}
       onDownloadBottomSheetClose={() => {
         fullScreenViewer.setIsDownloadBottomSheetAnimating(true);
         setTimeout(() => {
           fullScreenViewer.setShowDownloadBottomSheet(false);
           fullScreenViewer.setIsDownloadBottomSheetAnimating(false);
         }, 300);
       }}
       onDownloadBottomSheetDownload={() => {
         if (fullScreenViewer.showImageForDownload) {
           fullScreenViewer.downloadImage(fullScreenViewer.showImageForDownload);
         }
       }}
       onImageForDownloadClose={() => fullScreenViewer.setShowImageForDownload(null)}
     />
   </Suspense>
 )}
 </main>
 );
}
