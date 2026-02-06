"use client";

import { useState, useEffect, Suspense } from "react"; // เพิ่ม Suspense
import { useRouter, useSearchParams } from "next/navigation";
import { supabase as supabaseClient } from "@/lib/supabase";
import { X, CheckCircle2 } from "lucide-react";
import { PageSpinner } from "@/components/LoadingSpinner";
import { BoostAdDetailsPopup } from "@/components/modals/BoostAdDetailsPopup";
import { BoostHowToModal } from "@/components/modals/BoostHowToModal";
import { BOOST_PACKAGES } from "@/data/boostPackages";

// สร้าง Component แยกเพื่อจัดการ Logic เดิมทั้งหมด
function BoostPostContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = searchParams.get("id");
  const supabase = supabaseClient;

  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<{ name: string; price: string; days: number; qr_url: string } | null>(null);
  const [dbStatus, setDbStatus] = useState<string | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [isRedirectingToRegister, setIsRedirectingToRegister] = useState(false);

  const packages = BOOST_PACKAGES;

  useEffect(() => {
    async function checkExistingBoost() {
      // Guest users must create an account before boosting
      const { data: sessionData } = await supabase.auth.getSession();
      let session = sessionData.session;
      if (!session) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        session = refreshed.session ?? null;
      }
      if (!session) {
        setIsRedirectingToRegister(true);
        router.replace("/register");
        return;
      }

      if (!postId) {
        setStep(1);
        setCheckingStatus(false);
        return;
      }
      try {
        console.log("กำลังตรวจสอบสถานะของ postId:", postId);
        const { data, error } = await supabase
          .from("post_boosts")
          .select("status, expires_at")
          .eq("post_id", postId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          const currentStatus = data[0].status;
          console.log("พบข้อมูลสถานะในระบบ:", currentStatus);
          setDbStatus(currentStatus);
          setExpiresAt((data[0] as any)?.expires_at ?? null);
          setJustSubmitted(false);
          setStep(3); 
        } else {
          console.log("ไม่พบข้อมูลการ Boost เดิม");
          setStep(1); 
        }
      } catch (err) {
        console.error("เกิดข้อผิดพลาด:", err);
        setStep(1);
      } finally {
        setCheckingStatus(false);
      }
    }
    checkExistingBoost();
  }, [postId, router, supabase]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow selecting the same file again (some browsers won't fire onChange if the same file is chosen)
    e.target.value = "";
    if (!file || !postId || !selectedPkg) return;

    setLoading(true);
    setSubmitError(null);
    try {
      // If admin already rejected this post, block further submissions (anti-spam)
      const { data: latestBoost, error: latestBoostError } = await supabase
        .from("post_boosts")
        .select("status")
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (latestBoostError) throw latestBoostError;
      if (latestBoost && latestBoost[0]?.status === "reject") {
        setDbStatus("reject");
        setExpiresAt(null);
        setJustSubmitted(false);
        setStep(3);
        return;
      }

      // Allow both logged-in and guest submissions (user_id is nullable in DB)
      const { data: sessionData } = await supabase.auth.getSession();
      let userId = sessionData.session?.user?.id ?? null;
      if (!userId) {
        // If user is actually logged in but session isn't loaded yet, try refresh once.
        const { data: refreshed } = await supabase.auth.refreshSession();
        userId = refreshed.session?.user?.id ?? null;
      }
      if (!userId) {
        setIsRedirectingToRegister(true);
        router.replace("/register");
        return;
      }

      // Use a unique name to avoid "already exists" upload errors
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${postId}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("slips")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("post_boosts").insert({
        post_id: postId,
        user_id: userId,
        package_name: selectedPkg.name,
        boost_days: selectedPkg.days, 
        price: parseInt(selectedPkg.price.replace(/\D/g, "")),
        slip_url: fileName,
        status: "pending",
      });

      if (dbError) {
        // Cleanup uploaded file ถ้า insert ล้มเหลว
        if (uploadData?.path) {
          await supabase.storage.from("slips").remove([uploadData.path]).catch(() => {});
        }
        throw dbError;
      }

      setDbStatus("pending");
      setExpiresAt(null);
      setJustSubmitted(true);
      setStep(3);
    } catch (error: any) {
      console.error(error);
      setDbStatus("error");
      setSubmitError(error?.message || "UNKNOWN_ERROR");
      setJustSubmitted(false);
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  if (isRedirectingToRegister) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <PageSpinner />
      </div>
    );
  }

  if (checkingStatus) return <div className="p-10 text-center font-bold">ກຳລັງກວດສອບຂໍ້ມູນ...</div>;

  return (
    <div className="min-h-screen bg-white pb-10">
      <div
        style={{
          padding: "10px 15px",
          display: "flex",
          alignItems: "center",
          gap: "0",
          position: "sticky",
          top: 0,
          background: "#fff",
          zIndex: 10,
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div
          style={{
            width: "72px",
            flexShrink: 0,
            display: "flex",
            justifyContent: "flex-start",
          }}
        >
          <button
            onClick={() => (step === 2 ? setStep(1) : router.push("/"))}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1c1e21",
              padding: "5px",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </div>

        <h3
          style={{
            flex: 1,
            textAlign: "center",
            margin: 0,
            fontSize: "18px",
            fontWeight: "bold",
            minWidth: 0,
          }}
        >
          ຍິງໂຄສະນາ
        </h3>
        <div style={{ width: "72px", flexShrink: 0 }} aria-hidden />
      </div>

      <div className="max-w-md mx-auto p-4">
        {step === 1 && (
          <div className="space-y-4 pt-4">
            {packages.map((pkg) => (
              <button
                key={pkg.name}
                onClick={() => {
                  setSelectedPkg(pkg);
                  setStep(2);
                }}
                className="w-full bg-white border border-gray-200 p-4 rounded-2xl flex justify-between items-center shadow-sm hover:shadow-md hover:border-violet-300 transition-all duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                <span className="text-base font-semibold">{pkg.name}</span>
                <span className="text-base font-bold text-violet-600">{pkg.price}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && selectedPkg && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border mt-4 text-center">
            <div className="w-64 h-64 mx-auto mb-6 flex items-center justify-center rounded-lg overflow-hidden border">
              <img 
                src={selectedPkg.qr_url} 
                alt={`QR Code ${selectedPkg.name}`} 
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-gray-600 mb-8 text-sm">ກະລຸນາແຈ້ງສະລິບການໂອນ ຫຼັງຈາກທ່ານໂອນສຳເລັດ</p>
            <label className="block w-full bg-blue-600 text-white py-4 rounded-xl font-bold cursor-pointer hover:bg-blue-700 transition-colors relative overflow-hidden">
              {loading ? "ກຳລັງສົ່ງ..." : "ແຈ້ງສະລິບການໂອນ"}
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileUpload}
                accept="image/*"
                disabled={loading}
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <BoostAdDetailsPopup
            show={true}
            status={dbStatus}
            expiresAt={expiresAt}
            justSubmitted={justSubmitted}
            submitError={submitError}
            onClose={() => router.push("/")}
            onRetry={() => setStep(2)}
          />
        )}
      </div>

      {/* แท็บวิธีการ Boost Post */}
      <button
        type="button"
        onClick={() => setShowHowTo(true)}
        className="fixed bottom-5 right-5 z-40 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded-full shadow-lg hover:shadow-xl ring-2 ring-blue-200 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
      >
        ວິທີຍິງໂຄສະນາ
      </button>

      {/* Modal อธิบายขั้นตอน */}
      <BoostHowToModal show={showHowTo} onClose={() => setShowHowTo(false)} />
    </div>
  );
}

// ฟังก์ชันหลักที่ส่งออก โดยหุ้มด้วย Suspense เพื่อแก้ Build Error
export default function BoostPostPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><PageSpinner /></div>}>
      <BoostPostContent />
    </Suspense>
  );
}
