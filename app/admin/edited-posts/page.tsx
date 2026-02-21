'use client'
import { useState, useEffect, Suspense } from 'react';
import { AdminPostCard } from '@/components/AdminPostCard';
import { EmptyState } from '@/components/EmptyState';
import { formatTime, getOnlineStatus } from '@/utils/postUtils';
import { lazyNamed } from '@/utils/lazyLoad';
import { PageSpinner } from '@/components/LoadingSpinner';

const ViewingPostModal = lazyNamed(
  () => import('@/components/modals/ViewingPostModal'),
  'ViewingPostModal'
);
const FullScreenImageViewer = lazyNamed(
  () => import('@/components/modals/FullScreenImageViewer'),
  'FullScreenImageViewer'
);

const EDITED_POSTS_API = '/api/admin/edited-posts';

export default function AdminEditedPostsPage() {
  const [edits, setEdits] = useState<{ id: string; car_id: string; edited_at: string; cars: any }[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const fetchEditedPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(EDITED_POSTS_API, { credentials: 'include' });
      if (!res.ok) {
        setEdits([]);
        return;
      }
      const json = await res.json();
      const list = json.edits ?? [];
      setEdits(list);
    } catch {
      setEdits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEditedPosts();
  }, []);

  const toggleHidePost = async (carId: string, currentHiddenStatus: boolean) => {
    const actionText = currentHiddenStatus ? 'ຍົກເລີກການຊ່ອນ (Unhide)' : 'ຊ່ອນໂພສ (Hide)';
    if (!confirm(`ຢືນຢັນການ ${actionText}?`)) return;

    const res = await fetch(EDITED_POSTS_API, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carId, action: currentHiddenStatus ? 'unhide' : 'hide' }),
    });
    if (res.ok) {
      setEdits((prev) =>
        prev.map((e) =>
          e.car_id === carId && e.cars
            ? { ...e, cars: { ...e.cars, is_hidden: !currentHiddenStatus } }
            : e
        )
      );
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <PageSpinner />
      </div>
    );
  }

  return (
    <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ width: '100%' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', color: '#111111' }}>
          Review (Edited) - โพสที่แก้ไขภายใน 24 ชม. ({edits.length})
        </h2>
        {edits.length === 0 && (
          <EmptyState message="ບໍ່ມີໂພສທີ່ແກ້ໄຂໃນ 24 ຊົ່ວໂມງນີ້" variant="card" />
        )}

        {edits.map((edit, index) => {
          const post = edit.cars;
          if (!post) return null;
          const isHidden = post.is_hidden === true;

          return (
            <div
              key={edit.id}
              style={{
                display: 'flex',
                gap: '15px',
                marginBottom: '30px',
                alignItems: 'flex-start',
                opacity: isHidden ? 0.5 : 1,
                filter: isHidden ? 'grayscale(1)' : 'none',
              }}
            >
              <div style={{ flex: '1.2' }}>
                <AdminPostCard
                  post={post}
                  index={index}
                  onViewPost={(p) => setViewingPost(p)}
                  showStats={true}
                />
              </div>

              <div
                style={{
                  flex: '0.8',
                  background: '#fff',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  border: isHidden ? '1px solid #ddd' : '1px solid #ffebeb',
                }}
              >
                <div style={{ marginBottom: '10px', fontSize: '13px', color: '#4a4d52' }}>
                  แก้ไขเมื่อ: {formatTime(edit.edited_at)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={() => toggleHidePost(post.id, isHidden)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isHidden ? '#4b4f56' : '#d33',
                      color: '#fff',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    {isHidden ? 'Unhide' : 'Hide'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {viewingPost && (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 2000, overflowY: 'auto' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div
              style={{
                padding: '10px 15px',
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid #eee',
                position: 'sticky',
                top: 0,
                background: '#fff',
                zIndex: 10,
              }}
            >
              <span style={{ fontWeight: 'bold', color: '#111111' }}>ລາຍລະອຽດໂພສ</span>
              <button
                onClick={() => setViewingPost(null)}
                style={{
                  background: '#f0f2f5',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  color: '#111111',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: '12px 15px 8px 15px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#e4e6eb',
                  overflow: 'hidden',
                }}
              >
                {viewingPost.profiles?.avatar_url && (
                  <img
                    src={viewingPost.profiles.avatar_url}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 'bold',
                    fontSize: '15px',
                    lineHeight: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    color: '#111111',
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      color: '#111111',
                    }}
                  >
                    {viewingPost.profiles?.username || 'User'}
                  </span>
                  {(() => {
                    const status = getOnlineStatus(viewingPost.profiles?.last_seen);
                    return status.isOnline ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            background: '#31a24c',
                            borderRadius: '50%',
                            border: '1.5px solid #fff',
                          }}
                        />
                        <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: 'normal' }}>
                          {status.text}
                        </span>
                      </div>
                    ) : (
                      status.text && (
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#31a24c',
                            fontWeight: 'normal',
                            flexShrink: 0,
                          }}
                        >
                          {status.text}
                        </span>
                      )
                    );
                  })()}
                </div>
                <div style={{ fontSize: '12px', color: '#4a4d52', lineHeight: '16px' }}>
                  {formatTime(viewingPost.created_at)} · {viewingPost.province}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '10px 15px 20px 15px',
                fontSize: '16px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                color: '#111111',
              }}
            >
              {viewingPost.caption}
            </div>

            {viewingPost.images?.map((img: string, i: number) => (
              <img
                key={i}
                src={img}
                onClick={() => {
                  setFullScreenImages(viewingPost.images);
                  setCurrentImgIndex(i);
                }}
                style={{
                  width: '100%',
                  marginBottom: '10px',
                  cursor: 'pointer',
                  display: 'block',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {fullScreenImages && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000',
            zIndex: 3000,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '15px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setFullScreenImages(null)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={fullScreenImages[currentImgIndex]}
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            />
          </div>
          <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>
            {currentImgIndex + 1} / {fullScreenImages.length}
          </div>
        </div>
      )}
    </main>
  );
}
