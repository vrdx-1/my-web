'use client'
import { useState, useEffect, Suspense } from 'react';
import { formatTime, getOnlineStatus } from '@/utils/postUtils';
import { PhotoGrid } from '@/components/PhotoGrid';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { formatCompactNumber } from '@/utils/currency';
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
 const [reports, setReports] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

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
     {error}
   </div>
 )}
 {reports.length === 0 && !error && <EmptyState message="ບໍ່ມີລາຍງານຄ້າງຢູ່" variant="card" />}
 
 {reports.map((report) => {
 const post = report.cars;
 if (!post) return null;
 const status = getOnlineStatus(post.profiles?.last_seen);
 
 return (
 <div key={report.id} style={{ display: 'flex', gap: '15px', marginBottom: '30px', alignItems: 'flex-start' }}>
 
 {/* ฝั่งซ้าย: โพสต์ฟีด (เหมือนหน้าแรก) */}
 <div style={{ flex: '1.2', background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
 {/* Header: รูปโปรไฟล์ + ออนไลน์ + เวลา + แขวง */}
 <div style={{ padding: '12px 15px 8px 15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb', overflow: 'hidden' }}>
 {post.profiles?.avatar_url && <img src={post.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
 </div>
 <div style={{ flex: 1, minWidth: 0 }}>
 <div style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '20px', display: 'flex', alignItems: 'center', gap: '5px', color: '#111111' }}>
<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, color: '#111111' }}>
              {post.profiles?.username || 'User'}
            </span>
 {status.isOnline ? (
 <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
 <div style={{ width: '10px', height: '10px', background: '#31a24c', borderRadius: '50%', border: '1.5px solid #fff' }}></div>
 <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>{status.text}</span>
 </div>
 ) : (
 status.text && <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal', flexShrink: 0 }}>{status.text}</span>
 )}
 </div>
 <div style={{ fontSize: '12px', color: '#4a4d52', lineHeight: '16px' }}>
 {formatTime(post.created_at)} · {post.province}
 </div>
 </div>
 </div>

 {/* Caption */}
 <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap', color: '#111111' }}>{post.caption}</div>
 
 {/* Media */}
 <PhotoGrid images={post.images || []} onPostClick={() => setViewingPost(post)} />

 {/* Stats Bar */}
 <div style={{ borderTop: '1px solid #f0f2f5', padding: '10px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4a4d52' }}>
 <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a4d52" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
 <span style={{ fontSize: '14px', fontWeight: '600', color: '#111111' }}>{formatCompactNumber(post.likes || 0)}</span>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4a4d52' }}>
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a4d52" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
 <span style={{ fontSize: '14px', fontWeight: '500', color: '#111111' }}>{formatCompactNumber(post.views || 0)}</span>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4a4d52' }}>
 <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a4d52" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
 <span style={{ fontSize: '14px', fontWeight: '600', color: '#111111' }}>{formatCompactNumber(post.saves || 0)}</span>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', color: '#4a4d52' }}>
 <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a4d52" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14L21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
 <span style={{ fontSize: '14px', fontWeight: '600', marginLeft: '4px', color: '#111111' }}>{formatCompactNumber(post.shares || 0)}</span>
 </div>
 </div>
 </div>
 </div>

 {/* ฝั่งขวา: รายละเอียด Admin (ของใครของมัน ขนานข้างโพสต์) */}
 <div style={{ flex: '0.8', background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #ffebeb' }}>
 <h3 style={{ color: '#d33', fontWeight: 'bold', fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
 ⚠️ ລາຍລະອຽດການລາຍງານ
 </h3>
 <div style={{ marginBottom: '15px' }}>
 <p style={{ fontSize: '13px', color: '#4a4d52', marginBottom: '2px' }}>ຜູ້ລາຍງານ:</p>
 <p style={{ fontSize: '14px', fontWeight: '500', color: '#111111' }}>{report.reporter_email}</p>
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
