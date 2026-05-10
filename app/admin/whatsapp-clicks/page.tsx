'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PostCard } from '@/components/PostCard';
import { PostFeedModals } from '@/components/PostFeedModals';
import { useFullScreenViewer } from '@/hooks/useFullScreenViewer';
import { usePostModals } from '@/hooks/usePostModals';
import { useViewingPost } from '@/hooks/useViewingPost';
import { LAO_FONT } from '@/utils/constants';

type DailyRow = {
  click_date: string;
  count: number;
};

type AccountRow = {
  targetProfileId: string;
  username: string;
  isSubAccount: boolean;
  parentAdminId: string | null;
  parentAdminUsername: string | null;
  totalClicks: number;
  uniquePeople: number;
  userClicks: number;
  guestClicks: number;
  posts: Array<{
    postId: string | null;
    shortId: string;
    clickCount: number;
    post: Record<string, unknown> | null;
  }>;
};

type Summary = {
  todayCount: number;
  monthTotal: number;
  selectedDateTotal: number;
  selectedDateUniquePeople: number;
  daysWithData: number;
  accountsWithClicks: number;
};

type ClickedPostWithData = {
  postId: string | null;
  shortId: string;
  clickCount: number;
  post: Record<string, unknown>;
};

function getTodayBangkokDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export default function AdminWhatsAppClicksPage() {
  const today = useMemo(() => getTodayBangkokDate(), []);
  const menuButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const viewingPostHook = useViewingPost();
  const fullScreenViewer = useFullScreenViewer();
  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMenuState, setActiveMenuState] = useState<string | null>(null);
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);
  const [selectedAccountRow, setSelectedAccountRow] = useState<AccountRow | null>(null);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [accountRows, setAccountRows] = useState<AccountRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    todayCount: 0,
    monthTotal: 0,
    selectedDateTotal: 0,
    selectedDateUniquePeople: 0,
    daysWithData: 0,
    accountsWithClicks: 0,
  });

  usePostModals({
    viewingPost: viewingPostHook.viewingPost,
    isViewingModeOpen: viewingPostHook.isViewingModeOpen,
    setIsViewingModeOpen: viewingPostHook.setIsViewingModeOpen,
    setViewingModeDragOffset: viewingPostHook.setViewingModeDragOffset,
    initialImageIndex: viewingPostHook.initialImageIndex,
    savedScrollPosition: viewingPostHook.savedScrollPosition,
    fullScreenImages: fullScreenViewer.fullScreenImages,
    setFullScreenDragOffset: fullScreenViewer.setFullScreenDragOffset,
    setFullScreenVerticalDragOffset: fullScreenViewer.setFullScreenVerticalDragOffset,
    setFullScreenZoomScale: fullScreenViewer.setFullScreenZoomScale,
    setFullScreenZoomOrigin: fullScreenViewer.setFullScreenZoomOrigin,
    setFullScreenIsDragging: fullScreenViewer.setFullScreenIsDragging,
    setFullScreenTransitionDuration: fullScreenViewer.setFullScreenTransitionDuration,
    setFullScreenShowDetails: fullScreenViewer.setFullScreenShowDetails,
    setIsHeaderVisible: () => {},
  });

  const openAccountPostsModal = useCallback((row: AccountRow) => {
    setSelectedAccountRow(row);
  }, []);

  const closeAccountPostsModal = useCallback(() => {
    setSelectedAccountRow(null);
  }, []);

  const clickedPostsWithData = useMemo(() => {
    if (!selectedAccountRow) return [];
    return selectedAccountRow.posts.filter(
      (item): item is ClickedPostWithData => Boolean(item.post)
    );
  }, [selectedAccountRow]);

  const clickedPostsWithoutData = useMemo(() => {
    if (!selectedAccountRow) return [];
    return selectedAccountRow.posts.filter((item) => !item.post);
  }, [selectedAccountRow]);

  const emptySavedPosts = useMemo(() => ({} as { [key: string]: boolean }), []);

  useEffect(() => {
    if (!selectedAccountRow) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedAccountRow(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedAccountRow]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setSelectedAccountRow(null);

      try {
        const res = await fetch(`/api/admin/whatsapp-clicks?date=${encodeURIComponent(selectedDate)}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to load WhatsApp click stats');
        }

        const payload = await res.json();
        if (cancelled) return;

        setDailyRows(Array.isArray(payload?.dailyRows) ? payload.dailyRows : []);
        setAccountRows(Array.isArray(payload?.accountRows) ? payload.accountRows : []);
        setSummary({
          todayCount: Number(payload?.summary?.todayCount || 0),
          monthTotal: Number(payload?.summary?.monthTotal || 0),
          selectedDateTotal: Number(payload?.summary?.selectedDateTotal || 0),
          selectedDateUniquePeople: Number(payload?.summary?.selectedDateUniquePeople || 0),
          daysWithData: Number(payload?.summary?.daysWithData || 0),
          accountsWithClicks: Number(payload?.summary?.accountsWithClicks || 0),
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Unknown error');
        setDailyRows([]);
        setAccountRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  return (
    <main style={{ maxWidth: '1100px', margin: '0 auto', background: '#ffffff', minHeight: '100vh', fontFamily: LAO_FONT, paddingBottom: '40px' }}>
      <div style={{ padding: '20px 20px 16px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          WhatsApp Click Analytics
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Today</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{loading ? '...' : summary.todayCount.toLocaleString()}</div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #93c5fd', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600, marginBottom: '4px' }}>Selected Day</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e3a8a' }}>{loading ? '...' : summary.selectedDateTotal.toLocaleString()}</div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, marginBottom: '4px' }}>Unique People</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#14532d' }}>{loading ? '...' : summary.selectedDateUniquePeople.toLocaleString()}</div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #fed7aa', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#c2410c', fontWeight: 600, marginBottom: '4px' }}>Month Total</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#9a3412' }}>{loading ? '...' : summary.monthTotal.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="selected-date" style={{ fontSize: '14px', color: '#334155', fontWeight: 600 }}>Select date</label>
          <input
            id="selected-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              color: '#0f172a',
              background: '#fff',
            }}
          />
        </div>

        <div style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
          Data days in month: {loading ? '...' : summary.daysWithData.toLocaleString()} | Accounts with clicks: {loading ? '...' : summary.accountsWithClicks.toLocaleString()}
        </div>
      </div>

      {error && !loading ? (
        <div style={{ margin: '0 20px 12px', padding: '12px 14px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: '10px', fontSize: '14px' }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: '24px 20px' }}>
          <LoadingSpinner />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '16px', padding: '0 20px' }}>
          <section style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Daily clicks (month of {formatDisplayDate(selectedDate)})
            </div>
            <div style={{ maxHeight: '540px', overflowY: 'auto' }}>
              {dailyRows.map((row) => {
                const isActive = row.click_date === selectedDate;
                return (
                  <button
                    key={row.click_date}
                    type="button"
                    onClick={() => setSelectedDate(row.click_date)}
                    style={{
                      width: '100%',
                      border: 'none',
                      borderBottom: '1px solid #f1f5f9',
                      background: isActive ? '#eff6ff' : '#fff',
                      color: '#0f172a',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: isActive ? 700 : 500 }}>{formatDisplayDate(row.click_date)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: row.count > 0 ? '#1d4ed8' : '#94a3b8' }}>{row.count.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Accounts contacted on {formatDisplayDate(selectedDate)}
            </div>

            {accountRows.length === 0 ? (
              <div style={{ padding: '20px', color: '#64748b', fontSize: '14px' }}>
                No WhatsApp clicks on this day.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Account</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Posts</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Total Clicks</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Unique People</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>User</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Guest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountRows.map((row) => {
                      const accountType = row.isSubAccount
                        ? `Sub account${row.parentAdminUsername ? ` (${row.parentAdminUsername})` : ''}`
                        : 'Main account';

                      return (
                        <tr
                          key={row.targetProfileId}
                          style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                          onClick={() => openAccountPostsModal(row)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openAccountPostsModal(row);
                            }
                          }}
                          tabIndex={0}
                        >
                          <td style={{ padding: '10px 12px', fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>{row.username}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', color: '#475569' }}>{accountType}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>
                            {row.posts.length === 0 ? (
                              '-'
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {row.posts.map((postItem, index) => (
                                  <button
                                    key={`${row.targetProfileId}-${postItem.postId || postItem.shortId}-${index}`}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openAccountPostsModal(row);
                                    }}
                                    style={{
                                      border: '1px solid #dbeafe',
                                      background: '#eff6ff',
                                      color: '#1e3a8a',
                                      borderRadius: '999px',
                                      padding: '2px 8px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    {`${postItem.shortId}(${postItem.clickCount})`}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{row.totalClicks.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>{row.uniquePeople.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', color: '#14532d' }}>{row.userClicks.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', color: '#9a3412' }}>{row.guestClicks.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {selectedAccountRow ? (
        <div
          onClick={closeAccountPostsModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 1500,
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '740px',
              maxHeight: '92vh',
              background: '#fff',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{selectedAccountRow.username}</div>
                <div style={{ fontSize: '13px', color: '#475569' }}>Posts clicked on {formatDisplayDate(selectedDate)}</div>
              </div>
              <button
                type="button"
                onClick={closeAccountPostsModal}
                style={{
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#0f172a',
                  width: '34px',
                  height: '34px',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  fontSize: '20px',
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '10px 0', background: '#fff' }}>
              {clickedPostsWithData.length === 0 ? (
                <div style={{ padding: '20px 16px', fontSize: '14px', color: '#64748b' }}>
                  No post details found for this account on selected day.
                </div>
              ) : (
                clickedPostsWithData.map((postItem, index) => (
                  <div key={`${postItem.postId || postItem.shortId}-${index}`} style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '14px', left: '12px', zIndex: 5, background: '#e0f2fe', color: '#0c4a6e', border: '1px solid #bae6fd', borderRadius: '999px', padding: '2px 10px', fontSize: '12px', fontWeight: 700 }}>
                      Clicks: {postItem.clickCount}
                    </div>
                    <div style={{ paddingTop: '28px' }}>
                      <PostCard
                        post={postItem.post}
                        index={index}
                        isLastElement={index === clickedPostsWithData.length - 1}
                        session={null}
                        savedPosts={emptySavedPosts}
                        justSavedPosts={emptySavedPosts}
                        activeMenuState={activeMenuState}
                        isMenuAnimating={isMenuAnimating}
                        menuButtonRefs={menuButtonRefs}
                        onViewPost={(post, imageIndex: number) => {
                          void viewingPostHook.handleViewPost(post, imageIndex, () => {}, () => {});
                        }}
                        onSave={() => {}}
                        onShare={() => {}}
                        onTogglePostStatus={() => {}}
                        onDeletePost={() => {}}
                        onReport={() => {}}
                        onSetActiveMenu={setActiveMenuState}
                        onSetMenuAnimating={setIsMenuAnimating}
                        showMenuButton={false}
                      />
                    </div>
                  </div>
                ))
              )}

              {clickedPostsWithoutData.length > 0 ? (
                <div style={{ margin: '10px 16px 16px', padding: '10px 12px', border: '1px solid #fee2e2', background: '#fff1f2', color: '#9f1239', borderRadius: '10px', fontSize: '13px' }}>
                  Some clicked posts could not be loaded: {clickedPostsWithoutData.map((item) => item.shortId).join(', ')}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <PostFeedModals
        viewingPost={viewingPostHook.viewingPost}
        session={null}
        isViewingModeOpen={viewingPostHook.isViewingModeOpen}
        viewingModeDragOffset={viewingPostHook.viewingModeDragOffset}
        savedScrollPosition={viewingPostHook.savedScrollPosition}
        initialImageIndex={viewingPostHook.initialImageIndex}
        onViewingPostClose={() => viewingPostHook.closeViewingMode(() => {})}
        onViewingPostTouchStart={viewingPostHook.handleViewingModeTouchStart}
        onViewingPostTouchMove={viewingPostHook.handleViewingModeTouchMove}
        onViewingPostTouchEnd={(event: React.TouchEvent) => viewingPostHook.handleViewingModeTouchEnd(event, () => {})}
        onViewingPostImageClick={(images: string[], index: number) => {
          fullScreenViewer.setFullScreenImages(images);
          fullScreenViewer.setCurrentImgIndex(index);
        }}
        fullScreenImages={fullScreenViewer.fullScreenImages}
        currentImgIndex={fullScreenViewer.currentImgIndex}
        fullScreenDragOffset={fullScreenViewer.fullScreenDragOffset}
        fullScreenEntranceOffset={fullScreenViewer.fullScreenEntranceOffset}
        fullScreenVerticalDragOffset={fullScreenViewer.fullScreenVerticalDragOffset}
        fullScreenIsDragging={fullScreenViewer.fullScreenIsDragging}
        fullScreenTransitionDuration={fullScreenViewer.fullScreenTransitionDuration}
        fullScreenShowDetails={fullScreenViewer.fullScreenShowDetails}
        fullScreenZoomScale={fullScreenViewer.fullScreenZoomScale}
        fullScreenZoomOrigin={fullScreenViewer.fullScreenZoomOrigin}
        activePhotoMenu={fullScreenViewer.activePhotoMenu}
        isPhotoMenuAnimating={fullScreenViewer.isPhotoMenuAnimating}
        showDownloadBottomSheet={fullScreenViewer.showDownloadBottomSheet}
        isDownloadBottomSheetAnimating={fullScreenViewer.isDownloadBottomSheetAnimating}
        showImageForDownload={fullScreenViewer.showImageForDownload}
        onFullScreenClose={() => {
          fullScreenViewer.setFullScreenImages(null);
          if (fullScreenViewer.activePhotoMenu !== null) {
            fullScreenViewer.setIsPhotoMenuAnimating(true);
            setTimeout(() => {
              fullScreenViewer.setActivePhotoMenu(null);
              fullScreenViewer.setIsPhotoMenuAnimating(false);
            }, 300);
          }
        }}
        onFullScreenTouchStart={fullScreenViewer.fullScreenOnTouchStart}
        onFullScreenTouchMove={fullScreenViewer.fullScreenOnTouchMove}
        onFullScreenTouchEnd={fullScreenViewer.fullScreenOnTouchEnd}
        onFullScreenClick={fullScreenViewer.fullScreenOnClick}
        onFullScreenDownload={fullScreenViewer.downloadImage}
        onFullScreenImageIndexChange={fullScreenViewer.setCurrentImgIndex}
        onFullScreenPhotoMenuToggle={(index: number) => {
          if (fullScreenViewer.activePhotoMenu === index) {
            fullScreenViewer.setIsPhotoMenuAnimating(true);
            setTimeout(() => {
              fullScreenViewer.setActivePhotoMenu(null);
              fullScreenViewer.setIsPhotoMenuAnimating(false);
            }, 300);
          } else {
            fullScreenViewer.setActivePhotoMenu(index);
            fullScreenViewer.setIsPhotoMenuAnimating(true);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                fullScreenViewer.setIsPhotoMenuAnimating(false);
              });
            });
          }
        }}
        onFullScreenDownloadBottomSheetClose={() => {
          fullScreenViewer.setIsDownloadBottomSheetAnimating(true);
          setTimeout(() => {
            fullScreenViewer.setShowDownloadBottomSheet(false);
            fullScreenViewer.setIsDownloadBottomSheetAnimating(false);
          }, 300);
        }}
        onFullScreenDownloadBottomSheetDownload={() => {
          fullScreenViewer.setIsDownloadBottomSheetAnimating(true);
          setTimeout(() => {
            fullScreenViewer.setShowDownloadBottomSheet(false);
            fullScreenViewer.setIsDownloadBottomSheetAnimating(false);
            if (fullScreenViewer.fullScreenImages) {
              fullScreenViewer.downloadImage(fullScreenViewer.fullScreenImages[fullScreenViewer.currentImgIndex]);
            }
          }, 300);
        }}
        onFullScreenImageForDownloadClose={() => fullScreenViewer.setShowImageForDownload(null)}
      />
    </main>
  );
}
