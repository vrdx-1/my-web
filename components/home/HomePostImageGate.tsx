'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { preloadPostVisibleImages } from '@/utils/imagePreload';
import { getVisibleImageUrlsForPost } from '@/utils/photoGridVisibleImages';

function preloadKey(post: any): string {
  const urls = getVisibleImageUrlsForPost(post || {});
  const pre = post?._preloadImages;
  const preStr = Array.isArray(pre) ? pre.join('\u0002') : '';
  return [String(post?.id ?? ''), post?.layout ?? '', urls.join('\u0001'), preStr].join('::');
}

type HomePostImageGateProps = {
  post: any;
  /** เมื่อ true = รอโหลดรูปที่เห็นใน layout ก่อนแสดงการ์ด */
  enabled: boolean;
  /** เรียกเมื่อรูปพร้อม (ทุกโพสที่เปิด gate) */
  onImagesReady?: () => void;
  children: React.ReactNode;
};

/**
 * ห่อการ์ดโพสหน้าโฮม: แสดง skeleton จนกว่ารูปที่เห็นในกริดจะโหลดครบ (ไม่รวมรูปหลัง +N)
 */
export function HomePostImageGate({ post, enabled, onImagesReady, children }: HomePostImageGateProps) {
  const [ready, setReady] = useState(!enabled);
  const onReadyRef = useRef(onImagesReady);
  onReadyRef.current = onImagesReady;

  const stableKey = preloadKey(post);
  const postRef = useRef(post);
  postRef.current = post;

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    preloadPostVisibleImages(postRef.current).then(() => {
      if (cancelled) return;
      setReady(true);
      onReadyRef.current?.();
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, stableKey]);

  if (enabled && !ready) {
    return <FeedSkeleton count={1} />;
  }

  return <>{children}</>;
}
