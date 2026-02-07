import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

// Mini photo grid เหมือนในการแจ้งเตือน (NotificationPostPreviewCard) – สี่เหลี่ยมจัตุรัส สำหรับ thumbnail ลิงก์แชร์
const S = 600;
const GAP = 4;
const BR = 20;

export async function GET(request: NextRequest) {
  try {
    const postId = request.nextUrl.searchParams.get('post');
    if (!postId) {
      return new Response('Missing post id', { status: 400 });
    }

    const { data: post, error } = await supabase
      .from('cars')
      .select('id, images')
      .eq('id', postId)
      .single();

    if (error || !post) {
      return new Response('Post not found', { status: 404 });
    }

    const images: string[] = Array.isArray(post.images) ? post.images : [];
    const count = images.length;

    const placeholder = (
      <div
        style={{
          width: S,
          height: S,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f0f0',
          borderRadius: BR,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            backgroundColor: '#d1d5db',
            borderRadius: 12,
          }}
        />
      </div>
    );

    if (count === 0) {
      return new ImageResponse(placeholder, { width: S, height: S });
    }

    // 1 รูป – เต็มกริด (เหมือน MiniPostImage)
    if (count === 1) {
      return new ImageResponse(
        (
          <div
            style={{
              width: S,
              height: S,
              display: 'flex',
              overflow: 'hidden',
              borderRadius: BR,
            }}
          >
            <img
              src={images[0]}
              alt=""
              width={S}
              height={S}
              style={{ objectFit: 'cover', width: S, height: S }}
            />
          </div>
        ),
        { width: S, height: S }
      );
    }

    // 2 รูป – 2 คอลัมน์ (เหมือน MiniPostImage)
    if (count === 2) {
      const half = (S - GAP) / 2;
      return new ImageResponse(
        (
          <div
            style={{
              width: S,
              height: S,
              display: 'flex',
              flexDirection: 'row',
              gap: GAP,
              overflow: 'hidden',
              borderRadius: BR,
            }}
          >
            <div style={{ width: half, height: S, display: 'flex', overflow: 'hidden' }}>
              <img
                src={images[0]}
                alt=""
                width={half}
                height={S}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
            <div style={{ width: half, height: S, display: 'flex', overflow: 'hidden' }}>
              <img
                src={images[1]}
                alt=""
                width={half}
                height={S}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
          </div>
        ),
        { width: S, height: S }
      );
    }

    // 3 รูป – ซ้ายใหญ่ ขวา 2 รูปซ้อน (เหมือน MiniPostImage)
    if (count === 3) {
      const leftW = (S - GAP) / 2;
      const rightW = leftW;
      const rightH = (S - GAP) / 2;
      return new ImageResponse(
        (
          <div
            style={{
              width: S,
              height: S,
              display: 'flex',
              flexDirection: 'row',
              gap: GAP,
              overflow: 'hidden',
              borderRadius: BR,
            }}
          >
            <div style={{ width: leftW, height: S, display: 'flex', overflow: 'hidden' }}>
              <img
                src={images[0]}
                alt=""
                width={leftW}
                height={S}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
            <div
              style={{
                width: rightW,
                height: S,
                display: 'flex',
                flexDirection: 'column',
                gap: GAP,
                overflow: 'hidden',
              }}
            >
              <div style={{ height: rightH, display: 'flex', overflow: 'hidden' }}>
                <img
                  src={images[1]}
                  alt=""
                  width={rightW}
                  height={rightH}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
              <div style={{ height: rightH, display: 'flex', overflow: 'hidden' }}>
                <img
                  src={images[2]}
                  alt=""
                  width={rightW}
                  height={rightH}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </div>
        ),
        { width: S, height: S }
      );
    }

    // 4 รูป – 2x2 (เหมือน MiniPostImage)
    if (count === 4) {
      const cell = (S - GAP) / 2;
      return new ImageResponse(
        (
          <div
            style={{
              width: S,
              height: S,
              display: 'flex',
              flexDirection: 'column',
              gap: GAP,
              overflow: 'hidden',
              borderRadius: BR,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'row', gap: GAP, height: cell }}>
              <div style={{ width: cell, height: cell, display: 'flex', overflow: 'hidden' }}>
                <img
                  src={images[0]}
                  alt=""
                  width={cell}
                  height={cell}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
              <div style={{ width: cell, height: cell, display: 'flex', overflow: 'hidden' }}>
                <img
                  src={images[1]}
                  alt=""
                  width={cell}
                  height={cell}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: GAP, height: cell }}>
              <div style={{ width: cell, height: cell, display: 'flex', overflow: 'hidden' }}>
                <img
                  src={images[2]}
                  alt=""
                  width={cell}
                  height={cell}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
              <div style={{ width: cell, height: cell, display: 'flex', overflow: 'hidden' }}>
                <img
                  src={images[3]}
                  alt=""
                  width={cell}
                  height={cell}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </div>
        ),
        { width: S, height: S }
      );
    }

    // 5+ รูป – 2 บน, 3 ล่าง (เหมือน MiniPostImage)
    const topH = (S - GAP) * (2 / 5);
    const bottomH = (S - GAP) * (3 / 5);
    const topCellW = (S - GAP) / 2;
    const bottomCellW = (S - GAP * 2) / 3;

    return new ImageResponse(
      (
        <div
          style={{
            width: S,
            height: S,
            display: 'flex',
            flexDirection: 'column',
            gap: GAP,
            overflow: 'hidden',
            borderRadius: BR,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row', gap: GAP, height: topH }}>
            <div style={{ width: topCellW, height: topH, display: 'flex', overflow: 'hidden' }}>
              <img
                src={images[0]}
                alt=""
                width={topCellW}
                height={topH}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
            <div style={{ width: topCellW, height: topH, display: 'flex', overflow: 'hidden' }}>
              <img
                src={images[1]}
                alt=""
                width={topCellW}
                height={topH}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', gap: GAP, height: bottomH }}>
            {[images[2], images[3], images[4]].map((src, i) => (
              <div
                key={i}
                style={{
                  width: bottomCellW,
                  height: bottomH,
                  display: 'flex',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <img
                  src={src || images[0]}
                  alt=""
                  width={bottomCellW}
                  height={bottomH}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
                {i === 2 && count > 5 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      color: 'white',
                      fontSize: 36,
                      fontWeight: 'bold',
                    }}
                  >
                    +{count - 5}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ),
      { width: S, height: S }
    );
  } catch (e) {
    console.error('OG image error:', e);
    return new Response('Failed to generate image', { status: 500 });
  }
}
