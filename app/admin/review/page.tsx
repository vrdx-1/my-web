'use client'
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminReviewPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- States สำหรับการแสดงผล (แกะมาจาก reporting/page.tsx) ---
  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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

        // 2. โหลดทีละโพสต์ (Sequential Loading)
        for (let i = 0; i < idsData.length; i++) {
          const postId = idsData[i].id;
          
          // โหลดทีละโพสต์
          const { data: postData, error: postError } = await supabase
            .from('cars')
            .select(`
              *,
              profiles:user_id (
                username,
                avatar_url,
                last_seen
              )
            `)
            .eq('id', postId)
            .single();

          if (!postError && postData) {
            // เพิ่มโพสต์เข้า state ทีละโพสต์
            setPosts(prev => {
              const existingIds = new Set(prev.map(p => p.id));
              if (!existingIds.has(postData.id)) {
                return [...prev, postData];
              }
              return prev;
            });
          }
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
    } else {
      alert(`Error: ${error.message}`);
    }
  };

  // --- Helper Functions (แกะมาจาก reporting/page.tsx เป๊ะๆ) ---
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

  const PhotoGrid = ({ images, onPostClick }: { images: string[], onPostClick: () => void }) => {
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
<style>{`
@keyframes fadeColor { 0%, 100% { background: #f0f0f0; } 12.5% { background: #1a1a1a; } 25% { background: #4a4a4a; } 37.5% { background: #6a6a6a; } 50% { background: #8a8a8a; } 62.5% { background: #b0b0b0; } 75% { background: #d0d0d0; } 87.5% { background: #e5e5e5; } }
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
<div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
</div>
);

  return (
    <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', background: '#f0f2f5', minHeight: '100vh' }}>
      
      <div style={{ width: '100%' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px' }}>Review Posts (24h) - {posts.length}</h2>
        {posts.length === 0 && <div style={{ background: '#fff', padding: '40px', textAlign: 'center', borderRadius: '8px' }}>ບໍ່ມີໂພສໃໝ່ໃນ 24 ຊົ່ວໂມງນີ້</div>}
        
        {posts.map((post) => {
          const status = getOnlineStatus(post.profiles?.last_seen);
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
              
              {/* ฝั่งซ้าย: โพสต์ฟีด */}
              <div style={{ flex: '1.2', background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                <div style={{ padding: '12px 15px 8px 15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}>
                    {post.profiles?.avatar_url && <img src={post.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
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
                      {formatTime(post.created_at)} · {post.province}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{post.caption}</div>
                <PhotoGrid images={post.images || []} onPostClick={() => setViewingPost(post)} />

                {/* Stats Bar */}
                <div style={{ borderTop: '1px solid #f0f2f5', padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#65676b' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{post.likes || 0}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#65676b' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>{post.views || 0}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#65676b' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{post.saves || 0}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', color: '#65676b' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14L21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                      <span style={{ fontSize: '14px', fontWeight: '600', marginLeft: '4px' }}>{post.shares || 0}</span>
                    </div>
                  </div>
                </div>
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
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {viewingPost.profiles?.username || 'User'}
                      {(() => {
                        const status = getOnlineStatus(viewingPost.profiles?.last_seen);
                        return status.isOnline ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div>
                            <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
                          </div>
                        ) : (
                          status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#65676b', lineHeight: '16px' }}>
                      {formatTime(viewingPost.created_at)} · {viewingPost.province}
                    </div>
                </div>
            </div>

            <div style={{ padding: '10px 15px 20px 15px', fontSize: '16px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
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
