import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

const W = 1200;
const H = 630;
const GAP = 8;

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
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f0f0',
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
      return new ImageResponse(placeholder, { width: W, height: H });
    }

    if (count === 1) {
      return new ImageResponse(
        (
          <div
            style={{
              width: W,
              height: H,
              display: 'flex',
              overflow: 'hidden',
              borderRadius: 12,
            }}
          >
            <img
              src={images[0]}
              alt=""
              width={W}
              height={H}
              style={{ objectFit: 'cover', width: W, height: H }}
            />
          </div>
        ),
        { width: W, height: H }
      );
    }

    if (count === 2) {
      const half = (W - GAP) / 2;
      return new ImageResponse(
        (
          <div
            style={{
              width: W,
              height: H,
              display: 'flex',
              flexDirection: 'row',
              gap: GAP,
              overflow: 'hidden',
              borderRadius: 12,
            }}
          >
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <img
                src={images[0]}
                alt=""
                width={half}
                height={H}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <img
                src={images[1]}
                alt=""
                width={half}
                height={H}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
          </div>
        ),
        { width: W, height: H }
      );
    }

    if (count === 3) {
      const leftW = (W - GAP) / 2;
      const rightW = leftW;
      const rightH = (H - GAP) / 2;
      return new ImageResponse(
        (
          <div
            style={{
              width: W,
              height: H,
              display: 'flex',
              flexDirection: 'row',
              gap: GAP,
              overflow: 'hidden',
              borderRadius: 12,
            }}
          >
            <div style={{ width: leftW, height: H, display: 'flex', overflow: 'hidden' }}>
              <img
                src={images[0]}
                alt=""
                width={leftW}
                height={H}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: GAP,
                overflow: 'hidden',
              }}
            >
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <img
                  src={images[1]}
                  alt=""
                  width={rightW}
                  height={rightH}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
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
        { width: W, height: H }
      );
    }

    if (count === 4) {
      const cellW = (W - GAP) / 2;
      const cellH = (H - GAP) / 2;
      return new ImageResponse(
        (
          <div
            style={{
              width: W,
              height: H,
              display: 'flex',
              flexDirection: 'column',
              gap: GAP,
              overflow: 'hidden',
              borderRadius: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'row', gap: GAP, flex: 1 }}>
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <img
                  src={images[0]}
                  alt=""
                  width={cellW}
                  height={cellH}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <img
                  src={images[1]}
                  alt=""
                  width={cellW}
                  height={cellH}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: GAP, flex: 1 }}>
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <img
                  src={images[2]}
                  alt=""
                  width={cellW}
                  height={cellH}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <img
                  src={images[3]}
                  alt=""
                  width={cellW}
                  height={cellH}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </div>
        ),
        { width: W, height: H }
      );
    }

    // 5+ images: 2 on top, 3 on bottom (layout 5 and 6+)
    const topH = (H - GAP) * (2 / 5);
    const bottomH = (H - GAP) * (3 / 5);
    const topCellW = (W - GAP) / 2;
    const bottomCellW = (W - GAP * 2) / 3;

    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: 'flex',
            flexDirection: 'column',
            gap: GAP,
            overflow: 'hidden',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row', gap: GAP, height: topH }}>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <img
                src={images[0]}
                alt=""
                width={topCellW}
                height={topH}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <img
                src={images[1]}
                alt=""
                width={topCellW}
                height={topH}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', gap: GAP, flex: 1 }}>
            {[images[2], images[3], images[4]].map((src, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
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
                      fontSize: 48,
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
      { width: W, height: H }
    );
  } catch (e) {
    console.error('OG image error:', e);
    return new Response('Failed to generate image', { status: 500 });
  }
}
