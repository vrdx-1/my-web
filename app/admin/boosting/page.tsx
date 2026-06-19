"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase as supabaseClient } from "@/lib/supabase";
import { Trash2, Eye } from "lucide-react";
import { PostCard } from "@/components/PostCard";
import { formatTime } from "@/utils/postUtils";
import { lazyNamed } from "@/utils/lazyLoad";
import { invalidateFeedCacheClient } from "@/utils/invalidateFeedCacheClient";

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
  const router = useRouter();
  const fromPath = '/admin/boosting';
  const supabase = supabaseClient;
  const [activeTab, setActiveTab] = useState<"boosting" | "sold">("boosting");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMenuState, setActiveMenuState] = useState<string | null>(null);
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);
  const [savedPosts] = useState<{ [key: string]: boolean }>({});
  const [justSavedPosts] = useState<{ [key: string]: boolean }>({});
  const menuButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // --- States สำหรับ Viewing Mode ---
  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [fullScreenSlip, setFullScreenSlip] = useState<string | null>(null);

  const fetchBoosts = async () => {
    setLoading(true);
    setItems([]);

    if (activeTab === "sold") {
      // แท็บ SOLD: โพสต์ที่ขายแล้ว (ຂາຍແລ້ວ) — แสดง boost ที่ถูกปิดอัตโนมัติ
      const { data: soldCarsData, error: soldCarsError } = await supabase
        .from("cars")
        .select('id')
        .eq("status", "sold");
      if (soldCarsError || !soldCarsData?.length) {
        setLoading(false);
        return;
      }
      const soldPostIds = soldCarsData.map((c: { id: string }) => c.id);
      const { data: boostsData, error: boostsError } = await supabase
        .from("post_boosts")
        .select('id, post_id, status, slip_url, price, package_name, boost_days, expires_at, created_at')
        .in('post_id', soldPostIds)
        .order("created_at", { ascending: false });
      if (boostsError || !boostsData?.length) {
        setLoading(false);
        return;
      }
      const { data: allCarsData, error: carsError } = await supabase
        .from("cars")
        .select('id, short_id, caption, price, price_currency, province, images, layout, status, created_at, user_id, likes, shares, is_hidden, is_boosted, profiles!cars_user_id_fkey(username, avatar_url, phone, is_verified)')
        .in('id', soldPostIds);
      if (carsError || !allCarsData?.length) {
        setLoading(false);
        return;
      }
      const carsMap = new Map(allCarsData.map((car: any) => [car.id, car]));
      const combinedData = boostsData.map((boostData: any) => ({
        ...boostData,
        cars: carsMap.get(boostData.post_id),
      }));
      setItems(combinedData);
      setLoading(false);
      return;
    }

    const statusFilter = "success";

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
      // 2. Batch loading: ดึง boosts และ posts ทั้งหมดในครั้งเดียว
      const boostIds = boostsData.map(b => b.id);
      const postIds = boostsData.map(b => b.post_id);

      // โหลด boosts ทั้งหมด
      const { data: allBoostsData, error: boostsErr } = await supabase
        .from("post_boosts")
        .select('id, post_id, status, slip_url, price, package_name, boost_days, expires_at, created_at')
        .in('id', boostIds);

      // โหลด posts ทั้งหมด
      const { data: allCarsData, error: carsError } = await supabase
        .from("cars")
        .select('id, short_id, caption, price, price_currency, province, images, layout, status, created_at, user_id, likes, shares, is_hidden, is_boosted, profiles!cars_user_id_fkey(username, avatar_url, phone, is_verified)')
        .in('id', postIds);

      if (!boostsErr && !carsError && allBoostsData && allCarsData) {
        const carsMap = new Map(allCarsData.map(car => [car.id, car]));

        let combinedData = allBoostsData.map((boostData) => {
          const carData = carsMap.get(boostData.post_id);
          return { ...boostData, cars: carData };
        });

        // กรอง Boost ที่หมดอายุแล้วไม่ให้แสดงในหน้า Admin (แท็บ Boosting)
        if (statusFilter === "success") {
          const now = Date.now();
          combinedData = combinedData.filter((item) => {
            if (!item.expires_at) return true;
            const expiresAtTime = new Date(item.expires_at as string).getTime();
            return Number.isFinite(expiresAtTime) && expiresAtTime > now;
          });
          // แท็บ Boosting: ไม่แสดงโพสต์ที่ขายแล้ว (ຂາຍແລ້ວ) — ระบบปิด boost อัตโนมัติแล้ว
          combinedData = combinedData.filter((item) => item?.cars?.status !== "sold");
        }

        // แท็บ Boosting: ใหม่อยู่บน
        combinedData = [...combinedData].sort((a, b) => {
          const ta = new Date((a as any).created_at).getTime();
          const tb = new Date((b as any).created_at).getTime();
          return tb - ta;
        });

        setItems(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const newItems = combinedData.filter(item => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchBoosts();
  }, [activeTab]);

  // Removed duplicate functions - using from shared utils/components

  const handleDecline = async (item: any) => {
    const msg = "ຢືນຢັນການຍົກເລີກການ Boost?";
    if (!confirm(msg)) return;
    try {
      await supabase.from("cars").update({ is_boosted: false, boost_expiry: null }).eq("id", item.post_id);
      await supabase.from("post_boosts").update({ status: "reject" }).eq("id", item.id);
      invalidateFeedCacheClient();
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
            onClick={() => setActiveTab("boosting")} 
            className={`px-10 py-2.5 rounded-xl font-black transition-all text-sm uppercase tracking-wider ${activeTab === 'boosting' ? 'bg-white text-green-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Boosting
          </button>
          <button 
            onClick={() => setActiveTab("sold")} 
            className={`px-10 py-2.5 rounded-xl font-black transition-all text-sm uppercase tracking-wider ${activeTab === 'sold' ? 'bg-white text-amber-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            SOLD
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
          const slipFullUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/slips/${item.slip_url}`;

          return (
            <div key={item.id} className="flex flex-col lg:flex-row gap-6 items-stretch justify-center max-w-[1000px] mx-auto">
              
              {/* ฝั่งซ้าย: โพสต์ฟีด - ใช้ PostCard ร่วมกับหน้าโฮม */}
              <div className="flex-1">
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
                  {activeTab === 'sold' ? (
                    <div className="w-full bg-amber-50 text-amber-700 border border-amber-200 rounded-lg py-3 px-4 text-center font-bold text-xs uppercase tracking-wider">
                      ປິດ Boost ອັດຕະໂນມັດ (ຂາຍແລ້ວ)
                    </div>
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
