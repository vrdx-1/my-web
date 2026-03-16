'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { safeParseJSON, safeParseSessionJSON } from '@/utils/storageUtils';
import { base64ToFile } from '@/utils/fileEncoding';
import { PHOTO_GRID_GAP } from '@/utils/layoutConstants';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { EmptyLayoutPreview } from '@/components/create-post/EmptyLayoutPreview';

export default function ArrangePostImagesPage() {
  const router = useRouter();
  const [previews, setPreviews] = useState<string[]>([]);
  const [base64List, setBase64List] = useState<string[]>([]);
  const [layout, setLayout] = useState('default');
  const [ready, setReady] = useState(false);
  /** ลำดับที่ผู้ใช้กดเลือก: กดรูปไหนก่อน = ขึ้นก่อนในโพส (เริ่มต้นเปล่า) */
  const [tappedOrder, setTappedOrder] = useState<number[]>([]);

  useEffect(() => {
    const savedLayout = safeParseSessionJSON<string>('create_post_layout', 'default');
    if (!savedLayout) {
      const ls = safeParseJSON<string>('create_post_layout_ls', 'default');
      setLayout(ls || 'default');
    } else {
      setLayout(savedLayout);
    }

    let savedBase64 = safeParseSessionJSON<string[]>('create_post_images_base64', []);
    if (!savedBase64 || savedBase64.length === 0) {
      savedBase64 = safeParseJSON<string[]>('create_post_images_base64_ls', []);
    }
    if (!savedBase64 || savedBase64.length === 0) {
      router.replace('/create-post');
      return;
    }
    const list = savedBase64.slice(0, 15);
    setBase64List(list);
    const files = list.map((base64, i) =>
      base64ToFile(base64, `image-${Date.now()}-${i}.webp`),
    );
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    setReady(true);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [router]);

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
      if (prev.includes(index)) return prev; // เลือกไปแล้วแต่ไม่ใช่ล่าสุด = ไม่สามารถยกเลิกได้
      return [...prev, index]; // เลือกรูปใหม่
    });
  }, []);

  const handleDone = useCallback(() => {
    if (base64List.length === 0) return;
    const reordered = fullOrder.map((i) => base64List[i]);
    try {
      sessionStorage.setItem('create_post_images_base64', JSON.stringify(reordered));
      localStorage.setItem('create_post_images_base64_ls', JSON.stringify(reordered));
    } catch (_) {}
    router.push('/create-post');
  }, [base64List, fullOrder, router]);

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
          {tappedOrder.length === previews.length && (
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
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '600px',
            aspectRatio: '1',
            flexShrink: 0,
            margin: '0 auto 16px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <EmptyLayoutPreview
              layout={previews.length >= 6 ? layout : 'default'}
              imageUrls={orderedPreviewsForLayout}
              gap={PHOTO_GRID_GAP}
              constrained
            />
          </div>
        </div>

        <div
          style={{
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
    </div>
  );
}
