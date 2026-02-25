"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useBoostSlip } from "./BoostSlipContext";

export type BoostQRStepPackage = {
  name: string;
  price: string;
  days: number;
  qr_url: string;
};

export type BoostQRStepProps = {
  selectedPkg: BoostQRStepPackage;
  postId: string | null;
};

export function BoostQRStep({ selectedPkg, postId }: BoostQRStepProps) {
  const router = useRouter();
  const { setSlipFile } = useBoostSlip();
  const slipInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !postId) return;
    e.target.value = "";
    setSlipFile(file);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("boost_return_pkg", selectedPkg.name);
      localStorage.setItem("boost_return_post_id", postId);
    }
    router.push(
      `/boost_post/slip?id=${encodeURIComponent(postId)}&pkg=${encodeURIComponent(selectedPkg.name)}`
    );
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border mt-4 text-center text-gray-900">
      <div className="w-64 h-64 mx-auto mb-4 flex items-center justify-center rounded-lg overflow-hidden border">
        <img
          src={selectedPkg.qr_url}
          alt={`QR Code ${selectedPkg.name}`}
          className="w-full h-full object-contain"
        />
      </div>
      <p className="text-gray-900 font-bold text-lg mb-6">
        ຈຳນວນເງິນທີ່ຕ້ອງໂອນ: {selectedPkg.price}
      </p>
      <p className="text-gray-600 mb-8 text-sm">
        ກະລຸນາແຈ້ງສະລິບການໂອນ ຫຼັງຈາກທ່ານໂອນສຳເລັດ
      </p>
      <label className="block w-full bg-blue-600 text-white py-4 rounded-xl font-bold cursor-pointer hover:bg-blue-700 transition-colors relative overflow-hidden">
        ແຈ້ງສະລິບການໂອນ
        <input
          ref={slipInputRef}
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileSelect}
          accept="image/*"
        />
      </label>
    </div>
  );
}
