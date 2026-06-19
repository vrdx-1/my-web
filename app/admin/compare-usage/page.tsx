'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { StatCard } from '@/components/admin/StatCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getDateRange, type DateFilterType } from '@/utils/dateFilter';
import { LAO_FONT } from '@/utils/constants';

type CompareUsagePerson = {
  person_key: string;
  person_label: string;
  person_type: 'user';
  avatar_url: string | null;
  total_compare_clicks: number;
  last_clicked_at: string;
};

type CompareUsageLog = {
  id: string;
  created_at: string;
  user_id: string;
  person_key: string;
  person_label: string;
  person_type: 'user';
  post_id: string | null;
  post_short_id: string | null;
  caption: string | null;
  price: number | null;
  price_currency: string | null;
  province: string | null;
};

type CompareUsageStats = {
  totalClicks: number;
  uniqueUsers: number;
  uniquePosts: number;
  avgClicksPerUser: number;
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

function formatPrice(price: number | null, currency: string | null) {
  if (typeof price !== 'number' || !Number.isFinite(price)) return '-';
  const symbol = currency === '฿' || currency === '$' ? currency : '₭';
  return `${price.toLocaleString('en-US')} ${symbol}`;
}

export default function AdminCompareUsagePage() {
  const router = useRouter();
  const [filter, setFilter] = useState<DateFilterType>('A');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [stats, setStats] = useState<CompareUsageStats>({
    totalClicks: 0,
    uniqueUsers: 0,
    uniquePosts: 0,
    avgClicksPerUser: 0,
  });
  const [people, setPeople] = useState<CompareUsagePerson[]>([]);
  const [recentLogs, setRecentLogs] = useState<CompareUsageLog[]>([]);

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

        const response = await fetch(`/api/admin/compare-usage?${search.toString()}`, {
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
          throw new Error(payload?.error || 'ไม่สามารถโหลดข้อมูล compare usage ได้');
        }

        if (cancelled) return;

        setStats({
          totalClicks: Number(payload?.stats?.totalClicks || 0),
          uniqueUsers: Number(payload?.stats?.uniqueUsers || 0),
          uniquePosts: Number(payload?.stats?.uniquePosts || 0),
          avgClicksPerUser: Number(payload?.stats?.avgClicksPerUser || 0),
        });
        setPeople(Array.isArray(payload?.people) ? payload.people : []);
        setRecentLogs(Array.isArray(payload?.recentLogs) ? payload.recentLogs : []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้');
        setPeople([]);
        setRecentLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [filter, router]);

  const topUsers = useMemo(() => people.slice(0, 10), [people]);
  const heroPerson = people[0] || null;

  return (
    <main
      style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '28px 20px 40px',
        minHeight: '100vh',
        fontFamily: LAO_FONT,
        background:
          'radial-gradient(circle at top left, rgba(24,119,242,0.10), transparent 34%), radial-gradient(circle at top right, rgba(13,148,136,0.09), transparent 40%), linear-gradient(180deg, #f8fbff 0%, #f6f8fb 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ maxWidth: 820 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 999, background: 'rgba(24,119,242,0.10)', color: '#1877f2', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
            Compare Usage Analytics
          </div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: '42px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
            ສະຖິຕິການເພີ່ມເຂົ້າ ປຽບທຽບ
          </h1>
          <p style={{ margin: '10px 0 0', color: '#475569', fontSize: 15, lineHeight: '24px' }}>
            ສະແດງສະເພາະການໃຊ້ງານຂອງ User ທົ່ວໄປ. Admin ແລະ Sub account ຍັງໃຊ້ຟີເຈີໄດ້ ປົກກະຕິ ແຕ່ຈະບໍ່ຖືກນັບໃນ dashboard ນີ້.
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
        <StatCard label="จำนวนกดเพิ่มทั้งหมด" value={stats.totalClicks.toLocaleString()} loading={loading} variant="centered" />
        <StatCard label="ผู้ใช้ที่กดจริง" value={stats.uniqueUsers.toLocaleString()} loading={loading} variant="centered" />
        <StatCard label="โพสต์ที่ถูกเลือก" value={stats.uniquePosts.toLocaleString()} loading={loading} variant="centered" />
        <StatCard label="เฉลี่ยต่อคน" value={loading ? '...' : stats.avgClicksPerUser.toFixed(1)} loading={loading} variant="centered" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(340px, 0.95fr)', gap: 18, alignItems: 'start' }}>
        <section style={{ background: '#ffffff', borderRadius: 24, border: '1px solid #e5e7eb', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #eef2f7', background: 'linear-gradient(135deg, rgba(24,119,242,0.06), rgba(13,148,136,0.04))' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Top ผู้ใช้ที่กดเพิ่ม compare</div>
            <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>เรียงตามจำนวนการกดมากไปน้อย</div>
          </div>

          <div style={{ padding: 16 }}>
            {loading ? (
              <div style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : topUsers.length === 0 ? (
              <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 600 }}>
                ຍັງບໍ່ມີຂໍ້ມູນ
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topUsers.map((person, index) => (
                  <div key={person.person_key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 18, background: index === 0 ? 'linear-gradient(135deg, rgba(24,119,242,0.08), rgba(16,185,129,0.06))' : '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: index === 0 ? '#1877f2' : '#e2e8f0', color: index === 0 ? '#fff' : '#334155', fontWeight: 800 }}>
                      {index + 1}
                    </div>

                    <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#dbeafe,#e2e8f0)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: 800 }}>
                      {person.avatar_url ? (
                        <img src={person.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        person.person_label.slice(0, 1).toUpperCase()
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {person.person_label}
                      </div>
                      <div style={{ marginTop: 3, fontSize: 12, color: '#64748b' }}>
                        ครั้งล่าสุด {formatDateTime(person.last_clicked_at)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: index === 0 ? '#0f766e' : '#1877f2' }}>{person.total_compare_clicks.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>ครั้ง</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={{ display: 'grid', gap: 18 }}>
          <div style={{ background: '#ffffff', borderRadius: 24, border: '1px solid #e5e7eb', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #eef2f7', background: 'linear-gradient(135deg, rgba(13,148,136,0.06), rgba(24,119,242,0.04))' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>ภาพรวมเร็ว</div>
              <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>ผู้ใช้ที่ active สูงสุด และข้อมูลรวม</div>
            </div>
            <div style={{ padding: 20 }}>
              {heroPerson ? (
                <div style={{ borderRadius: 20, padding: 18, background: 'linear-gradient(135deg, #eff6ff 0%, #ecfeff 100%)', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 700, marginBottom: 6 }}>ผู้ใช้ที่กดมากที่สุด</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{heroPerson.person_label}</div>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, color: '#334155' }}>
                    <span>{heroPerson.total_compare_clicks.toLocaleString()} ครั้ง</span>
                    <span>{formatDateTime(heroPerson.last_clicked_at)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 600 }}>
                  ยังไม่มีข้อมูล
                </div>
              )}
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: 24, border: '1px solid #e5e7eb', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #eef2f7', background: 'linear-gradient(135deg, rgba(244,114,182,0.06), rgba(24,119,242,0.04))' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>รายการล่าสุด</div>
              <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>ประวัติการกดเพิ่ม compare ล่าสุด</div>
            </div>

            <div style={{ maxHeight: 690, overflow: 'auto', padding: 16 }}>
              {loading ? (
                <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LoadingSpinner />
                </div>
              ) : recentLogs.length === 0 ? (
                <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 600 }}>
                  ຍັງບໍ່ມີລາຍການ
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recentLogs.map((item) => (
                    <div key={item.id} style={{ padding: 14, borderRadius: 16, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{item.person_label}</div>
                          <div style={{ fontSize: 13, color: '#475569', lineHeight: '20px' }}>
                            เพิ่มโพสต์ {item.post_short_id ? `#${item.post_short_id}` : item.post_id ? item.post_id.slice(0, 8) : '-'}
                            {item.caption ? ` • ${item.caption}` : ''}
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                            {item.province ? `${item.province} • ` : ''}{formatPrice(item.price, item.price_currency)}
                          </div>
                        </div>
                        <div style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#64748b', fontWeight: 600 }}>{formatDateTime(item.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}