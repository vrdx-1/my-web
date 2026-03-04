'use client';

import { useState, useEffect } from 'react';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { applyDateFilter } from '@/utils/dateFilter';
import type { DateFilterType } from '@/utils/dateFilter';
import { LAO_FONT } from '@/utils/constants';

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

type RegisteredRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  visitCount: number;
};

type GuestRow = {
  visitor_id: string;
  visitCount: number;
};

function maskVisitorId(visitorId: string, maxShow = 12): string {
  const s = String(visitorId).trim();
  if (s.length <= maxShow) return s;
  return '…' + s.slice(-10);
}

export default function AdminVisitsPerDayPage() {
  const [activeTab, setActiveTab] = useState<'registered' | 'guest'>('registered');
  const [filter, setFilter] = useState<DateFilterType>('A');
  const [loading, setLoading] = useState(true);
  const [registeredList, setRegisteredList] = useState<RegisteredRow[]>([]);
  const [guestList, setGuestList] = useState<GuestRow[]>([]);

  const supabase = createAdminSupabaseClient();

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      setRegisteredList([]);
      setGuestList([]);

      // ดึง visitor_logs (มี user_id = ผู้ใช้ลงทะเบียน, ไม่มี = แขก)
      let query = supabase
        .from('visitor_logs')
        .select('visitor_id, created_at, user_id')
        .order('created_at', { ascending: false });

      query = applyDateFilter(query, filter);
      const { data: logs, error } = await query;

      if (error) throw error;

      type LogRow = { visitor_id: string; created_at: string; user_id: string | null };
      const rawRows = (logs as LogRow[]) || [];

      // Registered: แถวที่มี user_id → นับต่อ user_id แล้วดึง profiles
      const registeredCounts = new Map<string, number>();
      const guestCounts = new Map<string, number>();
      rawRows.forEach((row) => {
        if (row.user_id) {
          registeredCounts.set(row.user_id, (registeredCounts.get(row.user_id) ?? 0) + 1);
        } else {
          guestCounts.set(row.visitor_id, (guestCounts.get(row.visitor_id) ?? 0) + 1);
        }
      });

      const guestListData: GuestRow[] = Array.from(guestCounts.entries())
        .map(([visitor_id, visitCount]) => ({ visitor_id, visitCount }))
        .sort((a, b) => b.visitCount - a.visitCount);
      setGuestList(guestListData);

      const userIds = Array.from(registeredCounts.keys());
      if (userIds.length === 0) {
        setRegisteredList([]);
      } else {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);
        if (profilesError) throw profilesError;
        const profilesMap = new Map<string | null, { username: string | null; avatar_url: string | null }>();
        (profilesData || []).forEach((p: { id: string; username: string | null; avatar_url: string | null }) => {
          profilesMap.set(p.id, { username: p.username, avatar_url: p.avatar_url });
        });
        const registeredListData: RegisteredRow[] = userIds
          .map((id) => {
            const profile = profilesMap.get(id);
            return {
              id,
              username: profile?.username ?? null,
              avatar_url: profile?.avatar_url ?? null,
              visitCount: registeredCounts.get(id) ?? 0,
            };
          })
          .sort((a, b) => b.visitCount - a.visitCount);
        setRegisteredList(registeredListData);
      }
    } catch (err) {
      console.error('Fetch visits per day error:', err);
      setRegisteredList([]);
      setGuestList([]);
    } finally {
      setLoading(false);
    }
  };

  const avatarStyle = {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    background: '#e4e6eb',
  };

  const tabStyle = (active: boolean, isLeft: boolean) => ({
    padding: '10px 20px',
    border: 'none',
    background: active ? '#1877f2' : '#e5e7eb',
    color: active ? '#fff' : '#374151',
    fontWeight: active ? 'bold' : '500',
    borderRadius: isLeft ? '8px 0 0 8px' : '0 8px 8px 0',
    cursor: 'pointer',
    fontSize: '14px',
  });

  return (
    <main style={{ ...LAYOUT_CONSTANTS.ADMIN_CONTAINER, fontFamily: LAO_FONT }}>
      {/* แถวบน: แท็บซ้าย, timeframe มุมขวาบน */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <button
            type="button"
            onClick={() => setActiveTab('registered')}
            style={tabStyle(activeTab === 'registered', true)}
          >
            Registered User
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guest')}
            style={tabStyle(activeTab === 'guest', false)}
          >
            Guest User
          </button>
        </div>
        <TimeFilter filter={filter} onFilterChange={setFilter} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <LoadingSpinner />
        </div>
      ) : activeTab === 'registered' ? (
        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '16px 20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '400px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600', width: '50px' }}>ລຳດັບ</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600', width: '80px' }}>ໂປຣຟາຍ</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600' }}>ຜູ້ໃຊ້</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', color: '#6b7280', fontWeight: '600', width: '120px' }}>ຈຳນວນຄັ້ງເຂົ້າເວັບ</th>
                </tr>
              </thead>
              <tbody>
                {registeredList.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', color: '#6b7280', textAlign: 'center' }}>
                      ບໍ່ມີຂໍ້ມູນຜູ້ໃຊ້ລົງທະບຽນ
                    </td>
                  </tr>
                ) : (
                  registeredList.map((p, index) => {
                    const displayName = p.username?.trim() || p.id.slice(0, 8) + '…';
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 8px', color: '#374151', verticalAlign: 'middle' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '12px 8px', verticalAlign: 'middle' }}>
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" style={avatarStyle} />
                          ) : (
                            <div style={{ ...avatarStyle, width: '40px', height: '40px' }} />
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', color: '#1a1a1a', fontWeight: '500', verticalAlign: 'middle' }}>
                          {displayName}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 8px', color: '#374151', fontWeight: '600', verticalAlign: 'middle' }}>
                          {p.visitCount.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '16px 20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '400px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600', width: '50px' }}>ລຳດັບ</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600' }}>Token</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', color: '#6b7280', fontWeight: '600', width: '120px' }}>ຈຳນວນຄັ້ງເຂົ້າເວັບ</th>
                </tr>
              </thead>
              <tbody>
                {guestList.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '24px', color: '#6b7280', textAlign: 'center' }}>
                      ບໍ່ມີຂໍ້ມູນແຂກ
                    </td>
                  </tr>
                ) : (
                  guestList.map((row, index) => (
                    <tr key={row.visitor_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 8px', color: '#374151', verticalAlign: 'middle' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '12px 8px', color: '#1a1a1a', fontFamily: 'monospace', fontSize: '13px', verticalAlign: 'middle' }}>
                        {maskVisitorId(row.visitor_id)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 8px', color: '#374151', fontWeight: '600', verticalAlign: 'middle' }}>
                        {row.visitCount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
