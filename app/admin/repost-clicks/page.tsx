'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { StatCard } from '@/components/admin/StatCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getDateRange, type DateFilterType } from '@/utils/dateFilter';
import { LAO_FONT } from '@/utils/constants';

type RepostStats = {
  totalClicks: number;
  uniqueUsers: number;
  uniquePosts: number;
};

type RepostPostSummary = {
  post_id: string;
  short_id: string | null;
  caption: string | null;
  status: string | null;
  total_clicks: number;
  last_clicked_at: string;
};

type RepostUserSummary = {
  user_id: string;
  person_label: string;
  total_clicks: number;
  last_clicked_at: string;
};

type RepostEvent = {
  id: string;
  post_id: string;
  user_id: string;
  clicked_at: string;
};

function formatDateTime(dateString: string | null) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function safeText(value: string | null, fallback: string) {
  const trimmed = (value || '').trim();
  return trimmed || fallback;
}

export default function AdminRepostClicksPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<DateFilterType>('A');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<RepostStats>({
    totalClicks: 0,
    uniqueUsers: 0,
    uniquePosts: 0,
  });
  const [posts, setPosts] = useState<RepostPostSummary[]>([]);
  const [users, setUsers] = useState<RepostUserSummary[]>([]);
  const [recentEvents, setRecentEvents] = useState<RepostEvent[]>([]);

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

        const response = await fetch(`/api/admin/repost-clicks?${search.toString()}`, {
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

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) {
          throw new Error(payload?.error || 'ไม่สามารถโหลดข้อมูล repost clicks ได้');
        }

        if (cancelled) return;

        setStats({
          totalClicks: Number(payload?.stats?.totalClicks || 0),
          uniqueUsers: Number(payload?.stats?.uniqueUsers || 0),
          uniquePosts: Number(payload?.stats?.uniquePosts || 0),
        });

        setPosts(Array.isArray(payload?.posts) ? payload.posts : []);
        setUsers(Array.isArray(payload?.users) ? payload.users : []);
        setRecentEvents(Array.isArray(payload?.recentEvents) ? payload.recentEvents : []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้');
        setPosts([]);
        setUsers([]);
        setRecentEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [filter, router]);

  const topPosts = useMemo(() => posts.slice(0, 10), [posts]);
  const topUsers = useMemo(() => users.slice(0, 10), [users]);

  return (
    <main
      style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '28px 20px 40px',
        minHeight: '100vh',
        fontFamily: LAO_FONT,
        background:
          'radial-gradient(circle at top left, rgba(16,185,129,0.11), transparent 36%), radial-gradient(circle at top right, rgba(24,119,242,0.09), transparent 40%), linear-gradient(180deg, #f7fffb 0%, #f6f8fb 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ maxWidth: 840 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 999, background: 'rgba(16,185,129,0.12)', color: '#047857', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
            Repost Click Analytics
          </div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: '42px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
            ສະຖິຕິການກົດໂພສໃໝ່
          </h1>
          <p style={{ margin: '10px 0 0', color: '#475569', fontSize: 15, lineHeight: '24px' }}>
            ນັບການກົດ Repost ຈາກເມນູໄຂ່ປາຂອງ PostCard. ລະບົບນັບເຉົ້າສະເພາະ User ທົ່ວໄປ, ບໍ່ນັບ Admin ແລະ Sub account.
          </p>
        </div>

        <div style={{ minWidth: 220 }}>
          <TimeFilter filter={filter} onFilterChange={setFilter} />
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 18, padding: '12px 14px', borderRadius: 14, background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
        <StatCard label="จำนวนกด repost ทั้งหมด" value={stats.totalClicks.toLocaleString()} loading={loading} variant="centered" />
        <StatCard label="ผู้ใช้ที่กด repost" value={stats.uniqueUsers.toLocaleString()} loading={loading} variant="centered" />
        <StatCard label="โพสต์ที่ถูก repost" value={stats.uniquePosts.toLocaleString()} loading={loading} variant="centered" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 18 }}>
        <section style={{ background: '#ffffff', borderRadius: 24, border: '1px solid #e5e7eb', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #eef2f7', background: 'linear-gradient(135deg, rgba(16,185,129,0.07), rgba(24,119,242,0.04))' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Top โพสต์ที่โดน repost</div>
            <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>โพสต์ไหนถูกกดโພສໃໝ່มากที่สุด</div>
          </div>

          <div style={{ padding: 16 }}>
            {loading ? (
              <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : topPosts.length === 0 ? (
              <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 600 }}>
                ຍັງບໍ່ມີຂໍ້ມູນ
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topPosts.map((item, index) => (
                  <div key={item.post_id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', borderRadius: 16, border: '1px solid #e2e8f0', background: index === 0 ? 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(24,119,242,0.05))' : '#f8fafc' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: index === 0 ? '#059669' : '#e2e8f0', color: index === 0 ? '#fff' : '#334155', fontWeight: 800 }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        #{safeText(item.short_id, item.post_id.slice(0, 8))}
                        {item.caption ? ` • ${item.caption}` : ''}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                        สถานะ {safeText(item.status, '-')} • ล่าสุด {formatDateTime(item.last_clicked_at)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#059669' }}>{item.total_clicks.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>ครั้ง</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={{ background: '#ffffff', borderRadius: 24, border: '1px solid #e5e7eb', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #eef2f7', background: 'linear-gradient(135deg, rgba(24,119,242,0.08), rgba(16,185,129,0.04))' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Top ผู้ใช้ที่กด repost</div>
            <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>ดูว่า user คนไหนกดมากที่สุด</div>
          </div>

          <div style={{ padding: 16 }}>
            {loading ? (
              <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : topUsers.length === 0 ? (
              <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 600 }}>
                ຍັງບໍ່ມີຂໍ້ມູນ
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topUsers.map((item, index) => (
                  <div key={item.user_id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', borderRadius: 16, border: '1px solid #e2e8f0', background: index === 0 ? 'linear-gradient(135deg, rgba(24,119,242,0.10), rgba(16,185,129,0.06))' : '#f8fafc' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: index === 0 ? '#1877f2' : '#e2e8f0', color: index === 0 ? '#fff' : '#334155', fontWeight: 800 }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {safeText(item.person_label, `User ${item.user_id.slice(0, 8)}`)}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                        user_id {item.user_id.slice(0, 8)} • ล่าสุด {formatDateTime(item.last_clicked_at)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#1877f2' }}>{item.total_clicks.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>ครั้ง</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section style={{ marginTop: 18, background: '#ffffff', borderRadius: 24, border: '1px solid #e5e7eb', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #eef2f7', background: 'linear-gradient(135deg, rgba(15,23,42,0.04), rgba(24,119,242,0.04))' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Recent repost events</div>
          <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>เหตุการณ์ล่าสุด (สูงสุด 200 รายการ)</div>
        </div>

        <div style={{ maxHeight: 540, overflow: 'auto', padding: 16 }}>
          {loading ? (
            <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingSpinner />
            </div>
          ) : recentEvents.length === 0 ? (
            <div style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 600 }}>
              ຍັງບໍ່ມີລາຍການ
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentEvents.map((event) => (
                <div key={event.id} style={{ padding: 14, borderRadius: 14, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                      post {event.post_id.slice(0, 8)} • user {event.user_id.slice(0, 8)}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      event_id {event.id.slice(0, 8)}
                    </div>
                  </div>
                  <div style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    {formatDateTime(event.clicked_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
