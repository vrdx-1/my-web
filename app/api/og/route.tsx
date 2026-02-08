import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

// Share link: แสดงเฉพาะรูปรถคันแรกของ post (ไม่แสดงโลโก้เว็บไซต์)
const S = 600;
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
    const firstImage = images[0];

    if (!firstImage) {
      return new ImageResponse(
        (
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
        ),
        { width: S, height: S }
      );
    }

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
            src={firstImage}
            alt=""
            width={S}
            height={S}
            style={{ objectFit: 'cover', width: S, height: S }}
          />
        </div>
      ),
      { width: S, height: S }
    );
  } catch (e) {
    console.error('OG image error:', e);
    return new Response('Failed to generate image', { status: 500 });
  }
}
