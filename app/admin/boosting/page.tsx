"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase as supabaseClient } from "@/lib/supabase";
import { Check, X, Clock, ExternalLink, Trash2, Heart, Eye, Bookmark, Share2 } from "lucide-react";
import { AdminPostCard } from "@/components/AdminPostCard";
import { formatTime, getOnlineStatus } from "@/utils/postUtils";
import { PhotoGrid } from "@/components/PhotoGrid";
import { lazyNamed } from "@/utils/lazyLoad";

// Dynamic Imports
const ViewingPostModal = lazyNamed(
  () => import('@/components/modals/ViewingPostModal'),
  'ViewingPostModal'
);
const FullScreenImageViewer = lazyNamed(
  () => import('@/components/modals/FullScreenImageViewer'),
  'FullScreenImageViewer'
);

export default function AdminBoostingPage() {
  const supabase = supabaseClient;
  const [activeTab, setActiveTab] = useState<"waiting" | "boosting">("waiting");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- States สำหรับ Viewing Mode ---
  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [fullScreenSlip, setFullScreenSlip] = useState<string | null>(null);

  const fetchBoosts = async () => {
    setLoading(true);
    const statusFilter = activeTab === "waiting" ? "pending" : "success";
    
    // 1. ดึง ID ของ boost ทั้งหมด
    const { data: boostsData, error: boostsError } = await supabase
      .from("post_boosts")
      .select('id, post_id')
      .eq("status", statusFilter)
      .order("created_at", { ascending: false });

    if (boostsError) {
      console.error("Error fetching boosts:", boostsError);
      setLoading(false);
      return;
    }

    if (boostsData && boostsData.length > 0) {
      setItems([]); // รีเซ็ต items

      // 2. Batch loading: ดึง boosts และ posts ทั้งหมดในครั้งเดียว
      const boostIds = boostsData.map(b => b.id);
      const postIds = boostsData.map(b => b.post_id);

      // โหลด boosts ทั้งหมด
      const { data: allBoostsData, error: boostsError } = await supabase
        .from("post_boosts")
        .select('id, post_id, status, slip_url, price, package_name, boost_days, expires_at, created_at')
        .in('id', boostIds);

      // โหลด posts ทั้งหมด
      const { data: allCarsData, error: carsError } = await supabase
        .from("cars")
        .select('id, caption, province, images, status, created_at, user_id, profiles!cars_user_id_fkey(username, avatar_url, last_seen)')
        .in('id', postIds);

      if (!boostsError && !carsError && allBoostsData && allCarsData) {
        // สร้าง map สำหรับ cars
        const carsMap = new Map(allCarsData.map(car => [car.id, car]));
        
        // รวม boosts กับ cars
        const combinedData = allBoostsData.map(boostData => {
          const carData = carsMap.get(boostData.post_id);
          return { ...boostData, cars: carData };
        });

        // เพิ่ม items เข้า state
        setItems(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const newItems = combinedData.filter(item => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      }
    } else {
      setItems([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchBoosts();
  }, [activeTab]);

  // Removed duplicate functions - using from shared utils/components

  const handleApprove = async (item: any) => {
    if (!confirm("ຢືນຢັນການອະນຸມັດການ Boost?")) return;
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + item.boost_days);
      
      // บังคับเปลี่ยนแท็บล่วงหน้า (Optimistic UI)
      setActiveTab("boosting");

      const { error: boostError } = await supabase
        .from("post_boosts")
        .update({ status: "success", expires_at: expiryDate.toISOString() })
        .eq("id", item.id);
      const { error: carError } = await supabase
        .from("cars")
        .update({ is_boosted: true, boost_expiry: expiryDate.toISOString() })
        .eq("id", item.post_id);
      
      if (boostError || carError) {
         throw new Error("Update failed - ตรวจสอบ RLS ใน Supabase Dashboard");
      }

      fetchBoosts(); // โหลดข้อมูลใหม่หลังจากเปลี่ยนแท็บ
    } catch (err: any) { 
      setActiveTab("waiting"); // ถ้าพังให้กลับมาหน้าเดิม
      fetchBoosts();
    }
  };

  const handleDecline = async (item: any) => {
    const msg = item.status === "pending" ? "ຢືນຢັນການປະຕິເສດ ແລະ ລຶບລາຍການນີ້?" : "ຢືນຢັນການຍົກເລີກການ Boost?";
    if (!confirm(msg)) return;
    try {
      await supabase.from("cars").update({ is_boosted: false, boost_expiry: null }).eq("id", item.post_id);
      await supabase.from("post_boosts").update({ status: "reject" }).eq("id", item.id);
      fetchBoosts();
    } catch (err) { }
  };

  const hasRenderableItems = items.some((item) => Boolean(item?.cars));

  return (
    <main className="max-w-[1200px] mx-auto p-5 bg-[#f0f2f5] min-h-screen">
      <div className="flex flex-col items-center mb-10 space-y-4">
        <h2 className="text-xl font-bold text-gray-800">Boosting Management ({items.length})</h2>
        <div className="flex bg-gray-200/50 p-1.5 rounded-2xl border border-gray-300 shadow-inner">
          <button 
            onClick={() => setActiveTab("waiting")} 
            className={`px-10 py-2.5 rounded-xl font-black transition-all text-sm uppercase tracking-wider ${activeTab === 'waiting' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Waiting
          </button>
          <button 
            onClick={() => setActiveTab("boosting")} 
            className={`px-10 py-2.5 rounded-xl font-black transition-all text-sm uppercase tracking-wider ${activeTab === 'boosting' ? 'bg-white text-green-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Boosting
          </button>
        </div>
      </div>

      {!loading && !hasRenderableItems && (
        <div className="w-full flex items-center justify-center py-24">
          <div className="text-gray-500 font-semibold text-base">ບໍ່ມີລາຍການ</div>
        </div>
      )}

      <div className="space-y-12">
        {items.map((item) => {
          const post = item.cars;
          if (!post) return null;
          const status = getOnlineStatus(post.profiles?.last_seen);
          const slipFullUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/slips/${item.slip_url}`;

          return (
            <div key={item.id} className="flex flex-col lg:flex-row gap-6 items-stretch justify-center max-w-[1000px] mx-auto">
              
              {/* ฝั่งซ้าย: โพสต์ฟีด - ใช้ AdminPostCard */}
              <div className="flex-1">
                <AdminPostCard
                  post={post}
                  index={0}
                  onViewPost={(p) => setViewingPost(p)}
                  showStats={true}
                />
              </div>

              <div className="w-full lg:w-[320px] bg-white rounded-xl p-5 shadow-sm border border-gray-200 flex flex-col">
                <p className="text-[11px] font-black text-gray-400 uppercase mb-3 tracking-widest text-center">Transfer Slip</p>
                
                <div 
                  onClick={() => setFullScreenSlip(slipFullUrl)}
                  className="relative aspect-[3/4] w-full bg-gray-100 rounded-lg border overflow-hidden cursor-zoom-in group mb-4"
                >
                  <img src={slipFullUrl} className="w-full h-full object-contain p-1" />
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white/90 p-2 rounded-full shadow-lg text-gray-700"><Eye size={20} /></div>
                  </div>
                </div>

                <div className="bg-blue-50/80 border border-blue-100 rounded-lg p-3 text-center mb-5">
                   <p className="text-[10px] text-blue-500 font-bold uppercase mb-1">Package</p>
                   <p className="text-sm font-black text-blue-900 leading-tight">
                    {item.package_name} <br/>
                    <span className="text-blue-600">{item.price?.toLocaleString()} ກີບ</span>
                   </p>
                </div>

                <div className="mt-auto flex gap-2">
                  {item.status === 'pending' ? (
                    <>
                      <button 
                        onClick={() => handleApprove(item)} 
                        className="flex-[2] bg-blue-600 text-white h-12 rounded-lg font-black text-sm hover:bg-blue-700 transition-transform active:scale-95 shadow-md shadow-blue-100 uppercase"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleDecline(item)} 
                        className="flex-1 bg-gray-50 text-red-500 border border-red-100 h-12 rounded-lg font-bold text-xs hover:bg-red-50 transition-colors uppercase"
                      >
                        decline
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => handleDecline(item)} 
                      className="w-full bg-orange-50 text-orange-600 border border-orange-200 h-12 rounded-lg font-black text-xs flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors uppercase"
                    >
                      <Trash2 size={16} /> Cancel Boost
                    </button>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {viewingPost && (
        <div className="fixed inset-0 bg-white z-[2000] overflow-y-auto">
          <div className="max-w-[600px] mx-auto pb-20">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10 shadow-sm">
              <span className="font-black text-gray-800 uppercase tracking-tight">Post Details</span>
              <button onClick={() => setViewingPost(null)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl hover:bg-gray-200 transition-colors">✕</button>
            </div>
            
            <div className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gray-200 overflow-hidden shrink-0 shadow-inner">
                {viewingPost.profiles?.avatar_url && <img src={viewingPost.profiles.avatar_url} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[15px] flex items-center gap-1.5 min-w-0">
                  <span className="min-w-0 flex-1 truncate">
                    {viewingPost.profiles?.username || 'User'}
                  </span>
                  {(() => {
                    const status = getOnlineStatus(viewingPost.profiles?.last_seen);
                    return (
                      <>
                        {status.isOnline && <div className="w-2.5 h-2.5 bg-[#31a24c] rounded-full border border-white shadow-sm" />}
                        <span className="text-[12px] text-[#31a24c] font-bold shrink-0">{status.text}</span>
                      </>
                    )
                  })()}
                </div>
                <div className="text-[12px] text-gray-500">{formatTime(viewingPost.created_at)} · {viewingPost.province}</div>
              </div>
            </div>

            <div className="px-4 py-3 text-[17px] whitespace-pre-wrap leading-relaxed text-gray-800">{viewingPost.caption}</div>
            
            <div className="space-y-1.5 mt-4">
              {viewingPost.images?.map((img: string, i: number) => (
                <img key={i} src={img} onClick={() => { setFullScreenImages(viewingPost.images); setCurrentImgIndex(i); }} className="w-full cursor-zoom-in" />
              ))}
            </div>
          </div>
        </div>
      )}

      {fullScreenSlip && (
        <div className="fixed inset-0 bg-black/95 z-[4000] flex flex-col p-6 animate-in fade-in duration-200">
          <div className="flex justify-end mb-4">
            <button 
              onClick={() => setFullScreenSlip(null)} 
              className="w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center text-2xl transition-all"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
             <img src={fullScreenSlip} className="max-w-full max-h-full object-contain rounded-sm shadow-2xl shadow-black/50" />
          </div>
        </div>
      )}

      {fullScreenImages && (
        <div className="fixed inset-0 bg-black z-[3000] flex flex-col p-6">
          <div className="flex justify-end mb-4">
            <button onClick={() => setFullScreenImages(null)} className="w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center text-2xl">✕</button>
          </div>
          <div className="flex-1 flex items-center justify-center">
             <img src={fullScreenImages[currentImgIndex]} className="max-w-full max-h-[85vh] object-contain shadow-2xl" />
          </div>
          <div className="py-8 text-white text-center font-black tracking-widest">{currentImgIndex + 1} / {fullScreenImages.length}</div>
        </div>
      )}
    </main>
  );
}
