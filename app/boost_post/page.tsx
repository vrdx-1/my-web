"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ChevronLeft, X, CheckCircle2 } from "lucide-react";

export default function BoostPostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = searchParams.get("id");
  const supabase = createClient();

  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<{ name: string; price: string; days: number; qr_url: string } | null>(null);
  const [dbStatus, setDbStatus] = useState<string | null>(null);

  // แก้ไข: เพิ่ม qr_url ให้ตรงกับแต่ละแพ็กเกจที่คุณระบุมา
  const packages = [
    { 
      name: "24 ຊົ່ວໂມງ", 
      price: "10.000 ກີບ", 
      days: 1, 
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-11%20at%2014.36.10.jpeg" 
    },
    { 
      name: "3 ມື້", 
      price: "30.000 ກີບ", 
      days: 3, 
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-11%20at%2014.36.21.jpeg" 
    },
    { 
      name: "5 ມື້", 
      price: "50.000 ກີບ", 
      days: 5, 
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-11%20at%2014.36.31.jpeg" 
    },
    { 
      name: "7 ມື้", 
      price: "70.000 ກີບ", 
      days: 7, 
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-11%20at%2014.36.41.jpeg" 
    },
    { 
      name: "10 ມື້", 
      price: "100.000 ກີບ", 
      days: 10, 
      qr_url: "https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/slips/WhatsApp%20Image%202026-01-11%20at%2015.42.06.jpeg" 
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
    if (!file || !postId || !selectedPkg) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("กรุณาเข้าสู่ระบบก่อนทำรายการ");
        return;
      }

      const fileName = `${Date.now()}_${postId}.jpg`;
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

      if (dbError) throw dbError;

      setDbStatus("pending");
      setStep(3);
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) return <div className="p-10 text-center font-bold">ກຳລັງກວດສອບຂໍ້ມູນ...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white p-4 flex items-center border-b sticky top-0 z-10">
        {/* แก้ไขปุ่มย้อนกลับ: ถ้าอยู่ Step 2 ให้กลับไป Step 1 ถ้าอย่างอื่นให้ไปหน้า Home */}
        <button 
          onClick={() => step === 2 ? setStep(1) : router.push("/")} 
          className="p-2"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center font-bold text-lg">Boost ໂພສ</h1>
        <div className="w-10"></div>
      </div>

      <div className="max-w-md mx-auto p-4">
        {step === 1 && (
          <div className="space-y-4 pt-4">
            {packages.map((pkg) => (
              <button key={pkg.name} onClick={() => { setSelectedPkg(pkg); setStep(2); }} className="w-full bg-white border-2 border-gray-200 p-6 rounded-xl flex justify-between items-center hover:border-blue-500 transition-all active:scale-95">
                <span className="text-xl font-medium">{pkg.name}</span>
                <span className="text-xl font-bold text-blue-600">{pkg.price}</span>
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
            <div className="text-lg mb-2">ທ່ານເລືອກ Package</div>
            <div className="inline-block border-2 border-black px-4 py-1 rounded-md font-bold mb-4">{selectedPkg.name} {selectedPkg.price}</div>
            <p className="text-gray-600 mb-8 text-sm">ກະລຸນາແຈ້ງສະລິບການໂອນ ຫຼັງຈາກທ່ານໂອນສຳເລັດ</p>
            <label className="block w-full bg-blue-600 text-white py-4 rounded-xl font-bold cursor-pointer hover:bg-blue-700 transition-colors">
              {loading ? "ກຳລັງສົ່ງ..." : "ແຈ້ງສະລິບການໂອນ"}
              <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" disabled={loading} />
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
    </div>
  );
}
