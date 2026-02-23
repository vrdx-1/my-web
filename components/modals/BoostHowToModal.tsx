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
          <div className="font-bold text-lg text-gray-900">ວິທີສ້າງໂຄສະນາ</div>
        </div>

        <div className="px-5 py-4 text-sm text-gray-700 space-y-3">
          <div className="font-bold text-gray-900">ຂັ້ນຕອນ</div>
          <ol className="list-decimal pl-5 space-y-2">
            <li>ເລືອກ Package ທີ່ທ່ານຕ້ອງການ boost</li>
            <li>ສະແກນ QR ແລະໂອນເງິນຕາມຈຳນວນທີ່ສະແດງ</li>
            <li>ແຈ້ງສະລິບການໂອນ</li>
            <li>ຢືນຢັນສະລິບການໂອນ ແລະ ລໍຖ້າລະບົບກວດສອບຄວາມຖືກຕ້ອງຂອງໂຄສະນາ</li>
          </ol>
          <div className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
            *ຫາກມີບັນຫາ ກະລຸນາຕິດຕໍ່ທີມງານ 02098859693
            <a
              href="https://wa.me/8562098859693"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center p-2 -m-2 text-[#25D366] hover:opacity-80 transition-opacity min-w-[44px] min-h-[44px]"
              aria-label="ຕິດຕໍ່ທີມງານຜ່ານ WhatsApp"
            >
              <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
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

