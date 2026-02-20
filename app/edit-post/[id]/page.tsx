'use client';

import { use } from 'react';
import { PhotoGrid } from '@/components/PhotoGrid';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { useProfile } from '@/hooks/useProfile';
import { Avatar } from '@/components/Avatar';
import { ProvinceDropdown } from '@/components/ProvinceDropdown';
import { LAO_FONT } from '@/utils/constants';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { useEditPostPage } from './useEditPostPage';

const REMOVE_BTN = {
  position: 'absolute' as const,
  top: '10px',
  right: '10px',
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  border: 'none',
  borderRadius: '50%',
  width: 30,
  height: 30,
  cursor: 'pointer' as const,
  fontSize: '16px',
  display: 'flex' as const,
  alignItems: 'center',
  justifyContent: 'center',
};

const LEAVE_OVERLAY = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  zIndex: 2500,
  display: 'flex' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const LEAVE_BOX = {
  background: '#ffffff',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: 20,
  maxWidth: '320px',
  width: '100%',
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
};

const BTN_LEAVE = {
  flex: 1,
  padding: '10px 16px',
  border: 'none',
  borderRadius: 8,
  fontSize: '15px',
  fontWeight: 'bold' as const,
  cursor: 'pointer' as const,
};

export default function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile: userProfile } = useProfile();
  const {
    caption,
    province,
    setProvince,
    images,
    layout,
    loading,
    uploading,
    isViewing,
    setIsViewing,
    showLeaveConfirm,
    handleBack,
    handleDiscardAndBack,
    handleLeaveCancel,
    handleUpdate,
    removeImage,
    captionRef,
    imageUpload,
    hasChanges,
    handleCaptionKeyDown,
    handleCaptionPaste,
    handleCaptionChange,
    maxCaptionLines,
  } = useEditPostPage(id);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: LAO_FONT }}>
        <LoadingSpinner />
      </div>
    );
  }

  const lineCount = caption.split('\n').length;

  return (
    <div style={LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX}>
      <PageHeader
        title="ແກ້ໄຂ"
        onBack={handleBack}
        centerTitle={!hasChanges}
        actionButton={
          hasChanges
            ? { label: uploading ? '...' : 'ບັນທຶກ', onClick: () => handleUpdate(), disabled: uploading, variant: 'pill' as const }
            : undefined
        }
      />

      <div style={{ flex: 1 }}>
        <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar avatarUrl={userProfile?.avatar_url} size={50} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 'bold', fontSize: '18px', lineHeight: '24px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111111' }}>
              {userProfile?.username || 'User'}
            </div>
            <ProvinceDropdown selectedProvince={province} onProvinceChange={setProvince} variant="button" />
          </div>
        </div>

        <div style={{ padding: '0 15px 10px 15px' }}>
          <textarea
            ref={captionRef}
            style={{
              width: '100%',
              minHeight: 24,
              border: 'none',
              outline: 'none',
              fontSize: '16px',
              lineHeight: 1.4,
              padding: 0,
              resize: 'none',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'inherit',
              display: 'block',
              boxSizing: 'border-box',
            }}
            placeholder="ໃສ່ລາຍລະອຽດລົດ..."
            value={caption}
            onKeyDown={handleCaptionKeyDown}
            onPaste={handleCaptionPaste}
            onChange={handleCaptionChange}
          />
          {lineCount >= maxCaptionLines && (
            <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: 5 }}>ສູງສຸດ 15 ແຖວ</div>
          )}
        </div>

        {(images.length > 0 || imageUpload.previews.length > 0) && (
          <PhotoGrid
            images={[...images, ...imageUpload.previews]}
            onPostClick={() => setIsViewing(true)}
            layout={([...images, ...imageUpload.previews].length >= 6 ? layout : 'default')}
          />
        )}
        <input type="file" multiple accept="image/*" onChange={imageUpload.handleFileChange} ref={imageUpload.fileInputRef} style={{ display: 'none' }} />
      </div>

      {isViewing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#ffffff', backgroundColor: '#ffffff', zIndex: 2000, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: LAYOUT_CONSTANTS.MAIN_CONTAINER_WIDTH, height: '100%', background: '#ffffff', backgroundColor: '#ffffff', position: 'relative', overflowY: 'auto' }}>
            <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 0, background: '#ffffff', backgroundColor: '#ffffff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 10 }}>
              <div style={{ width: 72, flexShrink: 0 }} aria-hidden />
              <h3 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '18px', fontWeight: 'bold', minWidth: 0, color: '#111111' }}>ແກ້ໄຂ</h3>
              <div style={{ width: 72, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsViewing(false)} style={{ background: '#1877f2', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px' }}>
                  ສຳເລັດ
                </button>
              </div>
            </div>
            {images.map((img, idx) => (
              <div key={`old-${idx}`} style={{ width: '100%', marginBottom: 12, position: 'relative' }}>
                <img src={img} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
                <button type="button" onClick={() => removeImage(idx, false)} style={REMOVE_BTN}>✕</button>
              </div>
            ))}
            {imageUpload.previews.map((img, idx) => (
              <div key={`new-${idx}`} style={{ width: '100%', marginBottom: 12, position: 'relative' }}>
                <img src={img} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
                <button type="button" onClick={() => removeImage(idx, true)} style={REMOVE_BTN}>✕</button>
              </div>
            ))}
            <div style={{ padding: 5, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1877f2', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px' }}>
                <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> ເພີ່ມຮູບ
                <input type="file" multiple accept="image/*" onChange={imageUpload.handleFileChange} ref={imageUpload.fileInputRef} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ height: 10 }} />
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <div style={LEAVE_OVERLAY}>
          <div style={LEAVE_BOX} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#111111' }}>
              ທ່ານຕ້ອງການຖິ້ມການແກ້ໄຂບໍ?
            </h3>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button type="button" onClick={handleDiscardAndBack} style={{ ...BTN_LEAVE, background: '#e4e6eb', color: '#1c1e21' }}>
                ຖິ້ມການແກ້ໄຂ
              </button>
              <button type="button" onClick={handleLeaveCancel} style={{ ...BTN_LEAVE, background: '#1877f2', color: '#fff' }}>
                ແກ້ໄຂຕໍ່
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
