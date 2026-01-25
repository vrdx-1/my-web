'use client'
import { useState, useEffect, Suspense, lazy } from 'react';
import { AdminPostCard } from '@/components/AdminPostCard';
import { formatTime, getOnlineStatus } from '@/utils/postUtils';
import { PhotoGrid } from '@/components/PhotoGrid';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';

// Dynamic Imports
const ViewingPostModal = lazy(() => 
  import('@/components/modals/ViewingPostModal').then(m => ({ default: m.ViewingPostModal }))
) as React.LazyExoticComponent<React.ComponentType<any>>;
const FullScreenImageViewer = lazy(() => 
  import('@/components/modals/FullScreenImageViewer').then(m => ({ default: m.FullScreenImageViewer }))
) as React.LazyExoticComponent<React.ComponentType<any>>;

export default function AdminReportingPage() {
 const [reports, setReports] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

 // --- States สำหรับการแสดงผล (ยกมาจาก app/page.tsx) ---
 const [viewingPost, setViewingPost] = useState<any | null>(null);
 const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
 const [currentImgIndex, setCurrentImgIndex] = useState(0);

 const supabase = createAdminSupabaseClient();

 useEffect(() => {
 fetchReports();
 }, []);

 const fetchReports = async () => {
 setLoading(true);
 try {
 // 1. ดึง ID ของรายงานทั้งหมด
 const { data: reportsData, error: reportsError } = await supabase
 .from('reports')
 .select('id, car_id')
 .eq('status', 'pending')
 .order('created_at', { ascending: false });

 if (reportsError) throw reportsError;

 if (reportsData && reportsData.length > 0) {
 setReports([]); // รีเซ็ต reports

 // 2. Batch loading: ดึง reports และ cars ทั้งหมดในครั้งเดียว
 const reportIds = reportsData.map(r => r.id);
 const carIds = reportsData.map(r => r.car_id);

 // โหลด reports ทั้งหมด
 const { data: allReportsData, error: reportsError } = await supabase
 .from('reports')
 .select('id, car_id, reason, status, created_at, user_id')
 .in('id', reportIds);

 // โหลด cars ทั้งหมด
 const { data: allCarsData, error: carsError } = await supabase
 .from('cars')
 .select('id, caption, province, images, status, created_at, user_id, profiles!cars_user_id_fkey(username, avatar_url, last_seen)')
 .in('id', carIds);

 if (!reportsError && !carsError && allReportsData && allCarsData) {
   // สร้าง map สำหรับ cars
   const carsMap = new Map(allCarsData.map(car => [car.id, car]));
   
   // รวม reports กับ cars
   const combinedData = allReportsData.map(reportData => {
     const carData = carsMap.get(reportData.car_id);
     return { ...reportData, cars: carData };
   });

   // เพิ่ม reports เข้า state
   setReports(prev => {
     const existingIds = new Set(prev.map(r => r.id));
     const newReports = combinedData.filter(r => !existingIds.has(r.id));
     return [...prev, ...newReports];
   });

   // ตั้งค่า selectedReportId สำหรับรายงานแรก
   if (combinedData.length > 0) {
     setSelectedReportId(combinedData[0].id);
   }
 }
 } else {
 setReports([]);
 }
 } catch (err) {
 console.error("Fetch Error:", err);
 } finally {
 setLoading(false);
 }
 };

 // Removed duplicate functions - using from utils/postUtils and components/PhotoGrid

 // --- ฟังก์ชันจัดการ Admin ---
 const handleIgnore = async (reportId: string) => {
 if (!confirm('ຢືນຢັນການ Remove ແລະ ລຶບລາຍງານນີ້ຖາວອນ?')) return;
 const { error } = await supabase.from('reports').delete().eq('id', reportId);
 if (!error) {
 const updatedReports = reports.filter(r => r.id !== reportId);
 setReports(updatedReports);
 if (updatedReports.length > 0) setSelectedReportId(updatedReports[0].id);
 else setSelectedReportId(null);
 } else {
 alert(`Error: ${error.message}`);
 }
 };

 // ฟังก์ชันใหม่: เปลี่ยนจากลบเป็นการซ่อน (Shadow Ban)
 const handleHidePost = async (reportId: string, carId: string) => {
 if (!confirm('ຢືນຢັນການ Hide ໂພສນີ້? (ຜູ້ໃຊ້ອື່ນຈະບໍ່ເຫັນ ແຕ່ຂໍ້ມູນຍັງຄົງຢູ່)')) return;
 
 // 1. อัปเดตตาราง cars ให้ is_hidden = true
 const { error: carError } = await supabase
 .from('cars')
 .update({ is_hidden: true })
 .eq('id', carId);

 if (!carError) {
 // 2. ลบรายการ report ออกเพื่อให้ Admin ทำงานชิ้นอื่นต่อได้
 await supabase.from('reports').delete().eq('id', reportId);
 
 const updatedReports = reports.filter(r => r.id !== reportId);
 setReports(updatedReports);
 if (updatedReports.length > 0) setSelectedReportId(updatedReports[0].id);
 else setSelectedReportId(null);
 alert('ຊ່ອນໂພສຮຽບຮ້ອຍແລ້ວ');
 } else {
 alert(`Error: ${carError.message}`);
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
 <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px' }}>ລາຍງານທັງໝົດ ( {reports.length} )</h2>
 {reports.length === 0 && <EmptyState message="ບໍ່ມີລາຍງານຄ້າງຢູ່" variant="card" />}
 
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

 {/* Caption */}
 <div style={{ padding: '0 15px 10px 15px', fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{post.caption}</div>
 
 {/* Media */}
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

 {/* ฝั่งขวา: รายละเอียด Admin (ของใครของมัน ขนานข้างโพสต์) */}
 <div style={{ flex: '0.8', background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #ffebeb' }}>
 <h3 style={{ color: '#d33', fontWeight: 'bold', fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
 ⚠️ ລາຍລະອຽດການລາຍງານ
 </h3>
 <div style={{ marginBottom: '15px' }}>
 <p style={{ fontSize: '13px', color: '#65676b', marginBottom: '2px' }}>ຜູ້ລາຍງານ:</p>
 <p style={{ fontSize: '14px', fontWeight: '500' }}>{report.reporter_email}</p>
 </div>
 <div style={{ background: '#fff5f5', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #d33', marginBottom: '20px' }}>
 <p style={{ fontWeight: 'bold', color: '#d33', fontSize: '13px', marginBottom: '4px' }}>ສາເຫດ:</p>
 <p style={{ fontSize: '15px', color: '#1c1e21' }}>"{report.reason}"</p>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
 <button 
 onClick={() => handleIgnore(report.id)} 
 style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background: '#f0f2f5', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
 >
 Remove
 </button>
 <button 
 onClick={() => handleHidePost(report.id, report.car_id)} 
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
       viewingModeIsDragging={false}
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
       fullScreenVerticalDragOffset={0}
       fullScreenIsDragging={false}
       fullScreenTransitionDuration={300}
       fullScreenShowDetails={false}
       fullScreenZoomScale={1}
       fullScreenZoomOrigin={{ x: 0, y: 0 }}
       activePhotoMenu={null}
       isPhotoMenuAnimating={false}
       showDownloadBottomSheet={false}
       isDownloadBottomSheetAnimating={false}
       showImageForDownload={null}
       onClose={() => setFullScreenImages(null)}
       onTouchStart={() => {}}
       onTouchMove={() => {}}
       onTouchEnd={() => {}}
       onClick={() => {}}
       onDownload={() => {}}
       onImageIndexChange={setCurrentImgIndex}
       onPhotoMenuToggle={() => {}}
       onDownloadBottomSheetClose={() => {}}
       onDownloadBottomSheetDownload={() => {}}
       onImageForDownloadClose={() => {}}
     />
   </Suspense>
 )}
 </main>
 );
}
