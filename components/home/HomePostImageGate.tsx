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

/** จำว่าโพสนี้โหลดรูปครบแล้ว — virtual list ถอดแถวแล้ว mount ใหม่จะไม่โชว์ skeleton ซ้ำ (กระพริบตอนเลื่อนกลับขึ้น) */
const PRELOAD_DONE_KEYS = new Set<string>();
const MAX_PRELOAD_CACHE_KEYS = 2000;

function rememberPreloadDone(key: string) {
  if (PRELOAD_DONE_KEYS.has(key)) return;
  if (PRELOAD_DONE_KEYS.size >= MAX_PRELOAD_CACHE_KEYS) {
    const first = PRELOAD_DONE_KEYS.values().next().value as string | undefined;
    if (first !== undefined) PRELOAD_DONE_KEYS.delete(first);
  }
  PRELOAD_DONE_KEYS.add(key);
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
  const stableKey = preloadKey(post);
  const postRef = useRef(post);
  postRef.current = post;

  const [ready, setReady] = useState(() => {
    if (!enabled) return true;
    return PRELOAD_DONE_KEYS.has(stableKey);
  });
  const onReadyRef = useRef(onImagesReady);
  onReadyRef.current = onImagesReady;

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }
    if (PRELOAD_DONE_KEYS.has(stableKey)) {
      setReady(true);
      queueMicrotask(() => onReadyRef.current?.());
      return;
    }
    let cancelled = false;
    setReady(false);
    preloadPostVisibleImages(postRef.current).then(() => {
      if (cancelled) return;
      rememberPreloadDone(stableKey);
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
