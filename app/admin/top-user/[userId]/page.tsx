'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { AdminPostCard } from '@/components/AdminPostCard';
import { EmptyState } from '@/components/EmptyState';
import { PageSpinner } from '@/components/LoadingSpinner';
import { TabNavigation } from '@/components/TabNavigation';

type UserProfile = {
  username: string | null;
  avatar_url: string | null;
};

type UserPost = {
  id: string;
  caption: string | null;
  province: string | null;
  images: string[] | null;
  status: string | null;
  created_at: string;
  user_id: string;
  likes: number | null;
  shares: number | null;
  is_hidden: boolean | null;
  profiles: UserProfile | null;
};

type StatusFilter = 'recommend' | 'sold' | 'hidden';

const PAGE_SIZE = 10;

export default function AdminTopUserPostsPage() {
  const params = useParams<{ userId: string }>();
  const userId = useMemo(() => decodeURIComponent(params?.userId || ''), [params?.userId]);

  const [posts, setPosts] = useState<UserPost[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('recommend');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [menuOpenPostId, setMenuOpenPostId] = useState<string | null>(null);

  const supabase = useMemo(() => createAdminSupabaseClient(), []);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (!userId) {
      setUsername('');
      return;
    }

    const fetchUserProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .single();

        const profileUsername = data?.username?.trim();
        setUsername(profileUsername || userId.slice(0, 8));
      } catch {
        setUsername(userId.slice(0, 8));
      }
    };

    fetchUserProfile();
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setPosts([]);
      setTotalCount(0);
      return;
    }

    const fetchUserPosts = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('cars')
          .select('id, caption, province, images, status, created_at, user_id, likes, shares, is_hidden, profiles!cars_user_id_fkey(username, avatar_url)', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (statusFilter === 'hidden') {
          query = query.eq('is_hidden', true);
        } else {
          query = query.eq('status', statusFilter).or('is_hidden.is.null,is_hidden.eq.false');
        }

        if (searchTerm.trim()) {
          const q = searchTerm.trim();
          query = query.or(`caption.ilike.%${q}%,province.ilike.%${q}%`);
        }

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error, count } = await query.range(from, to);

        if (error) throw error;

        const rows = (data || []) as UserPost[];
        setPosts(rows);
        setTotalCount(count || 0);
      } catch (err) {
        console.error('Fetch user posts error:', err);
        setPosts([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchUserPosts();
  }, [supabase, userId, statusFilter, searchTerm, page]);

  const toggleHidePost = async (post: UserPost, nextHidden: boolean) => {
    try {
      const { error } = await supabase
        .from('cars')
        .update({ is_hidden: nextHidden })
        .eq('id', post.id);
      if (error) throw error;

      if (statusFilter === 'hidden') {
        if (!nextHidden) {
          setPosts((prev) => prev.filter((p) => p.id !== post.id));
          setTotalCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        if (nextHidden) {
          setPosts((prev) => prev.filter((p) => p.id !== post.id));
          setTotalCount((prev) => Math.max(0, prev - 1));
        } else {
          setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, is_hidden: false } : p)));
        }
      }
    } catch (err) {
      console.error('Toggle hide post error:', err);
      alert('Unable to update hide status. Please try again.');
    } finally {
      setMenuOpenPostId(null);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchTerm, userId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
        <PageSpinner />
      </div>
    );
  }

  return (
    <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', minHeight: '100vh' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link
          href="/admin/top-user"
          style={{
            color: '#1877f2',
            textDecoration: 'none',
            fontWeight: 600,
            display: 'inline-block',
            marginBottom: '10px',
          }}
        >
          ← Back to Top User
        </Link>

        <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111111', margin: 0 }}>
          Posts by {username}
        </h2>
        <p style={{ color: '#4b4f56', marginTop: '6px', marginBottom: 0 }}>
          User ID: {userId}
        </p>
      </div>

      <div style={{ marginBottom: '10px', background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '8px 10px 6px' }}>
        <TabNavigation
          className="home-tab-navigation"
          tabs={[
            { value: 'recommend', label: 'ພ້ອມຂາຍ' },
            { value: 'sold', label: 'ຂາຍແລ້ວ' },
            { value: 'hidden', label: 'ຊ່ອນ' },
          ]}
          activeTab={statusFilter}
          onTabChange={(value) => setStatusFilter(value as StatusFilter)}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '16px',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          padding: '12px',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearchTerm(searchInput.trim());
          }}
          style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}
        >
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search caption or province"
            style={{
              height: '38px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              padding: '0 12px',
              flex: 1,
              color: '#111111',
            }}
          />
          <button
            type="submit"
            style={{
              height: '38px',
              borderRadius: '8px',
              border: '1px solid #1877f2',
              background: '#1877f2',
              color: '#fff',
              padding: '0 14px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Search
          </button>
          {searchTerm ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearchTerm('');
              }}
              style={{
                height: '38px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#111111',
                padding: '0 14px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Clear
            </button>
          ) : null}
        </form>
      </div>

      <div style={{ marginBottom: '12px', color: '#4b4f56', fontSize: '14px' }}>
        Total {totalCount.toLocaleString()} posts
      </div>

      {posts.length === 0 ? (
        <EmptyState message={statusFilter === 'hidden' ? 'ບໍ່ມີໂພສທີ່ຖືກຊ່ອນ' : 'ຜູ້ໃຊ້ນີ້ຍັງບໍ່ມີໂພສ'} variant="card" />
      ) : (
        <div>
          {posts.map((post, index) => (
            <AdminPostCard
              key={post.id}
              post={post}
              index={index}
              showStats={true}
              adminActions={
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenPostId((prev) => (prev === post.id ? null : post.id));
                    }}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: 'none',
                      background: '#f0f2f5',
                      color: '#1f2937',
                      cursor: 'pointer',
                      fontSize: '18px',
                      lineHeight: 1,
                    }}
                    aria-label="Post actions"
                  >
                    ⋯
                  </button>
                  {menuOpenPostId === post.id ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: '36px',
                        right: 0,
                        minWidth: '120px',
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                        overflow: 'hidden',
                        zIndex: 20,
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleHidePost(post, !post.is_hidden);
                        }}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: '#fff',
                          textAlign: 'left',
                          padding: '10px 12px',
                          color: '#111111',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 600,
                        }}
                      >
                        {post.is_hidden ? 'Unhide' : 'Hide'}
                      </button>
                    </div>
                  ) : null}
                </div>
              }
            />
          ))}
        </div>
      )}

      {totalCount > 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '18px' }}>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            style={{
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: page <= 1 ? '#f3f4f6' : '#fff',
              color: '#111111',
              padding: '0 12px',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Previous
          </button>

          <span style={{ color: '#111111', fontWeight: 600, minWidth: '120px', textAlign: 'center' }}>
            Page {page} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            style={{
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: page >= totalPages ? '#f3f4f6' : '#fff',
              color: '#111111',
              padding: '0 12px',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      ) : null}
    </main>
  );
}
