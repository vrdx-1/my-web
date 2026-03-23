'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCreatePostContext } from '@/contexts/CreatePostContext';
import { safeParseJSON, safeParseSessionJSON } from '@/utils/storageUtils';
import { loadCreatePostDraft } from '@/utils/createPostDraftPersistence';
import { PHOTO_GRID_GAP, LAYOUT_ASPECT_RATIO, LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { EmptyLayoutPreview } from '@/components/create-post/EmptyLayoutPreview';

export default function ArrangePostImagesPage() {
  const router = useRouter();
  const createPostContext = useCreatePostContext();
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [layout, setLayout] = useState('default');
  const [ready, setReady] = useState(false);
  /** ลำดับที่ผู้ใช้กดเลือก: กดรูปไหนก่อน = ขึ้นก่อนในโพส (เริ่มต้นเปล่า) */
  const [tappedOrder, setTappedOrder] = useState<number[]>([]);
  /** แจ้งเตือนเมื่อเลือกเกิน 15 รูป */
  const [showMaxImageAlert, setShowMaxImageAlert] = useState(false);

  useEffect(() => {
    let isActive = true;
    let urls: string[] = [];

    const hydrateArrangeDraft = async () => {
      const sharedFiles = createPostContext?.draft.files || [];
      const sharedLayout = createPostContext?.draft.layout || 'default';

      let files: File[] = [];
      let nextLayout = sharedLayout;

      if (sharedFiles.length > 0) {
        files = sharedFiles.slice(0, 30);
      } else {
        const savedLayout = safeParseSessionJSON<string>('create_post_layout', 'default');
        if (!savedLayout) {
          const ls = safeParseJSON<string>('create_post_layout_ls', 'default');
          nextLayout = ls || 'default';
        } else {
          nextLayout = savedLayout;
        }

        const persistedDraft = await loadCreatePostDraft();
        if (!persistedDraft || persistedDraft.files.length === 0) {
          router.replace('/create-post');
          return;
        }

        files = persistedDraft.files.slice(0, 30);
        nextLayout = persistedDraft.layout || nextLayout || 'default';
        createPostContext?.setDraft({ files, layout: nextLayout });
      }

      if (!isActive) {
        return;
      }

      setLayout(nextLayout || 'default');
      setSelectedFiles(files);
      urls = files.map((file) => URL.createObjectURL(file));
      setPreviews(urls);
      setReady(true);
    };

    hydrateArrangeDraft();
    return () => {
      isActive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [router, createPostContext]);

  const n = previews.length;
  const restOrder = n > 0 ? Array.from({ length: n }, (_, i) => i).filter((i) => !tappedOrder.includes(i)) : [];
  const fullOrder = [...tappedOrder, ...restOrder];
  /** รูปที่ผู้ใช้กดเลือกแล้วเท่านั้น (สำหรับใส่ใน layout ด้านบน) */
  const orderedPreviewsForLayout = tappedOrder.map((i) => previews[i]);

  const handleTapImage = useCallback((index: number) => {
    setTappedOrder((prev) => {
      const lastSelected = prev.length > 0 ? prev[prev.length - 1] : undefined;
      if (lastSelected !== undefined && lastSelected === index) {
        return prev.slice(0, -1); // กดรูปล่าสุดอีกครั้ง = ยกเลิก (ย้อนหลังได้ทีละรูป)
      }
      // จำกัดจำนวนรูปที่เลือกได้สูงสุด 15 รูป
      if (prev.length >= 15) {
        // แสดงป๊อปอัปแจ้งเตือนเมื่อพยายามเลือกเกิน 15 รูป
        setShowMaxImageAlert(true);
        return prev;
      }
      if (prev.includes(index)) return prev; // เลือกไปแล้วแต่ไม่ใช่ล่าสุด = ไม่สามารถยกเลิกได้
      return [...prev, index]; // เลือกรูปใหม่
    });
  }, []);

  const handleDone = useCallback(() => {
    if (selectedFiles.length === 0) return;
    const minRequired = Math.min(6, previews.length);
    if (tappedOrder.length < minRequired) return;
    /** บันทึกเฉพาะรูปที่ผู้ใช้เลือก (ตามลำดับที่กด) — รูปที่ไม่ได้เลือกจะไม่ถูกบันทึกและไม่ส่งไป backend */
    const arrangedFiles = tappedOrder.map((i) => selectedFiles[i]).filter(Boolean);
    createPostContext?.setDraft({
      files: arrangedFiles,
      layout,
    });
    router.push('/create-post');
  }, [selectedFiles, previews.length, tappedOrder, router, createPostContext, layout]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (!ready || previews.length === 0) {
    return (
      <div style={{ ...LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX, minHeight: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <span style={{ color: '#65676b' }}>ກຳລັງໂຫລດ...</span>
      </div>
    );
  }

  return (
    <div style={LAYOUT_CONSTANTS.MAIN_CONTAINER_FLEX}>
      <div
        style={{
          padding: '10px 15px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          background: '#fff',
          zIndex: 10,
        }}
      >
        <div style={{ width: '72px', flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="button"
            onClick={handleBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#1c1e21',
              padding: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
        <h3 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '18px', fontWeight: 'bold', minWidth: 0, color: '#111' }}>
          ເລືອກຮູບ ແລະ ຈັດລຽງໃໝ່
        </h3>
        <div style={{ width: '72px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          {tappedOrder.length >= Math.min(6, previews.length) && (
            <button
              type="button"
              onClick={handleDone}
              style={{
                minHeight: '40px',
                background: '#1877f2',
                border: 'none',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '6px 14px',
                borderRadius: '20px',
              }}
            >
              ສຳເລັດ
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 15px', display: 'flex', flexDirection: 'column' }}>
        {/* ถ้าเป็น layout 7 (one-top-two-bottom) ให้เว้นระยะมากขึ้นกันรูปทับ layout */}
        <div
          style={{
            width: '50%',
            maxWidth: '240px',
            aspectRatio: LAYOUT_ASPECT_RATIO[previews.length >= 6 ? layout : 'default'] || '1',
            flexShrink: 0,
            margin: `0 auto ${previews.length >= 6 && layout === 'one-top-two-bottom' ? '32px' : '16px'}`,
          }}
        >
          <EmptyLayoutPreview
            layout={previews.length >= 6 ? layout : 'default'}
            imageUrls={orderedPreviewsForLayout}
            gap={PHOTO_GRID_GAP}
            constrained
          />
        </div>

        <div
          style={{
            marginTop: previews.length >= 6 && layout === 'one-top-two-bottom' ? '40px' : '8px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
          }}
        >
          {previews.map((src, index) => {
            const position = tappedOrder.indexOf(index) + 1;
            const showBadge = position > 0;
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleTapImage(index)}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  padding: 0,
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#f0f0f0',
                  cursor: 'pointer',
                }}
              >
                <img
                  src={src}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                {showBadge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: '4px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#1877f2',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {position}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showMaxImageAlert && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '20px 16px 16px',
              width: '80%',
              maxWidth: '320px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '16px',
                fontWeight: 600,
                marginBottom: '16px',
                color: '#111',
              }}
            >
              ໂພສໄດ້ສູງສຸດ 15 ຮູບ
            </div>
            <button
              type="button"
              onClick={() => setShowMaxImageAlert(false)}
              style={{
                marginTop: '4px',
                width: '100%',
                padding: '10px 16px',
                borderRadius: '999px',
                border: 'none',
                background: '#1877f2',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              ຕົກລົງ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
