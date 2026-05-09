'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState, Suspense } from 'react';
import { AdminPostCard } from '@/components/AdminPostCard';
import { EmptyState } from '@/components/EmptyState';
import { TabNavigation } from '@/components/TabNavigation';
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

const HIDDEN_POSTS_API = '/api/admin/hidden-posts';

type PostStatus = 'recommend' | 'sold';

export default function AdminHiddenPostsPage() {
  const [activeTab, setActiveTab] = useState<PostStatus>('recommend');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);

  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const [fullScreenImages, setFullScreenImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const tabLabel = useMemo(
    () => (activeTab === 'recommend' ? 'ພ້ອມຂາຍ' : 'ຂາຍແລ້ວ'),
    [activeTab]
  );

  const fetchHiddenPosts = async (status: PostStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`${HIDDEN_POSTS_API}?status=${status}`, { credentials: 'include' });
      if (!res.ok) {
        setPosts([]);
        return;
      }
      const json = await res.json();
      setPosts(Array.isArray(json.posts) ? json.posts : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setMenuPostId(null);
    }
  };

  useEffect(() => {
    fetchHiddenPosts(activeTab);
  }, [activeTab]);

  const handleUnhidePost = async (carId: string) => {
    if (!confirm('ຢືນຢັນການຍົກເລີກການຊ່ອນ (Unhide)?')) return;

    const res = await fetch(HIDDEN_POSTS_API, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carId, action: 'unhide' }),
    });

    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== carId));
      setMenuPostId(null);
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
    <main
      style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', background: '#f0f2f5', minHeight: '100vh' }}
      onClick={() => setMenuPostId(null)}
    >
      <div style={{ width: '100%' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', color: '#111111' }}>
          Hidden Posts - ໂພສທີ່ຖືກຊ່ອນ ({posts.length})
        </h2>

        <div style={{ marginBottom: '18px', background: '#fff', borderRadius: '12px', padding: '8px 12px' }}>
          <TabNavigation
            className="home-tab-navigation"
            tabs={[
              { value: 'recommend', label: 'ພ້ອມຂາຍ' },
              { value: 'sold', label: 'ຂາຍແລ້ວ' },
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab((tab === 'sold' ? 'sold' : 'recommend') as PostStatus)}
          />
        </div>

        {posts.length === 0 && (
          <EmptyState message={`ບໍ່ມີໂພສທີ່ຖືກຊ່ອນໃນຝັ່ງ ${tabLabel}`} variant="card" />
        )}

        {posts.map((post, index) => {
          const isMenuOpen = menuPostId === post.id;

          return (
            <div key={post.id} style={{ position: 'relative', marginBottom: '20px' }}>
              <AdminPostCard
                post={post}
                index={index}
                onViewPost={(p) => setViewingPost(p)}
                showStats={true}
                adminActions={(
                  <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuPostId((prev) => (prev === post.id ? null : post.id))}
                      aria-label="open admin post menu"
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '999px',
                        border: 'none',
                        background: '#f0f2f5',
                        color: '#1f2937',
                        fontSize: '18px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >
                      ...
                    </button>

                    {isMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '40px',
                          right: 0,
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '10px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                          minWidth: '150px',
                          zIndex: 12,
                          overflow: 'hidden',
                        }}
                      >
                        <button
                          onClick={() => handleUnhidePost(post.id)}
                          style={{
                            width: '100%',
                            border: 'none',
                            background: '#fff',
                            textAlign: 'left',
                            padding: '11px 12px',
                            color: '#111111',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          ຍົກເລີກການຊ່ອນ (Unhide)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              />
            </div>
          );
        })}
      </div>

      {viewingPost && (
        <Suspense fallback={null}>
          <ViewingPostModal
            viewingPost={viewingPost}
            session={null}
            isViewingModeOpen={true}
            viewingModeDragOffset={0}
            savedScrollPosition={0}
            onClose={() => setViewingPost(null)}
            onTouchStart={() => {}}
            onTouchMove={() => {}}
            onTouchEnd={() => {}}
            onImageClick={(images: string[], index: number) => {
              setFullScreenImages(images);
              setCurrentImgIndex(index);
            }}
          />
        </Suspense>
      )}

      {fullScreenImages && (
        <Suspense fallback={null}>
          <FullScreenImageViewer
            images={fullScreenImages}
            currentImgIndex={currentImgIndex}
            fullScreenDragOffset={0}
            fullScreenTransitionDuration={300}
            fullScreenShowDetails={false}
            onClose={() => setFullScreenImages(null)}
            onTouchStart={() => {}}
            onTouchMove={() => {}}
            onTouchEnd={() => {}}
            onClick={() => {}}
          />
        </Suspense>
      )}
    </main>
  );
}