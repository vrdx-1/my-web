'use client'
import { useState, useEffect, Suspense } from 'react';
import { AdminPostCard } from '@/components/AdminPostCard';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { EmptyState } from '@/components/EmptyState';
import { formatTime, getOnlineStatus } from '@/utils/postUtils';
import { PhotoGrid } from '@/components/PhotoGrid';
import { lazyNamed } from '@/utils/lazyLoad';
import { PageSpinner } from '@/components/LoadingSpinner';

// Dynamic Imports
const ViewingPostModal = lazyNamed(
  () => import('@/components/modals/ViewingPostModal'),
  'ViewingPostModal'
);
const FullScreenImageViewer = lazyNamed(
  () => import('@/components/modals/FullScreenImageViewer'),
  'FullScreenImageViewer'
);

export default function AdminReviewPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- States สำหรับการแสดงผล (แกะมาจาก reporting/page.tsx) ---
  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const supabase = createAdminSupabaseClient();

  useEffect(() => {
    fetchRecentPosts();
  }, []);

  const fetchRecentPosts = async () => {
    setLoading(true);
    try {
      // ดึงข้อมูลย้อนหลัง 24 ชั่วโมง
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // 1. ดึง ID ของโพสต์ทั้งหมด
      const { data: idsData, error: idsError } = await supabase
        .from('cars')
        .select('id')
        .gt('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false });

      if (idsError) throw idsError;

      if (idsData && idsData.length > 0) {
        setPosts([]); // รีเซ็ต posts

        // 2. Batch loading: ดึง posts ทั้งหมดในครั้งเดียว
        const postIds = idsData.map(p => p.id);
        
        const { data: postsData, error: postsError } = await supabase
          .from('cars')
          .select('id, caption, province, images, status, created_at, user_id, profiles!cars_user_id_fkey(username, avatar_url, last_seen)')
          .in('id', postIds)
          .order('created_at', { ascending: false });

        if (!postsError && postsData) {
          // เพิ่ม posts เข้า state
          setPosts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newPosts = postsData.filter(p => !existingIds.has(p.id));
            return [...prev, ...newPosts];
          });
        }
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- ฟังก์ชันจัดการ Hide / Unhide (Shadow Hide) ---
  const toggleHidePost = async (postId: string, currentHiddenStatus: boolean) => {
    const actionText = currentHiddenStatus ? 'ຍົກເລີກການຊ່ອນ (Unhide)' : 'ຊ່ອນໂພສ (Hide)';
    if (!confirm(`ຢືນຢັນການ ${actionText}?`)) return;

    const { error } = await supabase
      .from('cars')
      .update({ is_hidden: !currentHiddenStatus })
      .eq('id', postId);

    if (!error) {
      setPosts(posts.map(p => p.id === postId ? { ...p, is_hidden: !currentHiddenStatus } : p));
    }
  };

  // --- Helper Functions (แกะมาจาก reporting/page.tsx เป๊ะๆ) ---
  // Removed duplicate functions - using from shared utils/components
  const getOnlineStatusOld_removed = (lastSeen: string | null) => {
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
    return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${Math.floor(diffInHours / 24)} ມື້ທີ່ແລ้ວ` };
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
    return new Date(dateString).toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' });
  };

  // Removed duplicate PhotoGrid - using from components/PhotoGrid.tsx
  const PhotoGridOld_removed = ({ images, onPostClick }: { images: string[], onPostClick: () => void }) => {
    const count = images?.length || 0;
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

  if (loading) return (
<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
<PageSpinner />
</div>
);

  return (
    <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', background: '#f0f2f5', minHeight: '100vh' }}>
      
      <div style={{ width: '100%' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', color: '#111111' }}>Review Posts (24h) - {posts.length}</h2>
        {posts.length === 0 && <EmptyState message="ບໍ່ມີໂພສໃໝ່ໃນ 24 ຊົ່ວໂມງນີ້" variant="card" />}
        
        {posts.map((post, index) => {
          const isHidden = post.is_hidden === true;
          
          return (
            <div key={post.id} style={{ 
              display: 'flex', 
              gap: '15px', 
              marginBottom: '30px', 
              alignItems: 'flex-start',
              opacity: isHidden ? 0.5 : 1,
              filter: isHidden ? 'grayscale(1)' : 'none'
            }}>
              
              {/* ฝั่งซ้าย: โพสต์ฟีด - ใช้ AdminPostCard */}
              <div style={{ flex: '1.2' }}>
                <AdminPostCard
                  post={post}
                  index={index}
                  onViewPost={(p) => setViewingPost(p)}
                  showStats={true}
                />
              </div>

              {/* ฝั่งขวา: ปุ่มควบคุม */}
              <div style={{ flex: '0.8', background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: isHidden ? '1px solid #ddd' : '1px solid #ffebeb' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button 
                    onClick={() => toggleHidePost(post.id, isHidden)} 
                    style={{ 
                      padding: '12px', borderRadius: '8px', border: 'none', 
                      background: isHidden ? '#4b4f56' : '#d33', 
                      color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' 
                    }}
                  >
                    {isHidden ? 'Unhide' : 'Hide'}
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Modals ดูรูปภาพ (Viewing Mode) */}
      {viewingPost && (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 2000, overflowY: 'auto' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
              <span style={{ fontWeight: 'bold' }}>ລາຍລະອຽດໂພສ</span>
              <button onClick={() => setViewingPost(null)} style={{ background: '#f0f2f5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>✕</button>
            </div>
            
            {/* Header ใน Modal: แสดงโปรไฟล์ครบถ้วนแบบหน้าฟีด */}
            <div style={{ padding: '12px 15px 8px 15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}>
                    {viewingPost.profiles?.avatar_url && <img src={viewingPost.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '5px', color: '#111111' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                        {viewingPost.profiles?.username || 'User'}
                      </span>
                      {(() => {
                        const status = getOnlineStatus(viewingPost.profiles?.last_seen);
                        return status.isOnline ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div>
                            <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
                          </div>
                        ) : (
                          status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal', flexShrink: 0 }}>{status.text}</span>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4a4d52', lineHeight: '16px' }}>
                      {formatTime(viewingPost.created_at)} · {viewingPost.province}
                    </div>
                </div>
            </div>

            <div style={{ padding: '10px 15px 20px 15px', fontSize: '16px', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: '#111111' }}>
              {viewingPost.caption}
            </div>

            {/* รูปภาพใน Modal: เมื่อคลิกจะเข้าสู่ Full Screen */}
            {viewingPost.images?.map((img: string, i: number) => (
              <img 
                key={i} 
                src={img} 
                onClick={() => { setFullScreenImages(viewingPost.images); setCurrentImgIndex(i); }} 
                style={{ width: '100%', marginBottom: '10px', cursor: 'pointer', display: 'block' }} 
              />
            ))}
          </div>
        </div>
      )}

      {/* Full Screen Images */}
      {fullScreenImages && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '15px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setFullScreenImages(null)} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={fullScreenImages[currentImgIndex]} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
          </div>
          <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>{currentImgIndex + 1} / {fullScreenImages.length}</div>
        </div>
      )}
    </main>
  );
}
