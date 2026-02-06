'use client';

import React from 'react';

interface BoostHowToModalProps {
  show: boolean;
  onClose: () => void;
}

export const BoostHowToModal = React.memo<BoostHowToModalProps>(({ show, onClose }) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="font-bold text-lg">ວິທີຍິງໂຄສະນາ</div>
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
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-colors active:scale-[0.99]"
          >
            ປິດ
          </button>
        </div>
      </div>
    </div>
  );
});

BoostHowToModal.displayName = 'BoostHowToModal';

