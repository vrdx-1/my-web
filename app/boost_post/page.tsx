"use client";

import { useState, useEffect, Suspense } from "react"; // เพิ่ม Suspense
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { X, CheckCircle2 } from "lucide-react";
import { PageSpinner } from "@/components/LoadingSpinner";

// สร้าง Component แยกเพื่อจัดการ Logic เดิมทั้งหมด
function BoostPostContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = searchParams.get("id");
  const supabase = createClient();

  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<{ name: string; price: string; days: number; qr_url: string } | null>(null);
  const [dbStatus, setDbStatus] = useState<string | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const packages = [
    { 
      name: "24 ຊົ່ວໂມງ", 
      price: "10.000 ກີບ", 
      days: 1, 
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-31%20at%2013.25.20.jpeg" 
    },
    { 
      name: "3 ມື້", 
      price: "30.000 ກີບ", 
      days: 3, 
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-31%20at%2013.26.13.jpeg" 
    },
    { 
      name: "5 ມື້", 
      price: "50.000 ກີບ", 
      days: 5, 
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-31%20at%2013.27.12.jpeg" 
    },
    { 
      name: "7 ມື້", 
      price: "70.000 ກີບ", 
      days: 7, 
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-31%20at%2013.28.12.jpeg" 
    },
    { 
      name: "10 ມື້", 
      price: "100.000 ກີບ", 
      days: 10, 
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-31%20at%2013.28.51.jpeg" 
    },
    {
      name: "15 ມື້",
      price: "150.000 ກີບ",
      days: 15,
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-31%20at%2013.29.37.jpeg",
    },
    {
      name: "20 ມື້",
      price: "200.000 ກີບ",
      days: 20,
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-31%20at%2013.30.27.jpeg",
    },
    {
      name: "30 ມື້",
      price: "300.000 ກີບ",
      days: 30,
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-31%20at%2013.31.06.jpeg",
    },
  ];

  useEffect(() => {
    async function checkExistingBoost() {
      if (!postId) {
        setStep(1);
        setCheckingStatus(false);
        return;
      }
      try {
        console.log("กำลังตรวจสอบสถานะของ postId:", postId);
        const { data, error } = await supabase
          .from("post_boosts")
          .select("status")
          .eq("post_id", postId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const currentStatus = data[0].status;
          console.log("พบข้อมูลสถานะในระบบ:", currentStatus);
          setDbStatus(currentStatus);
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
  }, [postId, supabase]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow selecting the same file again (some browsers won't fire onChange if the same file is chosen)
    e.target.value = "";
    if (!file || !postId || !selectedPkg) return;

    setLoading(true);
    setSubmitError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDbStatus("error");
        setSubmitError("NOT_LOGGED_IN");
        setStep(3);
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
        user_id: user.id,
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
      setStep(3);
    } catch (error: any) {
      console.error(error);
      setDbStatus("error");
      setSubmitError(error?.message || "UNKNOWN_ERROR");
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

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
          <div className="fixed inset-0 bg-white flex items-center justify-center p-6 z-50">
            <div className="w-full max-w-sm border-2 border-gray-300 rounded-2xl p-8 relative text-center">
              <button onClick={() => router.push("/")} className="absolute top-4 right-4 text-gray-400"><X size={24} /></button>
              {dbStatus === "pending" ? (
                <>
                  <h2 className="text-3xl font-bold mb-4 text-yellow-600">ກຳລັງກວດສອບ</h2>
                  <p className="text-xl text-gray-700">ລະບົບກຳລັງກວດສອບการ Boost Post <br /> ຂອງທ່ານ.</p>
                </>
              ) : dbStatus === "error" ? (
                <>
                  <h2 className="text-2xl font-bold mb-3 text-red-600">ສົ່ງບໍ່ສຳເລັດ</h2>
                  <p className="text-gray-700">
                    ກະລຸນາລອງໃໝ່ (ກວດສອບອິນເຕີເນັດ / ການລ໋ອກອິນ).
                  </p>
                  {submitError && (
                    <div className="mt-3 text-left text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="font-bold text-gray-700 mb-1">Error</div>
                      <div className="break-words">{submitError}</div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-colors active:scale-[0.99]"
                  >
                    ລອງອີກຄັ້ງ
                  </button>
                </>
              ) : (
                <>
                  <CheckCircle2 size={64} className="mx-auto text-green-500 mb-4" />
                  <h2 className="text-3xl font-bold mb-4 text-green-600">ໂພສ Boost ສຳເລັດ</h2>
                  <p className="text-gray-600">ຂອບໃຈທີ່ໃຊ້ບໍລິການ</p>
                </>
              )}
            </div>
          </div>
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
      {showHowTo && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowHowTo(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-lg">ວິທີຍິງໂຄສະນາ</div>
              <button
                type="button"
                onClick={() => setShowHowTo(false)}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 text-sm text-gray-700 space-y-3">
              <div className="font-bold text-gray-900">ຂັ້ນຕອນ</div>
              <ol className="list-decimal pl-5 space-y-2">
                <li>ເລືອກ Package ທີ່ຕ້ອງການ Boost.</li>
                <li>ສະແກນ QR ແລະໂອນເງິນຕາມຈຳນວນທີ່ສະແດງ.</li>
                <li>ກົດ “ແຈ້ງສະລິບການໂອນ” ແລະອັບໂຫຼດຮູບສະລິບ.</li>
                <li>ລໍຖ້າລະບົບກວດສອບ ແລະຢືນຢັນ.</li>
              </ol>
              <div className="text-xs text-gray-500">
                * ຫາກມີບັນຫາ ກະລຸນາກວດສອບຄວາມຊັດເຈນຂອງຮູບສະລິບ.
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowHowTo(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-colors active:scale-[0.99]"
              >
                ປິດ
              </button>
            </div>
          </div>
        </div>
      )}
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
