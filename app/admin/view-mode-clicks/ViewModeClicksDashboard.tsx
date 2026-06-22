'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { StatCard } from '@/components/admin/StatCard';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { getDateRange, type DateFilterType } from '@/utils/dateFilter';
import { VIEW_MODE_ANALYTICS_CONFIG, type ViewModeAnalyticsSource } from '@/utils/viewModeClickAnalytics';
import { LAO_FONT } from '@/utils/constants';

type PersonSummary = {
  user_id: string;
  person_label: string;
  total_clicks: number;
  last_clicked_at: string;
};

type HistoryItem = {
  id: string;
  user_id: string;
  person_label: string;
  created_at: string;
};

type DashboardPayload = {
  stats: {
    totalClicks: number;
    uniqueUsers: number;
    todayClicks: number;
    selectedUserClicks: number;
    averageClicksPerUser: number;
  };
  people: PersonSummary[];
  history: HistoryItem[];
  selectedUser: {
    user_id: string;
    person_label: string;
    total_clicks: number;
  } | null;
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ViewModeClicksDashboard({ source }: { source: ViewModeAnalyticsSource }) {
  const router = useRouter();
  const config = VIEW_MODE_ANALYTICS_CONFIG[source];
  const [filter, setFilter] = useState<DateFilterType>('A');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<DashboardPayload>({
    stats: {
      totalClicks: 0,
      uniqueUsers: 0,
      todayClicks: 0,
      selectedUserClicks: 0,
      averageClicksPerUser: 0,
    },
    people: [],
    history: [],
    selectedUser: null,
  });
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    if (payload.people.length === 0) {
      if (selectedUserId) setSelectedUserId('');
      return;
    }

    if (selectedUserId && payload.people.some((person) => person.user_id === selectedUserId)) {
      return;
    }

    const fallbackUserId = payload.people[0]?.user_id || '';
    if (fallbackUserId && fallbackUserId !== selectedUserId) {
      setSelectedUserId(fallbackUserId);
    }
  }, [payload.people, selectedUserId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const { startDate, endDate } = getDateRange(filter);
        const search = new URLSearchParams();
        if (startDate) search.set('start', startDate);
        if (endDate) search.set('end', endDate);
        search.set('limit', '10000');

        const response = await fetch(`${config.adminRoute}?${search.toString()}`, {
          credentials: 'include',
        });

        if (response.status === 401) {
          router.replace('/admin/login');
          return;
        }

        if (response.status === 403) {
          router.replace('/home');
          return;
        }

        const json = await response.json().catch(() => null);
        if (!response.ok || !json) {
          throw new Error(json?.error || 'ไม่สามารถโหลดข้อมูลสถิติได้');
        }

        if (cancelled) return;

        setPayload({
          stats: {
            totalClicks: Number(json?.stats?.totalClicks || 0),
            uniqueUsers: Number(json?.stats?.uniqueUsers || 0),
            todayClicks: Number(json?.stats?.todayClicks || 0),
            selectedUserClicks: Number(json?.stats?.selectedUserClicks || 0),
            averageClicksPerUser: Number(json?.stats?.averageClicksPerUser || 0),
          },
          people: Array.isArray(json?.people) ? json.people : [],
          history: Array.isArray(json?.history) ? json.history : [],
          selectedUser: json?.selectedUser || null,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้');
        setPayload({
          stats: {
            totalClicks: 0,
            uniqueUsers: 0,
            todayClicks: 0,
            selectedUserClicks: 0,
            averageClicksPerUser: 0,
          },
          people: [],
          history: [],
          selectedUser: null,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [config.adminRoute, filter, router]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!selectedUserId) {
        setPayload((prev) => ({ ...prev, history: [] }));
        return;
      }

      setHistoryLoading(true);
      try {
        const { startDate, endDate } = getDateRange(filter);
        const search = new URLSearchParams();
        if (startDate) search.set('start', startDate);
        if (endDate) search.set('end', endDate);
        search.set('limit', '10000');
        search.set('userId', selectedUserId);

        const response = await fetch(`${config.adminRoute}?${search.toString()}`, {
          credentials: 'include',
        });

        if (!response.ok) return;

        const json = await response.json().catch(() => null);
        if (cancelled || !json) return;

        setPayload((prev) => ({
          ...prev,
          history: Array.isArray(json?.history) ? json.history : [],
          selectedUser: json?.selectedUser || prev.selectedUser,
          stats: json?.stats
            ? {
                ...prev.stats,
                selectedUserClicks: Number(json.stats.selectedUserClicks || 0),
              }
            : prev.stats,
        }));
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [config.adminRoute, filter, selectedUserId]);

  const topPeople = useMemo(() => payload.people.slice(0, 12), [payload.people]);
  const selectedPerson = useMemo(
    () => payload.selectedUser || payload.people.find((person) => person.user_id === selectedUserId) || null,
    [payload.people, payload.selectedUser, selectedUserId],
  );

  return (
    <main
      style={{
        maxWidth: '1500px',
        margin: '0 auto',
        padding: '28px 20px 42px',
        minHeight: '100vh',
        fontFamily: LAO_FONT,
        background:
          source === 'saved'
            ? 'radial-gradient(circle at 8% 10%, rgba(16,185,129,0.14), transparent 34%), radial-gradient(circle at 92% 0%, rgba(59,130,246,0.10), transparent 36%), linear-gradient(180deg, #f8fbff 0%, #f4f7fb 100%)'
            : 'radial-gradient(circle at 8% 10%, rgba(124,58,237,0.14), transparent 34%), radial-gradient(circle at 92% 0%, rgba(59,130,246,0.10), transparent 36%), linear-gradient(180deg, #f8fbff 0%, #f4f7fb 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ maxWidth: 860 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 999, background: source === 'saved' ? 'rgba(16,185,129,0.12)' : 'rgba(124,58,237,0.12)', color: source === 'saved' ? '#0f766e' : '#6d28d9', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>
            {source === 'saved' ? 'Saved' : 'My Posts'}
          </div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: '42px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {config.pageTitle}
          </h1>
          <p style={{ margin: '10px 0 0', color: '#475569', fontSize: 15, lineHeight: '24px' }}>
            {config.pageSubtitle}
          </p>
        </div>

        <TimeFilter filter={filter} onFilterChange={setFilter} />
      </div>

      {error ? (
        <div style={{ marginBottom: 18, padding: '12px 14px', borderRadius: 14, background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontWeight: 600 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
        <StatCard label='การกดทั้งหมด' value={payload.stats.totalClicks.toLocaleString()} loading={loading} variant='centered' />
        <StatCard label='ผู้ใช้ที่กด' value={payload.stats.uniqueUsers.toLocaleString()} loading={loading} variant='centered' />
        <StatCard label='กดวันนี้' value={payload.stats.todayClicks.toLocaleString()} loading={loading} variant='centered' />
        <StatCard label='เฉลี่ยต่อคน' value={loading ? '...' : payload.stats.averageClicksPerUser.toFixed(1)} loading={loading} variant='centered' />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.88fr) minmax(0, 1.12fr)', gap: 18, alignItems: 'start' }}>
        <section style={{ background: '#ffffff', borderRadius: 24, border: '1px solid #e5e7eb', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #eef2f7', background: source === 'saved' ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.04))' : 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(59,130,246,0.04))' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>ผู้ใช้ที่กดมากที่สุด</div>
            <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>เลือกคนเพื่อดูประวัติการกดแบบละเอียด</div>
          </div>

          <div style={{ padding: 16 }}>
            {loading ? (
              <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : topPeople.length === 0 ? (
              <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 600 }}>
                ຍັງບໍ່ມີຂໍ້ມູນ
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topPeople.map((person, index) => {
                  const isActive = selectedUserId === person.user_id;
                  return (
                    <button
                      key={person.user_id}
                      type='button'
                      onClick={() => setSelectedUserId(person.user_id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 16px',
                        borderRadius: 18,
                        border: `1px solid ${isActive ? 'rgba(59,130,246,0.26)' : '#eef2f7'}`,
                        background: isActive
                          ? source === 'saved'
                            ? 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(59,130,246,0.08))'
                            : 'linear-gradient(135deg, rgba(124,58,237,0.14), rgba(59,130,246,0.08))'
                          : '#ffffff',
                        boxShadow: isActive ? '0 14px 28px rgba(59,130,246,0.08)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ minWidth: 26, color: '#64748b', fontWeight: 800 }}>{index + 1}.</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {person.person_label}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                          กดล่าสุด {formatDateTime(person.last_clicked_at)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, lineHeight: '24px', fontWeight: 900, color: source === 'saved' ? '#0f766e' : '#6d28d9' }}>
                          {person.total_clicks.toLocaleString()}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>ครั้ง</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section style={{ display: 'grid', gap: 18 }}>
          <div style={{ background: '#ffffff', borderRadius: 24, border: '1px solid #e5e7eb', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #eef2f7', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.04))' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>ประวัติการกดของผู้ใช้ที่เลือก</div>
              <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
                {selectedPerson?.person_label || 'ยังไม่ได้เลือกผู้ใช้'}
              </div>
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 16, borderRadius: 18, border: '1px solid #dbeafe', background: 'linear-gradient(135deg, rgba(59,130,246,0.10), rgba(255,255,255,0.9))' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>คนที่เลือก</div>
                  <div style={{ marginTop: 8, fontSize: 17, fontWeight: 900, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedPerson?.person_label || '-'}
                  </div>
                </div>
                <div style={{ padding: 16, borderRadius: 18, border: '1px solid #dcfce7', background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(255,255,255,0.9))' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>กดในช่วงที่เลือก</div>
                  <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
                    {historyLoading ? '...' : payload.stats.selectedUserClicks.toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ borderRadius: 18, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                  {historyLoading ? (
                    <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LoadingSpinner />
                    </div>
                  ) : payload.history.length === 0 ? (
                    <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 600 }}>
                      ยังไม่มีประวัติในช่วงเวลานี้
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                          <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>เวลา</th>
                          <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ผู้ใช้</th>
                          <th style={{ textAlign: 'right', padding: '14px 16px', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ครั้งที่</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payload.history.map((item, index) => (
                          <tr key={item.id} style={{ borderTop: '1px solid #eef2f7' }}>
                            <td style={{ padding: '14px 16px', color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatDateTime(item.created_at)}</td>
                            <td style={{ padding: '14px 16px', color: '#334155' }}>{item.person_label}</td>
                            <td style={{ padding: '14px 16px', textAlign: 'right', color: source === 'saved' ? '#0f766e' : '#6d28d9', fontWeight: 800 }}>{index + 1}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: 24, border: '1px solid #e5e7eb', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #eef2f7', background: 'linear-gradient(135deg, rgba(2,132,199,0.08), rgba(16,185,129,0.04))' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>สรุปผู้ใช้ทั้งหมด</div>
              <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>ภาพรวมการกดจากช่วงเวลาที่เลือก</div>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {payload.people.map((person) => (
                  <div
                    key={person.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 16,
                      border: '1px solid #eef2f7',
                      background: '#fff',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.person_label}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>กดล่าสุด {formatDateTime(person.last_clicked_at)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>{person.total_clicks.toLocaleString()}</div>
                      <button
                        type='button'
                        onClick={() => setSelectedUserId(person.user_id)}
                        style={{
                          marginTop: 6,
                          border: 'none',
                          background: 'transparent',
                          color: source === 'saved' ? '#0f766e' : '#6d28d9',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        ดูประวัติ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}