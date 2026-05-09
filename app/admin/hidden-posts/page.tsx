'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState, Suspense, useRef } from 'react';
import { PostCard } from '@/components/PostCard';
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
  const [activeMenuState, setActiveMenuState] = useState<string | null>(null);
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);
  const [savedPosts] = useState<{ [key: string]: boolean }>({});
  const [justSavedPosts] = useState<{ [key: string]: boolean }>({});
  const menuButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

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
          return (
            <div key={post.id} style={{ display: 'flex', gap: '15px', marginBottom: '30px', alignItems: 'flex-start' }}>
              <div style={{ flex: '1.2' }}>
                <PostCard
                  post={post}
                  index={index}
                  isLastElement={false}
                  showMenuButton={false}
                  session={null}
                  savedPosts={savedPosts}
                  justSavedPosts={justSavedPosts}
                  activeMenuState={activeMenuState}
                  isMenuAnimating={isMenuAnimating}
                  menuButtonRefs={menuButtonRefs}
                  onViewPost={(p) => setViewingPost(p)}
                  onSave={() => {}}
                  onShare={() => {}}
                  onTogglePostStatus={() => {}}
                  onDeletePost={() => {}}
                  onReport={() => {}}
                  onSetActiveMenu={setActiveMenuState}
                  onSetMenuAnimating={setIsMenuAnimating}
                />
              </div>

              <div style={{ flex: '0.8', background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={() => handleUnhidePost(post.id)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#4b4f56',
                      color: '#fff',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    Unhide
                  </button>
                </div>
              </div>
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