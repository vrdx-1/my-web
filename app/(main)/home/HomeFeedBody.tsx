'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FeedSkeleton } from '@/components/FeedSkeleton';
import { FeedWithPreload } from '@/components/FeedWithPreload';
import { PostCard } from '@/components/PostCard';
import { EmptyState } from '@/components/EmptyState';
import { HomePostImageGate } from '@/components/home/HomePostImageGate';
import { useFeedImpressionObserver } from '@/hooks/useFeedImpressionObserver';
import { useHomeScrollRootOptional } from '@/contexts/HomeScrollRootContext';

/** ความสูงโดยประมาณของการ์ดโพส (รวมเส้นขอบ) — virtualizer จะวัดจริงหลัง mount */
const FEED_CARD_ESTIMATE_PX = 520;
/** เผื่อแถวเหนือ/ใต้ viewport — เลื่อนลึกแล้วเลื่อนกลับเร็ว: overscan สูงขึ้นลดพายุ mount+measure พร้อมกัน */
const FEED_VIRTUAL_OVERSCAN = 18;

export type HomeFeedBodyProps = {
  showSkeleton: boolean;
  /** เมื่อ true และ posts ว่าง → แสดง skeleton แทน "ຍັງບໍ່ມີລາຍການ" (ใช้ตอนกำลังค้นหา) */
  forceSkeletonWhenEmpty?: boolean;
  /** แสดง "ຍັງບໍ່ມີລາຍການ" ได้เฉพาะเมื่อ true (parent ส่ง false ตอนกำลังค้นหา) */
  mayShowEmptyState?: boolean;
  /** true = กำลังโหลดผลค้นหา → ถ้า posts ว่างให้แสดง skeleton เท่านั้น */
  isSearchLoading?: boolean;
  skeletonCount: number;
  /** แท็บแนะนำ: รอโหลดรูปที่เห็นใน layout ก่อนแสดงการ์ด */
  gateImageReady?: boolean;
  /** เรียกเมื่อโพสสุดท้ายในลิสต์โหลดรูปครบ — โหลดโพสถัดไปล่วงหน้า (เมื่อมีโพสในคิวไม่เกิน 2) */
  onPrefetchNextPost?: () => void;
  postFeedProps: {
    posts: any[];
    session: any;
    likedPosts: { [key: string]: boolean };
    savedPosts: { [key: string]: boolean };
    justLikedPosts: { [key: string]: boolean };
    justSavedPosts: { [key: string]: boolean };
    activeMenuState: string | null;
    isMenuAnimating: boolean;
    lastPostElementRef?: (node: HTMLElement | null) => void;
    menuButtonRefs: React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>;
    onViewPost: (post: any, imageIndex: number) => void;
    onImpression?: (postId: string) => void;
    onLike: (postId: string) => void;
    onSave: (postId: string) => void;
    onShare: (post: any) => void;
    onViewLikes: (postId: string) => void;
    onViewSaves: (postId: string) => void;
    onTogglePostStatus: (postId: string, currentStatus: string) => void;
    onDeletePost: (postId: string) => void;
    onReport: (post: any) => void;
    onSetActiveMenu: (postId: string | null) => void;
    onSetMenuAnimating: (animating: boolean) => void;
    loadingMore?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    hideBoost?: boolean;
  };
};

