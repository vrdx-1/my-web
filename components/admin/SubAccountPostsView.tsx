'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SubAccountPostCard } from './SubAccountPostCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { TabNavigation } from '@/components/TabNavigation';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SubAccountPostsViewProps {
  subAccountId: string;
  subAccountUsername: string;
  onBack: () => void;
  session?: any;
}

const API_BASE = '/api/admin/sub-account-posts';

export const SubAccountPostsView = React.memo<SubAccountPostsViewProps>(({
  subAccountId,
  subAccountUsername,
  onBack,
  session,
}) => {
  const [activeTab, setActiveTab] = useState<'available' | 'cleared'>('available');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingPostIds, setSavingPostIds] = useState<Set<string>>(new Set());

  const statusMap = { available: 'recommend', cleared: 'sold' };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const status = statusMap[activeTab];
      const res = await fetch(`${API_BASE}?subAccountId=${subAccountId}&status=${status}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('ບໍ່ສາມາດໂຫຼດໂພສໄດ້');
      }
      const data = await res.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ມີຂໍ້ຜິດພາດເກີດຂື້ນ');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [subAccountId, activeTab]);

  useEffect(() => {
    if (subAccountId) {
      fetchPosts();
    }
  }, [subAccountId, activeTab, fetchPosts]);

  const handleUpdatePost = useCallback(
    async (postId: string, updateData: any) => {
      setSavingPostIds((prev) => new Set([...prev, postId]));
      try {
        const res = await fetch(API_BASE, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ carId: postId, ...updateData }),
        });
        if (!res.ok) {
          throw new Error('ບໍ່ສາມາດອັບເດດໄດ້');
        }
        // อัปเดต posts ใน state โดยไม่ต้อง reload ทั้งหมด
        setPosts((prev) =>
          prev.map((post) => {
            if (post.id === postId) {
              return { ...post, ...updateData };
            }
            return post;
          })
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'ມີຂໍ້ຜິດພາດເກີດຂື້ນ';
        console.error(errorMsg);
        throw err;
      } finally {
        setSavingPostIds((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    []
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={onBack}
          style={{
            padding: '8px 12px',
            background: '#f0f2f5',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          ← ກັບ
        </button>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111111', margin: 0 }}>
          {subAccountUsername}
        </h2>
      </div>

      {/* Tabs (same style as home) */}
      <div style={{ marginBottom: '18px' }}>
        <TabNavigation
          tabs={[
            { value: 'available', label: 'ພ້ອມຂາຍ' },
            { value: 'cleared', label: 'ຂາຍແລ້ວ' },
          ]}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as 'available' | 'cleared')}
          className="home-tab-navigation"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: '#fce8e6',
            color: '#d93025',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 20px' }}>
          <LoadingSpinner />
        </div>
      )}

      {/* Empty State */}
      {!loading && posts.length === 0 && (
        <EmptyState
          title={activeTab === 'available' ? 'ບໍ່ມີໂພສພ້ອມຂາຍ' : 'ບໍ່ມີໂພສທີ່ຂາຍແລ້ວ'}
          description={activeTab === 'available' ? 'ໂພສທັງໝົດໂພສລາຍນີ້ຈະປາກົດຢູ່ທີ່ນີ້' : 'ໂພສທີ່ຂາຍແລ້ວຈະປາກົດຢູ່ທີ່ນີ້'}
        />
      )}

      {/* Posts List */}
      {!loading && posts.length > 0 && (
        <div>
          {posts.map((post, index) => (
            <SubAccountPostCard
              key={post.id}
              post={post}
              index={index}
              onUpdate={handleUpdatePost}
              isSaving={savingPostIds.has(post.id)}
              session={session}
              onRefresh={fetchPosts}
            />
          ))}
        </div>
      )}
    </div>
  );
});

SubAccountPostsView.displayName = 'SubAccountPostsView';
