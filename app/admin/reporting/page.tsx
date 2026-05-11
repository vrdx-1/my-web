'use client'

/* eslint-disable react/no-unescaped-entities */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatTimeAgo } from '@/utils/formatTime';
import { PostCard } from '@/components/PostCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { lazyNamed } from '@/utils/lazyLoad';

// Dynamic Imports
const ViewingPostModal = lazyNamed(
  () => import('@/components/modals/ViewingPostModal'),
  'ViewingPostModal'
);
const FullScreenImageViewer = lazyNamed(
  () => import('@/components/modals/FullScreenImageViewer'),
  'FullScreenImageViewer'
);

const REPORTS_API = '/api/admin/reports';

export default function AdminReportingPage() {
 const router = useRouter();
 const fromPath = '/admin/reporting';
 const [reports, setReports] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
 const [activeMenuState, setActiveMenuState] = useState<string | null>(null);
 const [isMenuAnimating, setIsMenuAnimating] = useState(false);
 const [savedPosts] = useState<{ [key: string]: boolean }>({});
 const [justSavedPosts] = useState<{ [key: string]: boolean }>({});
 const menuButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

 // --- States สำหรับการแสดงผล (ยกมาจาก app/page.tsx) ---
 const [viewingPost, setViewingPost] = useState<any | null>(null);
 const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
 const [currentImgIndex, setCurrentImgIndex] = useState(0);

 useEffect(() => {
   fetchReports();
 }, []);

 const fetchReports = async () => {
   setLoading(true);
   setError(null);
   try {
     const res = await fetch(REPORTS_API, { credentials: 'include' });
     if (!res.ok) {
       const j = await res.json().catch(() => ({}));
       setError(j?.error || `Error ${res.status}`);
       setReports([]);
       return;
     }
     const json = await res.json();
     const list = json.reports ?? [];
     setReports(list);
     if (list.length > 0) setSelectedReportId(list[0].id);
     else setSelectedReportId(null);
   } catch (err) {
     console.error('Fetch Error:', err);
     setError(err instanceof Error ? err.message : 'Failed to load reports');
     setReports([]);
   } finally {
     setLoading(false);
   }
 };

 // Removed duplicate functions - using from utils/postUtils and components/PhotoGrid

 // --- ฟังก์ชันจัดการ Admin ---
 const handleIgnore = async (reportId: string) => {
   if (!confirm('ຢືນຢັນການ Remove ແລະ ລຶບລາຍງານນີ້ຖາວອນ?')) return;
   const res = await fetch(`${REPORTS_API}?id=${encodeURIComponent(reportId)}`, {
     method: 'DELETE',
     credentials: 'include',
   });
   if (res.ok) {
     const updatedReports = reports.filter((r) => r.id !== reportId);
     setReports(updatedReports);
     if (updatedReports.length > 0) setSelectedReportId(updatedReports[0].id);
     else setSelectedReportId(null);
   }
 };

 const handleHidePost = async (reportId: string, carId: string, report?: any) => {
   const rid = reportId != null ? String(reportId) : '';
   const cid = carId != null ? String(carId) : (report?.cars?.id != null ? String(report.cars.id) : '');
   if (!rid || !cid) return;
   if (!confirm('ຢືນຢັນການ Hide ໂພສນີ້? (ຜູ້ໃຊ້ອື່ນຈະບໍ່ເຫັນ ແຕ່ຂໍ້ມູນຍັງຄົງຢູ່)')) return;
   const res = await fetch(REPORTS_API, {
     method: 'PATCH',
     credentials: 'include',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ reportId: rid, carId: cid, action: 'hide' }),
   });
   if (res.ok) {
     const updatedReports = reports.filter((r) => r.id !== reportId);
     setReports(updatedReports);
     if (updatedReports.length > 0) setSelectedReportId(updatedReports[0].id);
     else setSelectedReportId(null);
   }
 };

 // Removed duplicate PhotoGrid - using from components/PhotoGrid.tsx

 if (loading) {
   return (
     <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
       <LoadingSpinner />
     </div>
   );
 }

 return (
 <main style={LAYOUT_CONSTANTS.ADMIN_CONTAINER}>
 
 <div style={{ width: '100%' }}>
 <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', color: '#111111' }}>ລາຍງານທັງໝົດ ( {reports.length} )</h2>
 {error && (
   <div style={{ marginBottom: '16px', padding: '12px', background: '#fff5f5', border: '1px solid #ffccc7', borderRadius: '8px', color: '#cf1322' }}>
     {error === 'Server configuration missing'
       ? 'ບໍ່ມີ SUPABASE_SERVICE_ROLE_KEY ໃນ .env.local (ຫຼື environment ຂອງ server). ເພີ່ມຕົວແປນີ້ແລ້ວ redeploy.'
       : error}
   </div>
 )}
 {reports.length === 0 && !error && <EmptyState message="ບໍ່ມີລາຍງານຄ້າງຢູ່" variant="card" />}
 
 {reports.map((report) => {
 const post = report.cars;
 if (!post) return null;
 
 return (
 <div key={report.id} style={{ display: 'flex', gap: '15px', marginBottom: '30px', alignItems: 'flex-start' }}>
 
 <div style={{ flex: '1.2' }}>
 <PostCard
 post={post}
 index={0}
 isLastElement={false}
 showMenuButton={false}
 session={null}
 savedPosts={savedPosts}
 justSavedPosts={justSavedPosts}
 activeMenuState={activeMenuState}
 isMenuAnimating={isMenuAnimating}
 menuButtonRefs={menuButtonRefs}
 onViewPost={(p) => setViewingPost(p)}
 onSave={() => {}}
 onShare={() => {}}
 onTogglePostStatus={() => {}}
 onDeletePost={() => {}}
 onReport={() => {}}
 onProfileClick={(p) => {
   if (!p?.user_id) return;
   router.push(`/admin/top-user/${encodeURIComponent(String(p.user_id))}?from=${encodeURIComponent(fromPath)}`);
 }}
 onSetActiveMenu={setActiveMenuState}
 onSetMenuAnimating={setIsMenuAnimating}
 />
 </div>

 {/* ฝั่งขวา: รายละเอียด Admin (ของใครของมัน ขนานข้างโพสต์) */}
 <div style={{ flex: '0.8', background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #ffebeb' }}>
 <h3 style={{ color: '#d33', fontWeight: 'bold', fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
 ⚠️ ລາຍລະອຽດການລາຍງານ
 </h3>
 <div style={{ marginBottom: '15px' }}>
 <p style={{ fontSize: '13px', color: '#4a4d52', marginBottom: '6px' }}>ຜູ້ລາຍງານ:</p>
 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
   {report.reporter_profile ? (
     <>
       {report.reporter_profile.avatar_url ? (
         <img src={report.reporter_profile.avatar_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
       ) : (
         <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e4e6eb' }} />
       )}
       <span style={{ fontSize: '14px', fontWeight: '500', color: '#111111' }}>{report.reporter_profile.username || report.reporter_email}</span>
     </>
   ) : (
     <span style={{ fontSize: '14px', fontWeight: '500', color: '#111111' }}>{report.reporter_email}</span>
   )}
 </div>
 <p style={{ fontSize: '13px', color: '#65676b', marginTop: '4px' }}>({formatTimeAgo(report.created_at)})</p>
 </div>
 <div style={{ background: '#fff5f5', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #d33', marginBottom: '20px' }}>
 <p style={{ fontWeight: 'bold', color: '#d33', fontSize: '13px', marginBottom: '4px' }}>ສາເຫດ:</p>
 <p style={{ fontSize: '15px', color: '#1c1e21' }}>"{report.reason}"</p>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
 <button 
 onClick={() => handleIgnore(report.id)} 
 style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background: '#f0f2f5', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: '#111111' }}
 >
 Remove
 </button>
 <button 
 onClick={() => handleHidePost(report.id, report.car_id, report)} 
 style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#d33', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
 >
 Hide
 </button>
 </div>
 </div>

 </div>
 );
 })}
 </div>

 {/* Viewing Post Modal - Using shared components */}
 {viewingPost && (
   <Suspense fallback={null}>
     <ViewingPostModal
       viewingPost={viewingPost}
       session={null}
       isViewingModeOpen={true}
       viewingModeDragOffset={0}
       savedScrollPosition={0}
       onClose={() => setViewingPost(null)}
       onTouchStart={() => {}}
       onTouchMove={() => {}}
       onTouchEnd={() => {}}
       onImageClick={(images: string[], index: number) => {
         setFullScreenImages(images);
         setCurrentImgIndex(index);
       }}
     />
   </Suspense>
 )}

 {/* Full Screen Images - Using shared component */}
 {fullScreenImages && (
   <Suspense fallback={null}>
     <FullScreenImageViewer
       images={fullScreenImages}
       currentImgIndex={currentImgIndex}
       fullScreenDragOffset={0}
       fullScreenTransitionDuration={300}
       fullScreenShowDetails={false}
       onClose={() => setFullScreenImages(null)}
       onTouchStart={() => {}}
       onTouchMove={() => {}}
       onTouchEnd={() => {}}
       onClick={() => {}}
     />
   </Suspense>
 )}
 </main>
 );
}