/** หน้าโฮม — ไม่ใช้ PostFeed เพื่อหลีกเลี่ยง React 19 "Expected static flag was missing" */
export function HomeFeedBody({ showSkeleton, forceSkeletonWhenEmpty = false, mayShowEmptyState = true, isSearchLoading = false, skeletonCount, gateImageReady = false, onPrefetchNextPost, postFeedProps }: HomeFeedBodyProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    posts,
    session,
    likedPosts,
    savedPosts,
    justLikedPosts,
    justSavedPosts,
    activeMenuState,
    isMenuAnimating,
    lastPostElementRef,
    menuButtonRefs,
    onViewPost,
    onImpression,
    onLike,
    onSave,
    onShare,
    onViewLikes,
    onViewSaves,
    onTogglePostStatus,
    onDeletePost,
    onReport,
    onSetActiveMenu,
    onSetMenuAnimating,
    loadingMore = false,
    hasMore = true,
    hideBoost = false,
  } = postFeedProps;

  /** 1 observer แทน N ตัวใน PostCard — ลดภาระ main thread ตอนเลื่อนลึก (เหมือน PostFeed) */
  const registerImpressionRef = useFeedImpressionObserver(onImpression);

  const effectivelyShowSkeleton =
    showSkeleton ||
    (forceSkeletonWhenEmpty && posts.length === 0) ||
    (isSearchLoading && posts.length === 0);

  const virtualizeEnabled = mounted && !effectivelyShowSkeleton && posts.length > 0;
  const homeScroll = useHomeScrollRootOptional();
  const useElementScroll = homeScroll?.useElementScroll ?? false;
  const scrollReady = !useElementScroll || homeScroll?.boundScrollEl != null;

  /**
   * แถว skeleton โหลดเพิ่มอยู่ใน virtual list (เป็นส่วนหนึ่งของ totalSize)
   * เดิมวาง skeleton ใน bottomSlot ใต้กล่องความสูง totalSize → อยู่ท้ายเอกสารจริง ตอนเลื่อนลึกแต่ยังไม่ถึงท้ายสุดจะไม่เห็น skeleton แม้ loadingMore เป็น true
   */
  const appendLoadMoreSkeletonRow = Boolean(loadingMore);
  const virtualItemCount = posts.length + (appendLoadMoreSkeletonRow ? 1 : 0);

  /**
   * scrollMargin ต้องเป็น 0: MainTabLayoutClient ใส่ spacer ความสูงคงที่ให้แล้วใต้ header+แท็บแบบ fixed
   * ถ้าวัด offsetTop ของกล่องฟีดแล้วส่งเป็น scrollMargin จะได้ช่องว่างซ้ำ (spacer + padding ภายใน virtual list)
   */
  const virtualizer = useVirtualizer({
    count: virtualItemCount,
    getScrollElement: () => {
      if (useElementScroll && homeScroll?.scrollElementRef.current) {
        return homeScroll.scrollElementRef.current;
      }
      return typeof document !== 'undefined' ? document.documentElement : null;
    },
    estimateSize: () => FEED_CARD_ESTIMATE_PX,
    overscan: FEED_VIRTUAL_OVERSCAN,
    scrollMargin: 0,
    enabled: virtualizeEnabled && scrollReady,
    /**
     * ไม่ปรับ window.scroll เมื่อความสูงการ์ดเปลี่ยนหลังวัด — โดยเฉพาะหลังเลื่อนลึกแล้วเลื่อนกลับ:
     * หยุดเลื่อนแล้ว isScrolling=false แต่หลายการ์ดยังวัด/โหลดรูป การชดเชย scroll เป็นระลอกจะกระตุกและกระพริบ
     * (แลกกับอาจมี drift เล็กน้อยถ้า estimate ห่างจากจริงมาก — โฮมรับได้มากกว่า)
     */
    // @ts-expect-error VirtualizerOptions ในแพ็กเกจยังไม่รวมฟิลด์นี้ใน .d.ts แต่รันไทม์รองรับ
    shouldAdjustScrollPositionOnItemSizeChange: () => false,
    /** นานขึ้น = ช่วงหลังปล่อยนิ้วยังถือว่า "กำลังเลื่อน" ไม่สลับไปโหมดชดเชย scroll เร็วเกินไป */
    isScrollingResetDelay: 450,
    getItemKey: (index) => {
      if (index >= posts.length) return '__home-feed-loading-more__';
      const p = posts[index];
      return p != null && p.id != null ? String(p.id) : String(index);
    },
  });

  if (!mounted) {
    return <FeedSkeleton count={skeletonCount} />;
  }

  if (effectivelyShowSkeleton) {
    return (
      <FeedWithPreload showSkeleton={true} skeletonCount={skeletonCount}>
        <div style={{ display: 'contents' }} />
      </FeedWithPreload>
    );
  }

  if (posts.length === 0) {
    const showEmpty = mayShowEmptyState && !isSearchLoading && !loadingMore;
    return (
      <FeedWithPreload showSkeleton={false} skeletonCount={skeletonCount}>
        {showEmpty ? <EmptyState message="ຍັງບໍ່ມີລາຍການ" variant="default" /> : <FeedSkeleton count={skeletonCount} />}
      </FeedWithPreload>
    );
  }

  const showNoMoreOnly = !hasMore && !loadingMore;
  /** skeleton โหลดเพิ่มอยู่ในแถว virtual แล้ว — ช่องล่างเหลือแค่ข้อความ “ไม่มีเพิ่ม” + spacer สำหรับ sentinel โหลดล่วงหน้า */
  const bottomSlotStyle: React.CSSProperties = {
    minHeight: showNoMoreOnly ? 120 : 88,
    height: showNoMoreOnly ? 120 : 88,
    display: 'flex',
    alignItems: 'center',
    justifyContent: showNoMoreOnly ? 'flex-start' : 'center',
    paddingTop: showNoMoreOnly ? 28 : 0,
    flexShrink: 0,
    width: '100%',
    boxSizing: 'border-box',
    flexDirection: 'column',
    gap: 8,
  };

  const bottomSlot = (
    <div key="feed-bottom-slot" className="feed-bottom-slot" style={bottomSlotStyle}>
      <span
        style={{
          fontSize: '13px',
          color: '#111111',
          visibility: showNoMoreOnly ? 'visible' : 'hidden',
          display: showNoMoreOnly ? 'block' : 'none',
          width: '100%',
          textAlign: 'center',
        }}
      >
        ບໍ່ມີລາຍການເພີ່ມເຕີມ
      </span>
    </div>
  );

  const totalSize = virtualizer.getTotalSize();

  return (
    <FeedWithPreload showSkeleton={false} skeletonCount={skeletonCount}>
      <div style={{ width: '100%', overflowAnchor: 'none' }}>
        <div
          style={{
            height: totalSize,
            position: 'relative',
            width: '100%',
            overflowAnchor: 'none',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const index = virtualItem.index;
            if (index >= posts.length) {
              /** ความสูงคงที่เท่า estimateSize — ลดการวัดซ้ำ/กระโดดของ totalSize ตอน shimmer + รูป skeleton เปลี่ยน (คู่กับ shouldAdjustScrollPositionOnItemSizeChange: false) */
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  data-loading-more-row
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: FEED_CARD_ESTIMATE_PX,
                    minHeight: FEED_CARD_ESTIMATE_PX,
                    maxHeight: FEED_CARD_ESTIMATE_PX,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <FeedSkeleton count={1} animate={false} />
                </div>
              );
            }
            const post = posts[index];
            if (!post) return null;
            const isLastInFeed = index === posts.length - 1;
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <HomePostImageGate
                  post={post}
                  enabled={gateImageReady}
                  onImagesReady={gateImageReady && isLastInFeed ? onPrefetchNextPost : undefined}
                >
                  <PostCard
                    post={post}
                    index={index}
                    isLastElement={false}
                    priority={index === 0}
                    imageFetchPriority={index < 3 ? 'high' : 'low'}
                    session={session}
                    likedPosts={likedPosts}
                    savedPosts={savedPosts}
                    justLikedPosts={justLikedPosts}
                    justSavedPosts={justSavedPosts}
                    activeMenuState={activeMenuState}
                    isMenuAnimating={isMenuAnimating}
                    menuButtonRefs={menuButtonRefs}
                    onViewPost={onViewPost}
                    onLike={onLike}
                    onSave={onSave}
                    onShare={onShare}
                    onViewLikes={onViewLikes}
                    onViewSaves={onViewSaves}
                    onTogglePostStatus={onTogglePostStatus}
                    onDeletePost={onDeletePost}
                    onReport={onReport}
                    onSetActiveMenu={onSetActiveMenu}
                    onSetMenuAnimating={onSetMenuAnimating}
                    onImpression={onImpression}
                    registerImpressionRef={registerImpressionRef}
                    hideBoost={hideBoost}
                  />
                </HomePostImageGate>
              </div>
            );
          })}
          {lastPostElementRef && totalSize > 0 ? (
            <div
              ref={lastPostElementRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: 1,
                transform: `translateY(${Math.max(0, totalSize - 1)}px)`,
                pointerEvents: 'none',
                visibility: 'hidden',
              }}
              aria-hidden
            />
          ) : null}
        </div>
        {bottomSlot}
      </div>
    </FeedWithPreload>
  );
}
