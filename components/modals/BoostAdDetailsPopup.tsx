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

const getRemainingText = (expiresAtIso: string | null, nowMs: number) => {
  if (!expiresAtIso) return '0 ນາທີ';
  const expiresMs = new Date(expiresAtIso).getTime();
  const diffMs = expiresMs - nowMs;
  if (!Number.isFinite(expiresMs) || diffMs <= 0) return '0 ນາທີ';

  const diffMinutes = Math.ceil(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays >= 1) return `${diffDays} ມື້`;
  if (diffHours >= 1) return `${diffHours} ຊົ່ວໂມງ`;
  return `${diffMinutes} ນາທີ`;
};

const formatExpiresAt = (expiresAtIso: string | null) => {
  if (!expiresAtIso) return '-';
  const d = new Date(expiresAtIso);
  if (!Number.isFinite(d.getTime())) return '-';
  return d.toLocaleString('lo-LA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

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
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!show) return;
    if (status !== 'success' || !expiresAt) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(id);
  }, [show, status, expiresAt]);

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
      <div className="w-full max-w-sm border-2 border-gray-300 rounded-2xl p-8 relative text-center bg-white">
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
            <h2 className="text-2xl font-bold mb-3 text-red-600">ຖືກປະຕິເສດ</h2>
            <p className="text-gray-700">
              ຄຳຮ້ອງຂໍ boost ຂອງທ່ານຖືກປະຕິເສດບໍ່ສາມາດສົ່ງໃໝ່ໄດ້
            </p>
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
            <h2 className="text-2xl font-bold mb-3 text-green-600">ກຳລັງໂຄສະນາ</h2>
            <p className="text-gray-700">ໂຄສະນາຈະໝົດອາຍຸພາຍໃນ {getRemainingText(expiresAt, nowMs)}</p>
            <div className="mt-2 text-sm text-gray-500">ໝົດອາຍຸເມື່ອ: {formatExpiresAt(expiresAt)}</div>
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
                <div className="break-words">{submitError}</div>
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

