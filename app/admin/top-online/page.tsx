'use client';

import { useState, useEffect } from 'react';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { applyDateFilter } from '@/utils/dateFilter';
import type { DateFilterType } from '@/utils/dateFilter';

type ProfileMap = Record<string, { username: string | null; avatar_url: string | null }>;

type SessionRow = {
  id: string;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

type RankRow = { user_id: string; total_seconds: number; session_count: number };

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) return '—';
  if (totalSeconds < 60) return `${totalSeconds} วินาที`;
  const m = Math.floor(totalSeconds / 60);
  if (m < 60) return `${m} นาที`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (mm === 0) return `${h} ชั่วโมง`;
  return `${h} ชั่วโมง ${mm} นาที`;
}

export default function AdminTopOnlinePage() {
  const [filter, setFilter] = useState<DateFilterType>('A');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RankRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});

  const supabase = createAdminSupabaseClient();

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('user_sessions')
        .select('id, user_id, started_at, ended_at, duration_seconds')
        .not('user_id', 'is', null)
        .order('started_at', { ascending: false });

      query = applyDateFilter(query, filter, 'started_at');
      const { data: sessionsData, error: sessionsError } = await query;

      if (sessionsError) throw sessionsError;
      const sessions = (sessionsData as SessionRow[]) || [];

      const byUser: Record<string, { total_seconds: number; session_count: number }> = {};
      sessions.forEach((s) => {
        const uid = s.user_id!;
        if (!byUser[uid]) byUser[uid] = { total_seconds: 0, session_count: 0 };
        byUser[uid].session_count += 1;
        if (s.duration_seconds != null) byUser[uid].total_seconds += s.duration_seconds;
      });

      const list: RankRow[] = Object.entries(byUser)
        .map(([user_id, v]) => ({ user_id, total_seconds: v.total_seconds, session_count: v.session_count }))
        .sort((a, b) => b.total_seconds - a.total_seconds);

      setRows(list);

      const ids = list.map((r) => r.user_id);
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
      } else {
        setProfiles({});
      }
    } catch (err) {
      console.error('Fetch top online error:', err);
      setRows([]);
      setProfiles({});
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
    width: '100%',
    maxWidth: '500px',
  };

  const avatarStyle = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    background: '#e4e6eb',
  };

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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>Top Online</h1>
          <TimeFilter filter={filter} onFilterChange={setFilter} />
        </div>

        <p style={{ fontSize: '13px', color: '#65676b', marginBottom: '16px' }}>
          ເວລາໃຊ້ງານລວມທຸກ session (ນາທີ/ຊົ່ວໂມງ). ແບ່ງຕາມຜູ້ໃຊ້ທີ່ລົງທະບຽນ ຫຼື ເຂົ້າສູ່ລະບົບເທົ່ານັ້ນ. ລຳດັບຈາກໃຊ້ງານຫຼາຍທີ່ສຸດ → ນ້ອຍທີ່ສຸດ.
        </p>

        {rows.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '24px',
              flexWrap: 'wrap',
              marginBottom: '20px',
              padding: '14px 16px',
              background: '#fff',
              borderRadius: '10px',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              ຈຳນວນຜູ້ໃຊ້: <strong style={{ color: '#1a1a1a' }}>{rows.length} ຄົນ</strong>
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              ເວລາໃຊ້ງານລວມທັງໝົດ: <strong style={{ color: '#1877f2' }}>{formatDuration(rows.reduce((sum, r) => sum + r.total_seconds, 0))}</strong>
            </div>
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          {rows.length === 0 ? (
            <p style={{ color: '#65676b', fontSize: '14px' }}>ບໍ່ມີຂໍ້ມູນ</p>
          ) : (
            rows.map((row, index) => {
              const profile = profiles[row.user_id];
              const displayName = profile?.username ?? row.user_id.slice(0, 8) + '…';
              return (
                <div key={row.user_id} style={listItemStyle}>
                  <span style={{ fontWeight: 'bold', minWidth: '28px', color: '#65676b' }}>{index + 1}.</span>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" style={avatarStyle} />
                  ) : (
                    <div style={avatarStyle} />
                  )}
                  <span style={{ flex: 1, color: '#1a1a1a' }}>{displayName}</span>
                  <span style={{ fontWeight: '600', color: '#1877f2' }}>{formatDuration(row.total_seconds)}</span>
                  <span style={{ fontSize: '13px', color: '#65676b' }}>({row.session_count} ຄັ້ງ)</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
