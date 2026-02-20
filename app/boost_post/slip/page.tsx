"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase as supabaseClient } from "@/lib/supabase";
import { BOOST_PACKAGES } from "@/data/boostPackages";
import { REGISTER_PATH } from "@/utils/authRoutes";
import { useBoostSlip } from "../BoostSlipContext";
import { compressImage } from "@/utils/imageCompression";

function BoostSlipPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = searchParams.get("id");
  const pkgName = searchParams.get("pkg");
  const { pendingSlipFile, previewUrl, clearSlip, setSlipFile, setBoostResult } = useBoostSlip();
  const supabase = supabaseClient;
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPkg = pkgName
    ? BOOST_PACKAGES.find((p) => p.name === pkgName) ?? null
    : null;

  useEffect(() => {
    if (!postId || !selectedPkg || !pendingSlipFile) {
      router.replace(`/boost_post?id=${encodeURIComponent(postId || "")}`);
    }
  }, [postId, selectedPkg, pendingSlipFile, router]);

  const handleChooseNew = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSlipFile(file);
    e.target.value = "";
  };

  const handleConfirmUpload = async () => {
    const file = pendingSlipFile;
    if (!file || !postId || !selectedPkg) return;

    setLoading(true);
    try {
      const { data: latestBoost, error: latestBoostError } = await supabase
        .from("post_boosts")
        .select("status")
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (latestBoostError) throw latestBoostError;
      if (latestBoost && latestBoost[0]?.status === "reject") {
        setBoostResult({
          dbStatus: "reject",
          expiresAt: null,
          justSubmitted: false,
          submitError: null,
        });
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("boost_return_pkg");
          localStorage.removeItem("boost_return_post_id");
        }
        router.replace(`/boost_post?id=${postId}`);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      let userId = sessionData.session?.user?.id ?? null;
      if (!userId) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        userId = refreshed.session?.user?.id ?? null;
      }
      if (!userId) {
        router.replace(REGISTER_PATH);
        return;
      }

      const compressedFile = await compressImage(file, 1200, 0.7);
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${postId}.webp`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("slips")
        .upload(fileName, compressedFile);

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
        if (uploadData?.path) {
          await supabase.storage.from("slips").remove([uploadData.path]).catch(() => {});
        }
        throw dbError;
      }

      clearSlip();
      setBoostResult({
        dbStatus: "pending",
        expiresAt: null,
        justSubmitted: true,
        submitError: null,
      });
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("boost_return_pkg");
        localStorage.removeItem("boost_return_post_id");
      }
      router.replace(`/boost_post?id=${postId}`);
    } catch (error: any) {
      console.error(error);
      clearSlip();
      setBoostResult({
        dbStatus: "error",
        expiresAt: null,
        justSubmitted: false,
        submitError: error?.message || "UNKNOWN_ERROR",
      });
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("boost_return_pkg");
        localStorage.removeItem("boost_return_post_id");
      }
      router.replace(`/boost_post?id=${postId}`);
    } finally {
      setLoading(false);
    }
  };

  if (!postId || !selectedPkg || !pendingSlipFile || !previewUrl) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <p className="text-gray-500">ກຳລັງໂຫຼດ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-10 text-gray-900">
      <div
        style={{
          padding: "10px 15px",
          display: "flex",
          alignItems: "center",
          gap: "0",
          position: "sticky",
          top: 0,
          background: "#ffffff",
          backgroundColor: "#ffffff",
          zIndex: 10,
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div style={{ width: "72px", flexShrink: 0, display: "flex", justifyContent: "flex-start" }}>
          <button
            onClick={() => {
              clearSlip();
              router.replace(
                `/boost_post?id=${encodeURIComponent(postId || "")}&from_slip=1&pkg=${encodeURIComponent(pkgName || "")}`
              );
            }}
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
            color: "#1c1e21",
          }}
        >
          ຢືນຢັນສະລິບການໂອນ
        </h3>
        <div style={{ width: "72px", flexShrink: 0 }} aria-hidden />
      </div>

      <div className="max-w-md mx-auto p-4 pt-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border text-center text-gray-900">
          <div className="w-full max-h-64 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center mb-6">
            <img
              src={previewUrl}
              alt="ສະລິບ"
              className="max-w-full max-h-64 object-contain"
            />
          </div>
          <p className="text-gray-500 text-sm mb-6">ກວດສອບຮູບກ່ອນຢືນຢັນ</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            aria-hidden
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleChooseNew}
              className="flex-1 py-3 rounded-xl font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ເລືອກໃໝ່
            </button>
            <button
              type="button"
              onClick={handleConfirmUpload}
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "ກຳລັງສົ່ງ..." : "ຢືນຢັນ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BoostSlipPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <p className="text-gray-500">ກຳລັງໂຫຼດ...</p>
        </div>
      }
    >
      <BoostSlipPageContent />
    </Suspense>
  );
}
