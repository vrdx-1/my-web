'use client'

import React from 'react';

type BoostStatus = 'pending' | 'reject' | 'success' | 'error' | string | null;

interface BoostAdDetailsPopupProps {
  show: boolean;
  status: BoostStatus;
  expiresAt?: string | null;
  justSubmitted?: boolean;
  submitError?: string | null;
  onClose: () => void;
  onRetry?: () => void;
  /** Overlay background style */
  overlay?: 'white' | 'dim';
  /** If true, only "ຕົກລົງ" can close (no retry button label/action) */
  confirmOnly?: boolean;
  /** z-index for overlay container (must be above headers) */
  zIndex?: number;
}

export const BoostAdDetailsPopup = React.memo<BoostAdDetailsPopupProps>(({
  show,
  status,
  expiresAt = null,
  justSubmitted = false,
  submitError = null,
  onClose,
  onRetry,
  overlay = 'white',
  confirmOnly = false,
  zIndex = 50,
}) => {
  if (!show) return null;

  const closeLabel = 'ຕົກລົງ';

  return (
    <div
      className={[
        'fixed inset-0 flex items-center justify-center p-6',
        overlay === 'dim' ? 'bg-black/40' : 'bg-white',
      ].join(' ')}
      style={{ zIndex }}
    >
      {overlay === 'white' && (
        <button
          type="button"
          onClick={onClose}
          aria-label="ກັບຄືນ"
          className="absolute top-4 left-4 w-10 h-10 inline-flex items-center justify-center text-gray-600 hover:text-gray-800"
          style={{ background: 'transparent', border: 'none' }}
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
      )}
      <div className="w-full max-w-sm rounded-2xl p-8 relative text-center bg-white text-gray-900" style={{ backgroundColor: '#ffffff' }}>
        {status === 'pending' ? (
          <>
            <h2 className="text-2xl font-bold mb-3 text-green-600">
              {justSubmitted ? 'ກຳລັງໂຄສະນາ' : 'ກຳລັງກວດສອບ'}
            </h2>
            <p className="text-gray-700">ລະບົບກຳລັງກວດສອບຄວາມຖືກຕ້ອງຂອງໂຄສະນາ</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-colors active:scale-[0.99]"
            >
              {closeLabel}
            </button>
          </>
        ) : status === 'reject' ? (
          <>
            <h2 className="text-2xl font-bold mb-3 text-red-600">ການດັນໂພສຖືກຍົກເລີກ</h2>
            <p className="text-gray-700">ບໍ່ສາມາດສົ່ງໃໝ່ໄດ້</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-colors active:scale-[0.99]"
            >
              {closeLabel}
            </button>
          </>
        ) : status === 'success' ? (
          <>
            <h2 className="text-2xl font-bold mb-3 text-green-600">ດັນໂພສສຳເລັດ</h2>
            <p className="text-gray-700">ໂພສຂອງທ່ານກຳລັງຖືກດັນເພື່ອໃຫ້ຂາຍໄດ້ໄວຂຶ້ນ</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-colors active:scale-[0.99]"
            >
              {closeLabel}
            </button>
          </>
        ) : status === 'error' ? (
          <>
            <h2 className="text-2xl font-bold mb-3 text-red-600">ສົ່ງບໍ່ສຳເລັດ</h2>
            <p className="text-gray-700">ກະລຸນາລອງໃໝ່ (ກວດສອບອິນເຕີເນັດ / ການລ໋ອກອິນ).</p>
            {submitError && (
              <div className="mt-3 text-left text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3">
                <div className="font-bold text-gray-700 mb-1">Error</div>
                <div className="break-words text-gray-700">{submitError}</div>
              </div>
            )}
            <button
              type="button"
              onClick={confirmOnly ? onClose : (onRetry || onClose)}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-colors active:scale-[0.99]"
            >
              {confirmOnly ? closeLabel : 'ລອງອີກຄັ້ງ'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-bold mb-4 text-green-600">ໂພສ Boost ສຳເລັດ</h2>
            <p className="text-gray-600">ຂອບໃຈທີ່ໃຊ້ບໍລິການ</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-colors active:scale-[0.99]"
            >
              {closeLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
});

BoostAdDetailsPopup.displayName = 'BoostAdDetailsPopup';

