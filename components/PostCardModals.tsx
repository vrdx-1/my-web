'use client'

import React from 'react';
import { createPortal } from 'react-dom';
import { SuccessPopup } from './modals/SuccessPopup';
import { BoostAdDetailsPopup } from './modals/BoostAdDetailsPopup';
import { ChangePostPriceModal } from './modals/ChangePostPriceModal';
import { ButtonSpinner } from '@/components/LoadingSpinner';

interface PostCardModalsProps {
  post: any;
  isOwner: boolean;
  isSoldPost: boolean;
  showMarkSoldConfirm: boolean;
  setShowMarkSoldConfirm: (show: boolean) => void;
  showSoldInfo: boolean;
  setShowSoldInfo: (show: boolean) => void;
  soldInfoCenterPosition: { top: number; left: number } | null;
  showChangePriceModal: boolean;
  setShowChangePriceModal: (show: boolean) => void;
  showChangePriceSuccess: boolean;
  setShowChangePriceSuccess: (show: boolean) => void;
  showBoostStatusPopup: boolean;
  setShowBoostStatusPopup: (show: boolean) => void;
  boostStatusPopupStatus: string | null;
  boostStatusPopupExpiresAt: string | null;
  isTogglingStatus: boolean;
  setIsTogglingStatus: (toggling: boolean) => void;
  onTogglePostStatus: (postId: string, currentStatus: string) => void | Promise<void>;
  onLocalUpdate?: (postId: string, data: Record<string, unknown>) => void;
}

export function PostCardModals({
  post,
  isOwner,
  isSoldPost,
  showMarkSoldConfirm,
  setShowMarkSoldConfirm,
  showSoldInfo,
  setShowSoldInfo,
  soldInfoCenterPosition,
  showChangePriceModal,
  setShowChangePriceModal,
  showChangePriceSuccess,
  setShowChangePriceSuccess,
  showBoostStatusPopup,
  setShowBoostStatusPopup,
  boostStatusPopupStatus,
  boostStatusPopupExpiresAt,
  isTogglingStatus,
  setIsTogglingStatus,
  onTogglePostStatus,
  onLocalUpdate,
}: PostCardModalsProps) {
  React.useEffect(() => {
    const anyModalOpen = showMarkSoldConfirm || showChangePriceModal || showChangePriceSuccess;
    if (typeof document === 'undefined' || !anyModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [showMarkSoldConfirm, showChangePriceModal, showChangePriceSuccess]);

  return (
    <>
      {/* Confirm Mark as Sold Modal */}
      {typeof document !== 'undefined' && isOwner && showMarkSoldConfirm && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 2500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '320px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', color: '#111111' }}>
              ລົດຄັນນີ້ ຂາຍແລ້ວບໍ?
            </h3>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setShowMarkSoldConfirm(false)}
                disabled={isTogglingStatus}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#e4e6eb',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#1c1e21',
                  cursor: isTogglingStatus ? 'not-allowed' : 'pointer',
                  opacity: isTogglingStatus ? 0.6 : 1,
                }}
              >
                ຍັງບໍ່ທັນຂາຍ
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isTogglingStatus) return;
                  setIsTogglingStatus(true);
                  try {
                    await onTogglePostStatus(post.id, post.status);
                    setShowMarkSoldConfirm(false);
                  } finally {
                    setIsTogglingStatus(false);
                  }
                }}
                disabled={isTogglingStatus}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#1877f2',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#fff',
                  cursor: isTogglingStatus ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isTogglingStatus ? 0.6 : 1,
                }}
              >
                {isTogglingStatus ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ButtonSpinner />
                  </span>
                ) : 'ຂາຍແລ້ວ'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Sold Info Modal */}
      {typeof document !== 'undefined' && isSoldPost && showSoldInfo && soldInfoCenterPosition && createPortal(
        <div
          aria-hidden="true"
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onTouchMove={(e) => {
            e.stopPropagation();
            setShowSoldInfo(false);
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowSoldInfo(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 2500,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: `${soldInfoCenterPosition.top}px`,
              left: `${soldInfoCenterPosition.left}px`,
              transform: 'translate(-50%, -50%)',
              background: '#fff',
              borderRadius: '12px',
              padding: '10px',
              maxWidth: '236px',
              width: '100%',
              boxShadow: '0 12px 28px rgba(15, 23, 42, 0.18)',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0',
            }}
          >
            <button
              type="button"
              aria-label="ປິດ"
              onClick={() => setShowSoldInfo(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '32px',
                height: '32px',
                borderRadius: 0,
                border: 'none',
                background: 'transparent',
                color: '#000000',
                fontSize: '30px',
                lineHeight: 1,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              ×
            </button>
            <div
              aria-hidden="true"
              style={{
                width: '172px',
                height: '172px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'drop-shadow(0 8px 16px rgba(153, 27, 27, 0.2))',
              }}
            >
              <svg width="172" height="172" viewBox="0 0 172 172" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="14" y="36" width="144" height="100" rx="22" fill="#EF1111"/>
                <rect x="24" y="46" width="124" height="80" rx="16" stroke="#FFFFFF" strokeWidth="5"/>
                <text x="86" y="95" textAnchor="middle" fontSize="30" fontWeight="800" fill="#FFFFFF" style={{ letterSpacing: '0.4px' }}>
                  ຂາຍແລ້ວ
                </text>
              </svg>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ChangePostPriceModal
        isOpen={showChangePriceModal}
        postId={post.id}
        price={post.price}
        currency={post.price_currency}
        onClose={() => setShowChangePriceModal(false)}
        onSaved={(changes) => {
          if (changes && onLocalUpdate) {
            onLocalUpdate(post.id, changes);
          } else {
            setShowChangePriceSuccess(true);
          }
        }}
      />

      {showChangePriceSuccess && (
        <SuccessPopup
          message="ປ່ຽນລາຄາສຳເລັດ"
          onClose={() => setShowChangePriceSuccess(false)}
        />
      )}

      <BoostAdDetailsPopup
        show={showBoostStatusPopup}
        status={boostStatusPopupStatus}
        expiresAt={boostStatusPopupExpiresAt}
        justSubmitted={false}
        submitError={null}
        overlay="dim"
        confirmOnly
        zIndex={2000}
        onClose={() => setShowBoostStatusPopup(false)}
      />
    </>
  );
}
