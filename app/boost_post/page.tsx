"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase as supabaseClient } from "@/lib/supabase";
import { PageSpinner } from "@/components/LoadingSpinner";
import { BoostAdDetailsPopup } from "@/components/modals/BoostAdDetailsPopup";
import { BOOST_PACKAGES } from "@/data/boostPackages";
import { REGISTER_PATH } from "@/utils/authRoutes";
import { BoostQRStep } from "./BoostQRStep";
import { useBoostSlip } from "./BoostSlipContext";

// สร้าง Component แยกเพื่อจัดการ Logic เดิมทั้งหมด
function BoostPostContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = searchParams.get("id");
  const supabase = supabaseClient;
  const { boostResult, setBoostResult } = useBoostSlip();

  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<{ name: string; price: string; days: number; qr_url: string } | null>(null);
  const [dbStatus, setDbStatus] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [isRedirectingToRegister, setIsRedirectingToRegister] = useState(false);

  const packages = BOOST_PACKAGES;
  const cameBackFromSlipRef = useRef(false);

  // เมื่อกดย้อนกลับจากหน้าสลิป (browser back) ให้โชว์หน้า QR ทันที
  useEffect(() => {
    if (!postId || searchParams.get("from_slip")) return;
    if (typeof localStorage === "undefined") return;
    const returnPkg = localStorage.getItem("boost_return_pkg");
    const returnPostId = localStorage.getItem("boost_return_post_id");
    if (returnPkg && returnPostId === postId) {
      const pkgFound = BOOST_PACKAGES.find((p) => p.name === returnPkg);
      if (pkgFound) {
        setSelectedPkg(pkgFound);
        setStep(2);
        setCheckingStatus(false);
        cameBackFromSlipRef.current = true;
      }
      localStorage.removeItem("boost_return_pkg");
      localStorage.removeItem("boost_return_post_id");
    }
  }, [postId, searchParams]);

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
        router.replace(REGISTER_PATH);
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

        const handleNoExistingBoost = () => {
          console.log("ไม่พบข้อมูลการ Boost เดิม หรือ Boost เดิมหมดอายุแล้ว");
          const fromSlip = searchParams.get("from_slip");
          const pkg = searchParams.get("pkg");
          const returnPkg =
            typeof localStorage !== "undefined"
              ? localStorage.getItem("boost_return_pkg")
              : null;
          const returnPostId =
            typeof localStorage !== "undefined"
              ? localStorage.getItem("boost_return_post_id")
              : null;
          if (fromSlip === "1" && pkg) {
            const pkgFound = BOOST_PACKAGES.find(
              (p) => p.name === decodeURIComponent(pkg)
            );
            if (pkgFound) {
              setSelectedPkg(pkgFound);
              setStep(2);
            } else {
              setStep(1);
            }
          } else if (returnPkg && returnPostId === postId) {
            const pkgFound = BOOST_PACKAGES.find((p) => p.name === returnPkg);
            if (pkgFound) {
              setSelectedPkg(pkgFound);
              setStep(2);
            } else {
              setStep(1);
            }
            localStorage.removeItem("boost_return_pkg");
            localStorage.removeItem("boost_return_post_id");
          } else if (!cameBackFromSlipRef.current) {
            setStep(1);
          }
        };

        if (data && data.length > 0) {
          const latest = data[0] as any;
          const currentStatus = latest.status;
          const latestExpiresAt: string | null = latest.expires_at ?? null;
          const isBoostExpired =
            currentStatus === "success" &&
            !!latestExpiresAt &&
            new Date(latestExpiresAt).getTime() <= Date.now();

          if (isBoostExpired) {
            handleNoExistingBoost();
          } else {
            console.log("พบข้อมูลสถานะในระบบ:", currentStatus);
            setDbStatus(currentStatus);
            setExpiresAt(latestExpiresAt);
            setJustSubmitted(false);
            setStep(3); 
          }
        } else {
          handleNoExistingBoost();
        }
      } catch (err) {
        console.error("เกิดข้อผิดพลาด:", err);
        const fromSlip = searchParams.get("from_slip");
        const pkg = searchParams.get("pkg");
        const returnPkg =
          typeof localStorage !== "undefined"
            ? localStorage.getItem("boost_return_pkg")
            : null;
        const returnPostId =
          typeof localStorage !== "undefined"
            ? localStorage.getItem("boost_return_post_id")
            : null;
        if (fromSlip === "1" && pkg) {
          const pkgFound = BOOST_PACKAGES.find(
            (p) => p.name === decodeURIComponent(pkg)
          );
          if (pkgFound) {
            setSelectedPkg(pkgFound);
            setStep(2);
          } else {
            setStep(1);
          }
        } else if (returnPkg && returnPostId === postId) {
          const pkgFound = BOOST_PACKAGES.find((p) => p.name === returnPkg);
          if (pkgFound) {
            setSelectedPkg(pkgFound);
            setStep(2);
          } else {
            setStep(1);
          }
          localStorage.removeItem("boost_return_pkg");
          localStorage.removeItem("boost_return_post_id");
        } else if (!cameBackFromSlipRef.current) {
          setStep(1);
        }
      } finally {
        setCheckingStatus(false);
      }
    }
    checkExistingBoost();
  }, [postId, router, supabase, searchParams]);

  useEffect(() => {
    const fromSlip = searchParams.get("from_slip");
    const pkg = searchParams.get("pkg");
    if (fromSlip === "1" && pkg && postId) {
      const pkgFound = BOOST_PACKAGES.find(
        (p) => p.name === decodeURIComponent(pkg)
      );
      if (pkgFound) {
        setSelectedPkg(pkgFound);
        setStep(2);
      }
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("boost_return_pkg");
        localStorage.removeItem("boost_return_post_id");
      }
      router.replace(`/boost_post?id=${encodeURIComponent(postId)}`, {
        scroll: false,
      });
    }
  }, [searchParams, postId, router]);

  useEffect(() => {
    if (!boostResult) return;
    setDbStatus(boostResult.dbStatus);
    setExpiresAt(boostResult.expiresAt);
    setJustSubmitted(boostResult.justSubmitted);
    setSubmitError(boostResult.submitError ?? null);
    setStep(3);
    setBoostResult(null);
  }, [boostResult, setBoostResult]);

  if (isRedirectingToRegister) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <PageSpinner />
      </div>
    );
  }

  if (checkingStatus) return (
    <div className="min-h-screen bg-white pb-10">
      {/* Header skeleton */}
      <div style={{ padding: "10px 15px", display: "flex", alignItems: "center", position: "sticky", top: 0, background: "#ffffff", zIndex: 10 }}>
        <div style={{ width: "72px", flexShrink: 0 }}>
          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="h-5 w-40 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <div style={{ width: "72px", flexShrink: 0 }} />
      </div>
      {/* Body skeleton */}
      <div className="max-w-md mx-auto p-4 pt-8 space-y-4">
        <div className="h-4 w-48 bg-gray-200 rounded-full animate-pulse mx-auto mb-6" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-full bg-gray-100 rounded-2xl p-4 flex justify-between items-center animate-pulse">
            <div className="h-4 w-20 bg-gray-200 rounded-full" />
            <div className="h-4 w-24 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );

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
            color: "#1c1e21",
          }}
        >
          {step === 2 ? "ຊຳລະເງິນເພື່ອດັນໂພສ" : "ດັນໂພສເພື່ອຂາຍໄດ້ໄວຂຶ້ນ"}
        </h3>
        <div style={{ width: "72px", flexShrink: 0 }} aria-hidden />
      </div>

      <div className="max-w-md mx-auto p-4">
        {step === 1 && (
          <div className="space-y-4 pt-4">
            <p className="text-gray-700 text-center text-base font-medium mb-6">
              ເລືອກໄລຍະເວລາດັນໂພສ
            </p>
            {packages.map((pkg) => (
              <button
                key={pkg.name}
                onClick={() => {
                  setSelectedPkg(pkg);
                  setStep(2);
                }}
                className="w-full bg-white border border-gray-200 p-4 rounded-2xl flex justify-between items-center shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_32px_rgba(15,23,42,0.14)] hover:border-violet-300 transition-all duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 text-gray-900"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-gray-900">{pkg.name}</span>
                  {pkg.days === 7 && (
                    <span className="text-base font-semibold text-amber-600">ແນະນຳ</span>
                  )}
                </div>
                <span className="text-base font-bold text-gray-900">{pkg.price}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && selectedPkg && (
          <BoostQRStep selectedPkg={selectedPkg} postId={postId} />
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
