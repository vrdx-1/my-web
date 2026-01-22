'use client'
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';

export default function NotificationDetail() {
 const router = useRouter();
 const { id } = useParams();

 // --- States หลัก ---
 const [post, setPost] = useState<any>(null);
 const [session, setSession] = useState<any>(null);
 const [activeMenu, setActiveMenu] = useState<string | null>(null);
 const [viewingPost, setViewingPost] = useState<any | null>(null);
 const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
 const [currentImgIndex, setCurrentImgIndex] = useState(0);
 const [activePhotoMenu, setActivePhotoMenu] = useState<number | null>(null);
 const [touchStart, setTouchStart] = useState<number | null>(null);

 // --- States สำหรับแท็บด้านล่าง ---
 const [activeTab, setActiveTab] = useState<'likes' | 'saves' | 'shares'>('likes');
 const [userList, setUserList] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
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
 if (data) setPost(data);
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

 // --- Helper Functions (เลียนแบบ Logic หน้า Home) ---
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
 if (diffInHours < 24) return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${diffInHours} ຊົ່ວໂມງທີ່ແລ້ວ` };
 return { isOnline: false, text: `ອອນລາຍລ່າສຸດ ${Math.floor(diffInHours / 24)} ມື้ທີ່ແລ້ว` };
 };

 const formatTime = (dateString: string) => {
 const diffInSeconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
 if (diffInSeconds < 60) return 'ເມື່ອຄູ່';
 if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} ນາທີ`;
 if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ຊົ່ວໂມງ`;
 return new Date(dateString).toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' });
 };

 const isPostOwner = (p: any) => {
 if (session && String(p.user_id) === String(session.user.id)) return true;
 const stored = JSON.parse(localStorage.getItem('my_guest_posts') || '[]');
 return stored.some((item: any) => String(item.post_id) === String(p.id));
 };

 // --- Action Functions (ใช้งานได้จริง) ---
 const handleDeletePost = async (postId: string) => {
 if (!confirm("ທ່ານແນ່ໃຈຫຼືບໍ່ວ່າຕ້ອງການລົບໂພສນີ້?")) return;
 const { error } = await supabase.from('cars').delete().eq('id', postId);
 if (!error) {
 alert("ລົບໂພສສຳເລັດແລ້ວ");
 router.back();
 } else {
 alert("ເກີดຂໍ้ຜິດພາດ: " + error.message);
 }
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
 <div key={i} style={{ position: 'relative', height: count === 2 ? '300px' : '200px' }}>
 <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
 {i === 3 && count > 4 && (
 <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>+{count - 4}</div>
 )}
 </div>
 ))}
 </div>
 );
 };

 if (loading || !post) return (
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

 const status = getOnlineStatus(post.profiles?.last_seen);

 return (
 <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh', position: 'relative', fontFamily: 'sans-serif' }}>
 
 {/* 1. Header คลีนๆ ตามที่สั่ง */}
 <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 100, borderBottom: '1px solid #f0f0f0' }}>
 <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', marginRight: '15px' }}>←</button>
 <span style={{ fontWeight: 'bold', fontSize: '18px' }}>ລາຍລະອຽດໂພສ</span>
 </div>

 {/* 2. ฟีดสไตล์หน้า Home */}
 <div style={{ borderBottom: '8px solid #f0f2f5' }}>
 <div style={{ padding: '12px 15px 8px 15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}>
 <img src={post.profiles?.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
 <button onClick={() => setActiveMenu(activeMenu === post.id ? null : post.id)} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer' }}>
 <svg width="18" height="18" viewBox="0 0 24 24" fill="#65676b"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg>
 </button>
 {activeMenu === post.id && (
 <div style={{ position: 'absolute', right: 0, top: '40px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '8px', zIndex: 150, width: '140px', border: '1px solid #eee', overflow: 'hidden' }}>
 {isPostOwner(post) ? (
 <>
 <div onClick={() => router.push(`/edit-post/${post.id}`)} style={{ padding: '12px 15px', fontSize: '14px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>ແກ້ໄຂ</div>
 <div onClick={() => handleDeletePost(post.id)} style={{ padding: '12px 15px', fontSize: '14px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>ລົບ</div>
 <div onClick={() => router.push(`/boost_post?id=${post.id}`)} style={{ padding: '12px 15px', fontSize: '14px', cursor: 'pointer' }}>Boost Post</div>
 </>
 ) : (
 <div style={{ padding: '12px 15px', fontSize: '14px', cursor: 'pointer' }}>ລາຍງານ</div>
 )}
 </div>
 )}
 </div>
 </div>
 <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{post.caption}</div>
 <PhotoGrid images={post.images || []} onPostClick={() => setViewingPost(post)} />
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

 {/* 4. Viewing Mode */}
 {viewingPost && (() => {
 const vStatus = getOnlineStatus(viewingPost.profiles?.last_seen);
 return (
 <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 2000, overflowY: 'auto' }}>
 <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
 <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}>
 <img src={viewingPost.profiles?.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
 </div>
 <div>
 <div style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
 {viewingPost.profiles?.username}
 {vStatus.isOnline && <div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div>}
 </div>
 <div style={{ fontSize: '12px', color: '#65676b' }}>{formatTime(viewingPost.created_at)} · {viewingPost.province}</div>
 </div>
 </div>
 <button onClick={() => setViewingPost(null)} style={{ background: '#f0f2f5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
 </div>
 <div style={{ padding: '15px', fontSize: '16px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{viewingPost.caption}</div>
 {viewingPost.images.map((img: string, idx: number) => (
 <img key={idx} src={img} onClick={() => { setFullScreenImages(viewingPost.images); setCurrentImgIndex(idx); }} style={{ width: '100%', marginBottom: '24px', cursor: 'pointer', display: 'block' }} />
 ))}
 </div>
 )
 })()}

 {/* 5. Full Screen Mode */}
 {fullScreenImages && (
 <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000, display: 'flex', flexDirection: 'column' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
 <div style={{ padding: '15px', display: 'flex', justifyContent: 'flex-end', gap: '15px', alignItems: 'center' }}>
 <div style={{ position: 'relative' }}>
 <button onClick={(e) => { e.stopPropagation(); setActivePhotoMenu(activePhotoMenu === currentImgIndex ? null : currentImgIndex); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
 <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><circle cx="5" cy="12" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /></svg>
 </button>
 {activePhotoMenu === currentImgIndex && (
 <div style={{ position: 'absolute', right: 0, top: '45px', background: '#fff', borderRadius: '8px', width: '130px', zIndex: 3100, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
 <div onClick={() => downloadImage(fullScreenImages[currentImgIndex])} style={{ padding: '15px', fontSize: '14px', cursor: 'pointer', color: '#000', fontWeight: 'bold', textAlign: 'center' }}>ບັນທຶກຮູບ</div>
 </div>
 )}
 </div>
 <button onClick={() => { setFullScreenImages(null); setActivePhotoMenu(null); }} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
 </div>
 
 <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
 <div style={{ display: 'flex', transition: 'transform 0.3s ease-out', transform: `translateX(-${currentImgIndex * 100}%)`, width: '100%' }}>
 {fullScreenImages.map((img, idx) => (
 <div key={idx} style={{ minWidth: '100%', display: 'flex', justifyContent: 'center' }}>
 <img src={img} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
 </div>
 ))}
 </div>
 </div>
 
 <div style={{ padding: '20px', textAlign: 'center', color: '#fff', fontWeight: 'bold', fontSize: '16px', background: 'rgba(0,0,0,0.3)' }}>
 {currentImgIndex + 1} / {fullScreenImages.length}
 </div>
 </div>
 )}
 </main>
 );
}
