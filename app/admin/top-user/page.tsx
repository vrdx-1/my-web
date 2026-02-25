'use client';

import { useState, useEffect } from 'react';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { applyDateFilter } from '@/utils/dateFilter';
import type { DateFilterType } from '@/utils/dateFilter';

type ProfileMap = Record<string, { username: string | null; avatar_url: string | null }>;

type RankRow = { user_id: string; count: number };

type TabId = 'poster' | 'seller' | 'booster';

const TABS: { id: TabId; label: string }[] = [
  { id: 'poster', label: 'Top Poster' },
  { id: 'seller', label: 'Top Seller' },
  { id: 'booster', label: 'Top Booster' },
];

export default function AdminTopUserPage() {
  const [activeTab, setActiveTab] = useState<TabId>('poster');
  const [filter, setFilter] = useState<DateFilterType>('A');
  const [loading, setLoading] = useState(true);
  const [topPoster, setTopPoster] = useState<RankRow[]>([]);
  const [topSeller, setTopSeller] = useState<RankRow[]>([]);
  const [topBooster, setTopBooster] = useState<RankRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});

  const supabase = createAdminSupabaseClient();

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1) Cars: user_id, status (within timeframe)
      let carsQuery = supabase.from('cars').select('user_id, status');
      carsQuery = applyDateFilter(carsQuery, filter, 'created_at');
      const { data: carsData, error: carsError } = await carsQuery;
      if (carsError) throw carsError;

      const posterCount: Record<string, number> = {};
      const sellerCount: Record<string, number> = {};
      (carsData || []).forEach((row: { user_id: string; status: string }) => {
        const uid = row.user_id;
        if (!uid) return;
        posterCount[uid] = (posterCount[uid] || 0) + 1;
        if (row.status === 'sold') {
          sellerCount[uid] = (sellerCount[uid] || 0) + 1;
        }
      });

      const posterList: RankRow[] = Object.entries(posterCount)
        .map(([user_id, count]) => ({ user_id, count }))
        .sort((a, b) => b.count - a.count);
      const sellerList: RankRow[] = Object.entries(sellerCount)
        .map(([user_id, count]) => ({ user_id, count }))
        .sort((a, b) => b.count - a.count);

      setTopPoster(posterList);
      setTopSeller(sellerList);

      // 2) post_boosts: นับเฉพาะที่ admin approve แล้ว (success รวมหมดอายุ) หรือปิดอัตโนมัติเพราะโพสต์ย้ายไป ຂາຍແລ້ວ (reject ที่ post status = sold)
      let boostsQuery = supabase
        .from('post_boosts')
        .select('user_id, post_id, status')
        .in('status', ['success', 'reject']);
      boostsQuery = applyDateFilter(boostsQuery, filter, 'created_at');
      const { data: boostsData, error: boostsError } = await boostsQuery;
      if (boostsError) throw boostsError;

      const rejectPostIds = (boostsData || [])
        .filter((r: { status: string }) => r.status === 'reject')
        .map((r: { post_id: string }) => r.post_id);
      let soldPostIds = new Set<string>();
      if (rejectPostIds.length > 0) {
        const { data: soldCars } = await supabase
          .from('cars')
          .select('id')
          .in('id', rejectPostIds)
          .eq('status', 'sold');
        if (soldCars) soldPostIds = new Set(soldCars.map((c: { id: string }) => c.id));
      }

      const boosterCount: Record<string, number> = {};
      (boostsData || []).forEach((row: { user_id: string; post_id: string; status: string }) => {
        const uid = row.user_id;
        if (!uid) return;
        const shouldCount = row.status === 'success' || (row.status === 'reject' && soldPostIds.has(row.post_id));
        if (!shouldCount) return;
        boosterCount[uid] = (boosterCount[uid] || 0) + 1;
      });
      const boosterList: RankRow[] = Object.entries(boosterCount)
        .map(([user_id, count]) => ({ user_id, count }))
        .sort((a, b) => b.count - a.count);
      setTopBooster(boosterList);

      // 3) Profiles for all user_ids (poster + seller + booster)
      const allIds = new Set<string>();
      posterList.forEach((r) => allIds.add(r.user_id));
      sellerList.forEach((r) => allIds.add(r.user_id));
      boosterList.forEach((r) => allIds.add(r.user_id));
      const ids = Array.from(allIds);
      if (ids.length > 0) {
        const { data: profData, error: profError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', ids);
        if (!profError && profData) {
          const map: ProfileMap = {};
          profData.forEach((p: { id: string; username: string | null; avatar_url: string | null }) => {
            map[p.id] = { username: p.username, avatar_url: p.avatar_url };
          });
          setProfiles(map);
        }
      }
    } catch (err) {
      console.error('Fetch top user error:', err);
      setTopPoster([]);
      setTopSeller([]);
      setTopBooster([]);
    } finally {
      setLoading(false);
    }
  };

  const listItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    background: '#fff',
    borderRadius: '8px',
    marginBottom: '8px',
    border: '1px solid #eee',
    width: '50%',
  };

  const avatarStyle = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    background: '#e4e6eb',
  };

  const renderList = (rows: RankRow[]) => (
    <div style={{ marginTop: '20px' }}>
      {rows.length === 0 ? (
        <p style={{ color: '#65676b', fontSize: '14px' }}>ບໍ່ມີຂໍ້ມູນ</p>
      ) : (
        rows.map((row, index) => {
          const profile = profiles[row.user_id];
          const displayName = profile?.username ?? row.user_id.slice(0, 8) + '…';
          return (
            <div key={row.user_id} style={listItemStyle}>
              <span style={{ fontWeight: 'bold', minWidth: '28px', color: '#65676b' }}>
                {index + 1}.
              </span>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" style={avatarStyle} />
              ) : (
                <div style={avatarStyle} />
              )}
              <span style={{ flex: 1, color: '#1a1a1a' }}>{displayName}</span>
              <span style={{ fontWeight: '600', color: '#1877f2' }}>{row.count}</span>
            </div>
          );
        })
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <main style={LAYOUT_CONSTANTS.ADMIN_CONTAINER}>
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 20px',
                  border: `1px solid ${isActive ? '#1877f2' : '#ddd'}`,
                  borderRadius: '8px',
                  background: isActive ? '#e7f3ff' : '#fff',
                  color: isActive ? '#1877f2' : '#4b4f56',
                  fontWeight: isActive ? 'bold' : '500',
                  cursor: 'pointer',
                  fontSize: '15px',
                  transition: '0.2s',
                }}
              >
                {tab.label}
              </button>
            );
          })}
          </div>
          <TimeFilter filter={filter} onFilterChange={setFilter} />
        </div>

        {activeTab === 'poster' && renderList(topPoster)}
        {activeTab === 'seller' && renderList(topSeller)}
        {activeTab === 'booster' && renderList(topBooster)}
      </div>
    </main>
  );
}
