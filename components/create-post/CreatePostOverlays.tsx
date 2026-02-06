'use client';

import React from 'react';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

interface CreatePostUploadingOverlayProps {
  uploadProgress: number;
}

export const CreatePostUploadingOverlay = React.memo<CreatePostUploadingOverlayProps>(
  ({ uploadProgress }) => {
    return (
      <div style={{ ...LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX, minHeight: '100vh' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '20px',
              color: '#1c1e21',
            }}
          >
            ກຳລັງໂພສ
          </div>
          <div
            style={{
              width: '100%',
              maxWidth: '300px',
              height: '12px',
              background: '#e4e6eb',
              borderRadius: '10px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: `${uploadProgress}%`,
                height: '100%',
                background: '#1877f2',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div
            style={{
              marginTop: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#1877f2',
            }}
          >
            {uploadProgress}%
          </div>
        </div>
      </div>
    );
  },
);

CreatePostUploadingOverlay.displayName = 'CreatePostUploadingOverlay';

interface CreatePostViewingOverlayProps {
  previews: string[];
  onClose: () => void;
  onRemoveImage: (index: number) => void;
  onAddImages: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const CreatePostViewingOverlay = React.memo<CreatePostViewingOverlayProps>(
  ({ previews, onClose, onRemoveImage, onAddImages, fileInputRef }) => {
    if (previews.length === 0) return null;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#fff',
          zIndex: 2000,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER_WIDTH,
            height: '100%',
            background: '#fff',
            position: 'relative',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              padding: '10px 15px',
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              background: '#fff',
              borderBottom: '1px solid #f0f0f0',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            <div
              style={{
                width: '72px',
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'flex-start',
              }}
            >
              <div style={{ padding: '5px', width: 24, height: 24 }} aria-hidden />
            </div>
            <h3
              style={{
                flex: 1,
                textAlign: 'center',
                margin: 0,
                fontSize: '18px',
                fontWeight: 'bold',
                minWidth: 0,
              }}
            >
              ແກ້ໄຂ
            </h3>
            <div
              style={{
                width: '72px',
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={onClose}
                style={{
                  background: '#1877f2',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '20px',
                }}
              >
                ສຳເລັດ
              </button>
            </div>
          </div>
          {previews.map((img, idx) => (
            <div
              key={idx}
              style={{ width: '100%', marginBottom: '12px', position: 'relative' }}
            >
              <img
                src={img}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
              <button
                onClick={() => onRemoveImage(idx)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
          ))}

          {/* ปุ่มเพิ่มรูป (อยู่กึ่งกลาง ล่างสุดใน Viewing Mode) */}
          <div
            style={{
              padding: '5px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#1877f2',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '20px',
              }}
            >
              <span
                style={{
                  fontSize: '18px',
                  color: '#fff',
                  lineHeight: '1',
                }}
              >
                +
              </span>{' '}
              ເພີ່ມຮູບ
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={onAddImages}
                ref={fileInputRef}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <div style={{ height: '10px' }} />
        </div>
      </div>
    );
  },
);

CreatePostViewingOverlay.displayName = 'CreatePostViewingOverlay';

interface CreatePostLeaveConfirmModalProps {
  show: boolean;
  onDiscard: () => void;
  onCancel: () => void;
}

export const CreatePostLeaveConfirmModal = React.memo<CreatePostLeaveConfirmModalProps>(
  ({ show, onDiscard, onCancel }) => {
    if (!show) return null;

    return (
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
          onClick={(e) => e.stopPropagation()}
        >
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            ທ່ານຕ້ອງການຍົກເລີກບໍ?
          </h3>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'space-between',
            }}
          >
            <button
              type="button"
              onClick={onDiscard}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: '#e4e6eb',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#1c1e21',
                cursor: 'pointer',
              }}
            >
              ຍົກເລີກ
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: '#1877f2',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              ສ້າງໂພສຕໍ່
            </button>
          </div>
        </div>
      </div>
    );
  },
);

CreatePostLeaveConfirmModal.displayName = 'CreatePostLeaveConfirmModal';

interface CreatePostVideoAlertModalProps {
  show: boolean;
  onClose: () => void;
}

export const CreatePostVideoAlertModal = React.memo<CreatePostVideoAlertModalProps>(
  ({ show, onClose }) => {
    if (!show) return null;

    return (
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
          onClick={(e) => e.stopPropagation()}
        >
          <p
            style={{
              fontSize: '16px',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            ໂພສໄດ້ສະເພາະຮູບພາບເທົ່ານັ້ນ
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 24px',
                background: '#1877f2',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              ຕົກລົງ
            </button>
          </div>
        </div>
      </div>
    );
  },
);

CreatePostVideoAlertModal.displayName = 'CreatePostVideoAlertModal';

